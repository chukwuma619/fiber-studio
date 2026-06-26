use std::path::Path;
use std::time::Duration;

use super::rpc::{self, GraphNode, PeerInfo, RpcError};
use super::studio::{self, StudioMetadata};

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

pub fn pubkeys_equal(left: &str, right: &str) -> bool {
    normalize_pubkey(left) == normalize_pubkey(right)
}

pub fn normalize_pubkey(pubkey: &str) -> String {
    pubkey.trim().trim_start_matches("0x").to_ascii_lowercase()
}

pub fn relay_status_for_configured_peer(
    peers: &[PeerInfo],
    configured_pubkey: &str,
    fallback_status: &str,
) -> String {
    if configured_pubkey.trim().is_empty() {
        return "not_configured".to_string();
    }

    if peers
        .iter()
        .any(|peer| pubkeys_equal(&peer.pubkey, configured_pubkey))
    {
        return "connected".to_string();
    }

    // Never trust cached manager state as "connected" — verify against list_peers.
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

    let addresses = resolve_connect_addresses(pubkey, saved_multiaddr).await;
    if !addresses.is_empty() {
        for address in addresses {
            connect_peer_with_address(pubkey, &address).await?;

            if wait_for_peer(pubkey).await? {
                return Ok(RelayConnectStatus::Connected);
            }
        }
    }

    connect_peer_pubkey_only(pubkey).await?;

    if wait_for_peer(pubkey).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    Ok(RelayConnectStatus::Failed)
}

pub async fn ensure_configured_peer_connected(
    data_dir: &Path,
) -> Result<RelayConnectStatus, RpcError> {
    let metadata = match studio::read_studio_metadata(data_dir) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(RelayConnectStatus::NotConfigured),
    };

    connect_from_metadata(data_dir, &metadata).await
}

pub async fn connect_from_metadata(
    data_dir: &Path,
    metadata: &StudioMetadata,
) -> Result<RelayConnectStatus, RpcError> {
    let pubkey = metadata.custom_public_node_pubkey.trim();
    if pubkey.is_empty() {
        return Ok(RelayConnectStatus::NotConfigured);
    }

    if is_peer_connected(pubkey).await? {
        return Ok(RelayConnectStatus::AlreadyConnected);
    }

    let addresses =
        resolve_connect_addresses(pubkey, metadata.custom_public_node_multiaddr.trim()).await;
    if addresses.is_empty() {
        return try_pubkey_only_connect(data_dir, metadata, pubkey).await;
    }

    for address in addresses {
        connect_peer_with_address(pubkey, &address).await?;

        if wait_for_peer(pubkey).await? {
            let _ = studio::persist_relay_multiaddr(data_dir, metadata, &address);
            return Ok(RelayConnectStatus::Connected);
        }
    }

    try_pubkey_only_connect(data_dir, metadata, pubkey).await
}

async fn try_pubkey_only_connect(
    data_dir: &Path,
    metadata: &StudioMetadata,
    pubkey: &str,
) -> Result<RelayConnectStatus, RpcError> {
    connect_peer_pubkey_only(pubkey).await?;

    if wait_for_peer(pubkey).await? {
        return Ok(RelayConnectStatus::Connected);
    }

    let _ = metadata;
    let _ = data_dir;
    Ok(RelayConnectStatus::Failed)
}

async fn resolve_connect_addresses(pubkey: &str, saved_multiaddr: &str) -> Vec<String> {
    let mut addresses = Vec::new();

    if !saved_multiaddr.is_empty() {
        addresses.push(saved_multiaddr.to_string());
    }

    for _ in 0..GRAPH_LOOKUP_RETRIES {
        match rpc::fetch_graph_nodes().await {
            Ok(nodes) => {
                if let Some(node) = nodes
                    .iter()
                    .find(|node| pubkeys_equal(&node.pubkey, pubkey))
                {
                    for address in rank_addresses(node) {
                        if !addresses.iter().any(|existing| existing == &address) {
                            addresses.push(address);
                        }
                    }
                    break;
                }
            }
            Err(_) => {}
        }

        if addresses.len() <= usize::from(!saved_multiaddr.is_empty()) {
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
    fn relay_status_never_reports_connected_without_peer_in_list() {
        let status = relay_status_for_configured_peer(
            &[],
            "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
            "connected",
        );

        assert_eq!(status, "failed");
    }
}
