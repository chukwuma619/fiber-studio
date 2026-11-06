use std::path::Path;
use std::time::Duration;

use super::relays;
use super::rpc::{self, GraphNode, PeerInfo, RpcError};
use super::studio::{self, SavedPeer};

const CONNECT_POLL_INTERVAL: Duration = Duration::from_millis(500);
const CONNECT_REDDIAL_INTERVAL: Duration = Duration::from_secs(3);
const CONNECT_POLL_TIMEOUT: Duration = Duration::from_secs(25);
const GRAPH_LOOKUP_RETRIES_THOROUGH: usize = 6;
const GRAPH_LOOKUP_DELAY: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RelayConnectStatus {
    NotConfigured,
    AlreadyConnected,
    Connected,
    Failed,
}

impl RelayConnectStatus {
    pub fn is_up(&self) -> bool {
        matches!(self, Self::Connected | Self::AlreadyConnected)
    }
}

pub fn pubkeys_equal(left: &str, right: &str) -> bool {
    normalize_pubkey(left) == normalize_pubkey(right)
}

pub fn normalize_pubkey(pubkey: &str) -> String {
    pubkey.trim().trim_start_matches("0x").to_ascii_lowercase()
}

pub fn relay_status_for_peers(
    network: Option<&str>,
    peers: &[PeerInfo],
    saved_peers: &[SavedPeer],
    fallback_status: &str,
) -> String {
    let relays = network
        .map(relays::relays_for_network)
        .unwrap_or_default();

    if relays.is_empty() && saved_peers.is_empty() {
        return "not_configured".to_string();
    }

    if relays
        .iter()
        .any(|relay| peer_is_connected(peers, &relay.pubkey))
        || saved_peers
            .iter()
            .any(|saved| peer_is_connected(peers, &saved.pubkey))
    {
        return "connected".to_string();
    }

    match fallback_status {
        "connecting" => "connecting".to_string(),
        _ => "failed".to_string(),
    }
}

#[cfg(test)]
pub fn relay_status_for_saved_peers(
    peers: &[PeerInfo],
    saved_peers: &[SavedPeer],
    fallback_status: &str,
) -> String {
    relay_status_for_peers(None, peers, saved_peers, fallback_status)
}

fn peer_is_connected(peers: &[PeerInfo], pubkey: &str) -> bool {
    peers
        .iter()
        .any(|peer| pubkeys_equal(&peer.pubkey, pubkey))
}

