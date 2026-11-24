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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_both_official_relays_for_a_known_network() {
        let testnet = relays_for_network("testnet");
        let mainnet = relays_for_network("mainnet");
        assert_eq!(testnet.len(), 2);
        assert_eq!(mainnet.len(), 2);
        assert!(testnet.iter().any(|relay| relay.id == "node1"));
        assert!(relays_for_network("devnet").is_empty());
    }

    #[test]
    fn matches_an_official_pubkey_across_prefix_and_case() {
        let pubkey = relays_for_network("testnet")
            .into_iter()
            .next()
            .expect("testnet relay")
            .pubkey;
        assert!(is_official_relay_pubkey(
            "testnet",
            &format!("0X{}", pubkey.to_ascii_uppercase())
        ));
        assert!(!is_official_relay_pubkey("mainnet", &pubkey));
        assert!(!is_official_relay_pubkey("testnet", "02aa"));
    }
}
