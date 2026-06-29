use std::path::Path;
use std::time::Duration;

use super::rpc::{self, GraphNode, PeerInfo, RpcError};
use super::studio::{self, SavedPeer, StudioMetadata};

const CONNECT_POLL_INTERVAL: Duration = Duration::from_millis(500);
const CONNECT_POLL_TIMEOUT: Duration = Duration::from_secs(25);
const GRAPH_LOOKUP_RETRIES: usize = 6;
const GRAPH_LOOKUP_DELAY: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RelayConnectStatus {
    NotConfigured,
    AlreadyConnected,
    Connected,
    Connecting,
    Failed,
}

impl RelayConnectStatus {
    pub fn status_label(&self) -> &'static str {
        match self {
            Self::NotConfigured => "not_configured",
            Self::AlreadyConnected | Self::Connected => "connected",
            Self::Connecting => "connecting",
            Self::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedPeersConnectResult {
    pub connected_count: usize,
    pub total: usize,
    pub any_failed: bool,
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
        "failed" => "failed".to_string(),
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

    if !saved_multiaddr.is_empty() {
        try_connect_peer_with_address(pubkey, saved_multiaddr).await;

        if wait_for_peer(pubkey).await? {
            return Ok(RelayConnectStatus::Connected);
        }

        if let Some(dial_address) = strip_p2p_suffix(saved_multiaddr) {
            try_connect_peer_with_address(pubkey, &dial_address).await;

            if wait_for_peer(pubkey).await? {
                return Ok(RelayConnectStatus::Connected);
            }
        }
    }

    try_connect_peer_pubkey_only(pubkey).await;

    if wait_for_peer(pubkey).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    let addresses = resolve_graph_addresses(pubkey, saved_multiaddr).await;
    for address in addresses {
        try_connect_peer_with_address(pubkey, &address).await;

        if wait_for_peer(pubkey).await? {
            return Ok(RelayConnectStatus::Connected);
        }
    }

    Ok(RelayConnectStatus::Failed)
}

pub async fn ensure_saved_peers_connected(
    data_dir: &Path,
) -> Result<SavedPeersConnectResult, RpcError> {
    let metadata = match studio::read_studio_metadata(data_dir) {
        Ok(metadata) => metadata,
        Err(_) => {
            return Ok(SavedPeersConnectResult {
                connected_count: 0,
                total: 0,
                any_failed: false,
            });
        }
    };

    if metadata.saved_peers.is_empty() {
        return Ok(SavedPeersConnectResult {
            connected_count: 0,
            total: 0,
            any_failed: false,
        });
    }

    let total = metadata.saved_peers.len();
    let mut connected_count = 0;
    let mut any_failed = false;

    let mut handles = Vec::with_capacity(total);
    for saved_peer in &metadata.saved_peers {
        let data_dir = data_dir.to_path_buf();
        let metadata = metadata.clone();
        let saved_peer = saved_peer.clone();
        handles.push(tokio::spawn(async move {
            connect_saved_peer(&data_dir, &metadata, &saved_peer).await
        }));
    }

    for handle in handles {
        match handle.await {
            Ok(Ok(status)) => match status {
                RelayConnectStatus::AlreadyConnected | RelayConnectStatus::Connected => {
                    connected_count += 1;
                }
                RelayConnectStatus::Failed => {
                    any_failed = true;
                }
                RelayConnectStatus::NotConfigured | RelayConnectStatus::Connecting => {}
            },
            Ok(Err(_)) | Err(_) => {
                any_failed = true;
            }
        }
    }

    Ok(SavedPeersConnectResult {
        connected_count,
        total,
        any_failed,
    })
}

pub async fn connect_saved_peer(
    data_dir: &Path,
    metadata: &StudioMetadata,
    saved_peer: &SavedPeer,
) -> Result<RelayConnectStatus, RpcError> {
    let pubkey = saved_peer.pubkey.trim();
    if pubkey.is_empty() {
        return Ok(RelayConnectStatus::NotConfigured);
    }

    let status = ensure_peer_connected(pubkey, saved_peer.multiaddr.trim()).await?;

    if status == RelayConnectStatus::Connected {
        if let Ok(peers) = rpc::fetch_list_peers().await {
            if let Some(peer) = peers.iter().find(|peer| pubkeys_equal(&peer.pubkey, pubkey)) {
                let _ = studio::persist_relay_multiaddr(data_dir, metadata, pubkey, &peer.address);
            }
        }
    }

    Ok(status)
}

async fn resolve_graph_addresses(pubkey: &str, saved_multiaddr: &str) -> Vec<String> {
    let mut addresses = Vec::new();

    for _ in 0..GRAPH_LOOKUP_RETRIES {
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

        if addresses.is_empty() {
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

fn strip_p2p_suffix(multiaddr: &str) -> Option<String> {
    let trimmed = multiaddr.trim();
    let suffix_start = trimmed.find("/p2p/")?;
    if suffix_start == 0 {
        return None;
    }

    Some(trimmed[..suffix_start].to_string())
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
    let started = std::time::Instant::now();

    while started.elapsed() < CONNECT_POLL_TIMEOUT {
        if is_peer_connected(pubkey).await? {
            return Ok(true);
        }

        tokio::time::sleep(CONNECT_POLL_INTERVAL).await;
    }

    Ok(false)
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
    fn strip_p2p_suffix_removes_trailing_peer_id() {
        let stripped = strip_p2p_suffix(
            "/ip4/18.163.221.211/tcp/8119/p2p/QmbKyzq9qUmymW2Gi8Zq7kKVpPiNA1XUJ6uMvsUC4F3p89",
        );

        assert_eq!(stripped, Some("/ip4/18.163.221.211/tcp/8119".into()));
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