/// At least one official relay is connected, and none of the official relays has an open or pending channel.
pub fn needs_relay_channel(
    connect_settled: bool,
    relay_pubkeys: &[String],
    connected_peers: &[PeerInfo],
    open_channel_pubkeys: &[String],
) -> bool {
    if !connect_settled || relay_pubkeys.is_empty() {
        return false;
    }
    if !relay_pubkeys
        .iter()
        .any(|relay| peer_is_connected(connected_peers, relay))
    {
        return false;
    }

    !open_channel_pubkeys.iter().any(|channel_pubkey| {
        relay_pubkeys
            .iter()
            .any(|relay| pubkeys_equal(relay, channel_pubkey))
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DialKind {
    Relay,
    SavedPeer,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DialTarget {
    pub pubkey: String,
    pub multiaddr: String,
    pub kind: DialKind,
}

pub struct PeerDial {
    pub pubkey: String,
    pub kind: DialKind,
    pub status: RelayConnectStatus,
}

/// Official relays for the network first, then saved peers that are not relays.
pub fn startup_dial_targets(network: &str, saved_peers: &[SavedPeer]) -> Vec<DialTarget> {
    let mut targets: Vec<DialTarget> = Vec::new();

    for relay in relays::relays_for_network(network) {
        if relay.pubkey.trim().is_empty() {
            continue;
        }
        let saved_multiaddr = saved_peers
            .iter()
            .find(|saved| pubkeys_equal(&saved.pubkey, &relay.pubkey))
            .map(|saved| saved.multiaddr.trim().to_string())
            .unwrap_or_default();
        let multiaddr = relay
            .multiaddr
            .as_deref()
            .map(str::trim)
            .filter(|addr| !addr.is_empty())
            .map(str::to_string)
            .unwrap_or(saved_multiaddr);
        targets.push(DialTarget {
            pubkey: relay.pubkey,
            multiaddr,
            kind: DialKind::Relay,
        });
    }

    for saved in saved_peers {
        if saved.pubkey.trim().is_empty()
            || targets
                .iter()
                .any(|target| pubkeys_equal(&target.pubkey, &saved.pubkey))
        {
            continue;
        }
        targets.push(DialTarget {
            pubkey: saved.pubkey.clone(),
            multiaddr: saved.multiaddr.clone(),
            kind: DialKind::SavedPeer,
        });
    }

    targets
}

/// Relays and saved peers missing from the live peer list (excluding paused pubkeys).
/// Empty means all active targets are connected.
pub async fn startup_peers_to_dial(
    data_directory: &Path,
    paused_pubkeys: &[String],
) -> Result<Vec<DialTarget>, String> {
    let metadata = studio::read_studio_metadata(data_directory).map_err(|error| error.to_string())?;
    let connected = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;
    Ok(startup_dial_targets(&metadata.network, &metadata.saved_peers)
        .into_iter()
        .filter(|target| {
            !paused_pubkeys
                .iter()
                .any(|paused| pubkeys_equal(paused, &target.pubkey))
        })
        .filter(|target| !peer_is_connected(&connected, &target.pubkey))
        .collect())
}

/// Dial the given peers together. Returns one result per peer.
pub async fn dial_startup_peers(data_directory: &Path, targets: Vec<DialTarget>) -> Vec<PeerDial> {
    let mut joins = Vec::with_capacity(targets.len());
    for target in targets {
        joins.push(tokio::spawn(async move {
            let status = ensure_peer_connected(&target.pubkey, &target.multiaddr)
                .await
                .unwrap_or(RelayConnectStatus::Failed);
            PeerDial {
                pubkey: target.pubkey,
                kind: target.kind,
                status,
            }
        }));
    }

    let mut dials = Vec::with_capacity(joins.len());
    let mut connected_pubkeys = Vec::new();
    for join in joins {
        let Ok(dial) = join.await else {
            continue;
        };
        if dial.status.is_up() {
            connected_pubkeys.push(dial.pubkey.clone());
        }
        dials.push(dial);
    }

    remember_connected_addresses(data_directory, &connected_pubkeys).await;
    dials
}

async fn remember_connected_addresses(data_directory: &Path, connected_pubkeys: &[String]) {
    if connected_pubkeys.is_empty() {
        return;
    }
    let Ok(connected_peers) = rpc::fetch_list_peers().await else {
        return;
    };
    let Ok(mut metadata) = studio::read_studio_metadata(data_directory) else {
        return;
    };
    let mut changed = false;
    for pubkey in connected_pubkeys {
        let Some(saved) = metadata.find_saved_peer_mut(pubkey) else {
            continue;
        };
        let Some(found) = connected_peers
            .iter()
            .find(|peer| pubkeys_equal(&peer.pubkey, pubkey))
        else {
            continue;
        };
        if saved.multiaddr != found.address {
            saved.multiaddr = found.address.clone();
            changed = true;
        }
    }
    if changed {
        let _ = studio::write_studio_metadata(data_directory, &metadata);
    }
}

pub async fn ensure_peer_connected(
    pubkey: &str,
    saved_multiaddr: &str,
) -> Result<RelayConnectStatus, RpcError> {
    let pubkey = pubkey.trim();
    if pubkey.is_empty() {
        return Ok(RelayConnectStatus::NotConfigured);
    }

    if is_peer_connected(pubkey).await? {
        return Ok(RelayConnectStatus::AlreadyConnected);
    }

    let saved_multiaddr = saved_multiaddr.trim();
    if wait_and_dial_peer(pubkey, saved_multiaddr, CONNECT_POLL_TIMEOUT).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    for address in resolve_graph_addresses(
        pubkey,
        saved_multiaddr,
        GRAPH_LOOKUP_RETRIES_THOROUGH,
    )
    .await
    {
        try_connect_peer_with_address(pubkey, &address).await;
    }

    if wait_for_peer_for(pubkey, CONNECT_POLL_TIMEOUT).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    Ok(RelayConnectStatus::Failed)
}

async fn wait_and_dial_peer(
    pubkey: &str,
    saved_multiaddr: &str,
    timeout: Duration,
) -> Result<bool, RpcError> {
    let started = std::time::Instant::now();
    let mut last_dial: Option<std::time::Instant> = None;

    while started.elapsed() < timeout {
        if last_dial
            .is_none_or(|instant| instant.elapsed() >= CONNECT_REDDIAL_INTERVAL)
        {
            dial_peer_attempts(pubkey, saved_multiaddr).await;
            last_dial = Some(std::time::Instant::now());
        }

        if is_peer_connected(pubkey).await? {
            return Ok(true);
        }

        tokio::time::sleep(CONNECT_POLL_INTERVAL).await;
    }

    is_peer_connected(pubkey).await
}

async fn dial_peer_attempts(pubkey: &str, saved_multiaddr: &str) {
    if !saved_multiaddr.is_empty() {
        try_connect_peer_with_address(pubkey, saved_multiaddr).await;
    }
    try_connect_peer_pubkey_only(pubkey).await;
}

async fn resolve_graph_addresses(
    pubkey: &str,
    saved_multiaddr: &str,
    max_retries: usize,
) -> Vec<String> {
    let mut addresses = Vec::new();
    let retries = max_retries.max(1);

    for attempt in 0..retries {
        match rpc::fetch_graph_nodes().await {
            Ok(nodes) => {
                if let Some(node) = nodes
                    .iter()
                    .find(|node| pubkeys_equal(&node.pubkey, pubkey))
                {
                    for address in rank_addresses(node) {
                        if address.trim() == saved_multiaddr.trim() {
                            continue;
                        }
                        if !addresses.iter().any(|existing| existing == &address) {
                            addresses.push(address);
                        }
                    }
                    break;
                }
            }
            Err(_) => {}
        }

        if addresses.is_empty() && attempt + 1 < retries {
            tokio::time::sleep(GRAPH_LOOKUP_DELAY).await;
        } else {
            break;
        }
    }

    rank_addresses_from_strings(addresses)
}

fn rank_addresses(node: &GraphNode) -> Vec<String> {
    rank_addresses_from_strings(node.addresses.clone())
}

fn rank_addresses_from_strings(mut addresses: Vec<String>) -> Vec<String> {
    addresses.sort_by_key(address_priority);
    dedupe_addresses(addresses)
}

fn dedupe_addresses(addresses: Vec<String>) -> Vec<String> {
    let mut unique = Vec::new();
    for address in addresses {
        if !unique.iter().any(|existing| existing == &address) {
            unique.push(address);
        }
    }
    unique
}

fn address_priority(address: &String) -> u8 {
    if address.contains("/tcp/8119/") {
        return 0;
    }
    if address.contains("/tcp/8228/") {
        return 1;
    }
    if address.contains("/ws/") {
        return 2;
    }
    if address.contains("/wss/") {
        return 3;
    }
    4
}

async fn is_peer_connected(pubkey: &str) -> Result<bool, RpcError> {
    let peers = rpc::fetch_list_peers().await?;
    Ok(peer_is_connected(&peers, pubkey))
}

async fn try_connect_peer_with_address(pubkey: &str, address: &str) {
    let _ = connect_peer_with_address(pubkey, address).await;
}

async fn try_connect_peer_pubkey_only(pubkey: &str) {
    let _ = connect_peer_pubkey_only(pubkey).await;
}

async fn connect_peer_with_address(pubkey: &str, address: &str) -> Result<(), RpcError> {
    let params = serde_json::json!([{
        "pubkey": pubkey,
        "address": address,
        "save": true,
    }]);

    rpc::connect_peer(params).await
}

async fn connect_peer_pubkey_only(pubkey: &str) -> Result<(), RpcError> {
    let params = serde_json::json!([{
        "pubkey": pubkey,
        "save": true,
    }]);

    rpc::connect_peer(params).await
}

async fn wait_for_peer_for(pubkey: &str, timeout: Duration) -> Result<bool, RpcError> {
    Ok(wait_for_peers([pubkey], timeout)
        .await?
        .contains(&normalize_pubkey(pubkey)))
}

async fn wait_for_peers<'a, I>(
    pubkeys: I,
    timeout: Duration,
) -> Result<std::collections::HashSet<String>, RpcError>
where
    I: IntoIterator<Item = &'a str>,
{
    use std::collections::HashSet;

    let targets: HashSet<String> = pubkeys
        .into_iter()
        .map(normalize_pubkey)
        .filter(|pubkey| !pubkey.is_empty())
        .collect();

    if targets.is_empty() {
        return Ok(HashSet::new());
    }

    let started = std::time::Instant::now();
    let mut connected = HashSet::new();

    while started.elapsed() < timeout && connected.len() < targets.len() {
        let peers = rpc::fetch_list_peers().await?;
        for peer in peers {
            let normalized = normalize_pubkey(&peer.pubkey);
            if targets.contains(&normalized) {
                connected.insert(normalized);
            }
        }

        if connected.len() == targets.len() {
            break;
        }

        tokio::time::sleep(CONNECT_POLL_INTERVAL).await;
    }

    Ok(connected)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_legacy_tcp_before_wss() {
        let ranked = rank_addresses_from_strings(vec![
            "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo".into(),
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo".into(),
        ]);

        assert!(ranked[0].contains("/tcp/8119/"));
    }

    #[test]
    fn resolve_keeps_saved_multiaddr_first() {
        let saved = "/ip4/18.162.235.225/tcp/8119/p2p/QmXen";
        let ranked = rank_addresses_from_strings(vec![
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen".into(),
            saved.into(),
        ]);

        assert!(ranked[0].contains("/tcp/8119/"));
    }

    #[test]
    fn dedupes_addresses() {
        let ranked = dedupe_addresses(vec![
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen".into(),
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen".into(),
        ]);

        assert_eq!(ranked.len(), 1);
    }

    #[test]
    fn needs_relay_channel_when_any_relay_connected_without_channel() {
        let relays = vec!["02aa".to_string(), "02bb".to_string()];
        let peer = |pubkey: &str| PeerInfo {
            pubkey: pubkey.into(),
            address: "/ip4/1.2.3.4/tcp/8228".into(),
        };
        let one_relay = vec![peer("02aa"), peer("03cc")];
        let both_relays = vec![peer("02aa"), peer("02bb")];
        let no_relays = vec![peer("03cc")];

        assert!(needs_relay_channel(true, &relays, &one_relay, &[]));
        assert!(needs_relay_channel(true, &relays, &both_relays, &[]));
        assert!(!needs_relay_channel(true, &relays, &no_relays, &[]));
        assert!(!needs_relay_channel(false, &relays, &both_relays, &[]));
        assert!(!needs_relay_channel(true, &[], &both_relays, &[]));
        assert!(!needs_relay_channel(true, &relays, &both_relays, &["02AA".into()]));
        assert!(needs_relay_channel(true, &relays, &both_relays, &["03cc".into()]));
    }

    #[test]
    fn startup_targets_include_official_relays_even_when_not_saved() {
        let relays = relays::relays_for_network("testnet");
        assert!(!relays.is_empty());
        let targets = startup_dial_targets("testnet", &[]);
        assert_eq!(targets.len(), relays.len());
        assert!(targets.iter().all(|target| target.kind == DialKind::Relay));
    }

    #[test]
    fn startup_targets_include_relays_then_non_relay_saved_peers() {
        let relays = relays::relays_for_network("testnet");
        assert!(!relays.is_empty());
        let saved = vec![
            SavedPeer {
                pubkey: relays[0].pubkey.to_uppercase(),
                multiaddr: "/ip4/9.9.9.9/tcp/1".into(),
            },
            SavedPeer {
                pubkey: "03cc".into(),
                multiaddr: "/ip4/5.6.7.8/tcp/8228".into(),
            },
        ];

        let targets = startup_dial_targets("testnet", &saved);

        assert_eq!(targets.len(), relays.len() + 1);
        assert!(targets[..relays.len()]
            .iter()
            .all(|target| target.kind == DialKind::Relay));
        assert_eq!(targets[0].multiaddr, relays[0].multiaddr.clone().unwrap());
        let last = targets.last().unwrap();
        assert_eq!(last.kind, DialKind::SavedPeer);
        assert_eq!(last.pubkey, "03cc");
        assert!(startup_dial_targets("unknown", &[]).is_empty());
    }

    #[test]
    fn relay_status_for_peers_counts_connected_official_relay_even_without_saved_peers() {
        let relays = relays::relays_for_network("testnet");
        assert!(!relays.is_empty());
        let peers = vec![PeerInfo {
            pubkey: relays[0].pubkey.clone(),
            address: "/ip4/1.2.3.4/tcp/8228".into(),
        }];
        let status = relay_status_for_peers(Some("testnet"), &peers, &[], "failed");
        assert_eq!(status, "connected");
    }

    #[test]
    fn relay_status_never_reports_connected_without_peer_in_list() {
        let saved_peers = vec![SavedPeer {
            pubkey: "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71".into(),
            multiaddr: String::new(),
        }];
        let status = relay_status_for_saved_peers(&[], &saved_peers, "connected");

        assert_eq!(status, "failed");
    }

    #[test]
    fn relay_status_failed_when_saved_peers_exist_but_not_connected() {
        let saved_peers = vec![SavedPeer {
            pubkey: "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71".into(),
            multiaddr: String::new(),
        }];
        let status = relay_status_for_saved_peers(&[], &saved_peers, "");

        assert_eq!(status, "failed");
    }

    #[test]
    fn relay_status_connected_when_any_saved_peer_present() {
        let saved_peers = vec![
            SavedPeer {
                pubkey: "02aaa".into(),
                multiaddr: String::new(),
            },
            SavedPeer {
                pubkey: "02bbb".into(),
                multiaddr: String::new(),
            },
        ];
        let peers = vec![PeerInfo {
            pubkey: "02bbb".into(),
            address: "/ip4/1.2.3.4/tcp/8228".into(),
        }];
        let status = relay_status_for_saved_peers(&peers, &saved_peers, "failed");

        assert_eq!(status, "connected");
    }
}
