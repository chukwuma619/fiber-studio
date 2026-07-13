use serde::Deserialize;

use super::peer_connect;

const RELAYS_JSON: &str = include_str!("../../../shared/relays.json");

#[derive(Debug, Clone, Deserialize)]
pub struct RelayNode {
    pub id: String,
    #[allow(dead_code)]
    pub label: String,
    pub pubkey: String,
    #[serde(default)]
    pub multiaddr: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RelaysManifest {
    testnet: Vec<RelayNode>,
    mainnet: Vec<RelayNode>,
}

fn manifest() -> RelaysManifest {
    serde_json::from_str(RELAYS_JSON).expect("shared/relays.json must be valid")
}

pub fn relays_for_network(network: &str) -> Vec<RelayNode> {
    let manifest = manifest();
    match network {
        "mainnet" => manifest.mainnet,
        "testnet" => manifest.testnet,
        _ => Vec::new(),
    }
}

pub fn find_relay_by_pubkey(network: &str, pubkey: &str) -> Option<RelayNode> {
    relays_for_network(network)
        .into_iter()
        .find(|relay| peer_connect::pubkeys_equal(&relay.pubkey, pubkey))
}

pub fn is_official_relay_pubkey(network: &str, pubkey: &str) -> bool {
    find_relay_by_pubkey(network, pubkey).is_some()
}
