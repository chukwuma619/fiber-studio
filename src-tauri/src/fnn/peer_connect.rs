use std::time::Duration;

use super::rpc::{self, GraphNode, PeerInfo, RpcError};
use super::studio::SavedPeer;

const CONNECT_POLL_INTERVAL: Duration = Duration::from_millis(500);
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

pub fn pubkeys_equal(left: &str, right: &str) -> bool {
    normalize_pubkey(left) == normalize_pubkey(right)
}

pub fn normalize_pubkey(pubkey: &str) -> String {
    pubkey.trim().trim_start_matches("0x").to_ascii_lowercase()
}

pub fn relay_status_for_saved_peers(
    peers: &[PeerInfo],
    saved_peers: &[SavedPeer],
    fallback_status: &str,
) -> String {
    if saved_peers.is_empty() {
        return "not_configured".to_string();
    }

    if saved_peers.iter().any(|saved| {
        peers
            .iter()
            .any(|peer| pubkeys_equal(&peer.pubkey, &saved.pubkey))
    }) {
        return "connected".to_string();
    }

    match fallback_status {
        "connecting" => "connecting".to_string(),
        _ => "failed".to_string(),
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
    dial_peer_attempts(pubkey, saved_multiaddr).await;

    if wait_for_peer(pubkey).await? {
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

    if wait_for_peer(pubkey).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    Ok(RelayConnectStatus::Failed)
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
    Ok(peers.iter().any(|peer| pubkeys_equal(&peer.pubkey, pubkey)))
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

async fn wait_for_peer(pubkey: &str) -> Result<bool, RpcError> {
    Ok(wait_for_peers([pubkey])
        .await?
        .contains(&normalize_pubkey(pubkey)))
}

async fn wait_for_peers<'a, I>(pubkeys: I) -> Result<std::collections::HashSet<String>, RpcError>
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

    while started.elapsed() < CONNECT_POLL_TIMEOUT && connected.len() < targets.len() {
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
