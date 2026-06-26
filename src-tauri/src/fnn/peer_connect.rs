use std::path::Path;
use std::time::Duration;

use super::rpc::{self, GraphNode, RpcError};
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

    for _ in 0..GRAPH_LOOKUP_RETRIES {
        match rpc::fetch_graph_nodes().await {
            Ok(nodes) => {
                if let Some(node) = nodes
                    .iter()
                    .find(|node| pubkeys_equal(&node.pubkey, pubkey))
                {
                    addresses = rank_addresses(node);
                    break;
                }
            }
            Err(_) => {}
        }

        if addresses.is_empty() {
            tokio::time::sleep(GRAPH_LOOKUP_DELAY).await;
        }
    }

    if !saved_multiaddr.is_empty() && !addresses.iter().any(|addr| addr == saved_multiaddr) {
        let is_legacy_tcp = saved_multiaddr.contains("/tcp/8119/");
        if !(is_legacy_tcp && !addresses.is_empty()) {
            addresses.push(saved_multiaddr.to_string());
            addresses = dedupe_addresses(addresses);
            addresses = rank_addresses_from_strings(addresses);
        }
    }

    addresses
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
    if address.contains("/wss/") {
        return 0;
    }
    if address.contains("/ws/") {
        return 1;
    }
    if address.contains("/tcp/8228/") {
        return 2;
    }
    if address.contains("/tcp/8119/") {
        return 4;
    }
    3
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

pub async fn lookup_peer_auto_accept_min_ckb(pubkey: &str) -> Option<u64> {
    let pubkey = pubkey.trim();
    if pubkey.is_empty() {
        return None;
    }

    for _ in 0..GRAPH_LOOKUP_RETRIES {
        match super::rpc::fetch_graph_nodes().await {
            Ok(nodes) => {
                if let Some(node) = nodes
                    .iter()
                    .find(|node| pubkeys_equal(&node.pubkey, pubkey))
                {
                    if let Some(amount) = &node.auto_accept_min_ckb_funding_amount {
                        if let Some(ckb) = super::channel::shannons_hex_to_ckb(amount) {
                            return Some(ckb);
                        }
                    }
                    return None;
                }
            }
            Err(_) => {}
        }

        tokio::time::sleep(GRAPH_LOOKUP_DELAY).await;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_wss_before_legacy_tcp() {
        let ranked = rank_addresses_from_strings(vec![
            "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo".into(),
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo".into(),
        ]);

        assert!(ranked[0].contains("bottle.fiber.channel"));
    }

    #[test]
    fn dedupes_addresses() {
        let ranked = dedupe_addresses(vec![
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen".into(),
            "/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen".into(),
        ]);

        assert_eq!(ranked.len(), 1);
    }
}
