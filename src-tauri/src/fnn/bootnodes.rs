use serde::Deserialize;

use super::peer_connect;

const MAINNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/mainnet.yml");
const TESTNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/testnet.yml");

#[derive(Debug, Deserialize)]
struct FnnConfigTemplate {
    fiber: FiberSection,
}

#[derive(Debug, Deserialize)]
struct FiberSection {
    bootnode_addrs: Vec<String>,
}

fn template_for_network(network: &str) -> Option<&'static str> {
    match network {
        "mainnet" => Some(MAINNET_TEMPLATE),
        "testnet" => Some(TESTNET_TEMPLATE),
        _ => None,
    }
}

pub fn bootnode_addrs_for_network(network: &str) -> Vec<String> {
    let Some(template) = template_for_network(network) else {
        return Vec::new();
    };

    serde_yaml::from_str::<FnnConfigTemplate>(template)
        .map(|config| config.fiber.bootnode_addrs)
        .unwrap_or_default()
}

pub fn is_bootnode_peer(network: &str, peer_address: &str) -> bool {
    let address = peer_address.trim();
    if address.is_empty() {
        return false;
    }

    bootnode_addrs_for_network(network)
        .iter()
        .any(|bootnode| peer_addresses_match(address, bootnode.trim()))
}

pub fn is_bootnode_pubkey(network: &str, peers: &[super::rpc::PeerInfo], pubkey: &str) -> bool {
    peers
        .iter()
        .find(|peer| peer_connect::pubkeys_equal(&peer.pubkey, pubkey))
        .map(|peer| is_bootnode_peer(network, &peer.address))
        .unwrap_or(false)
}

fn peer_addresses_match(peer_address: &str, bootnode_address: &str) -> bool {
    if peer_address == bootnode_address {
        return true;
    }

    bootnode_p2p_suffix(bootnode_address)
        .is_some_and(|suffix| peer_address.contains(&suffix))
}

fn bootnode_p2p_suffix(multiaddr: &str) -> Option<String> {
    multiaddr.rsplit("/p2p/").next().filter(|_| multiaddr.contains("/p2p/"))
        .map(|peer_id| format!("/p2p/{peer_id}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn testnet_bootnodes_load_from_template() {
        let addrs = bootnode_addrs_for_network("testnet");
        assert_eq!(addrs.len(), 2);
        assert!(addrs[0].contains("54.179.226.154"));
    }

    #[test]
    fn matches_list_peers_bootnode_address() {
        let boot = "/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy";
        let peer = "/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy";
        assert!(is_bootnode_peer("testnet", peer));
        assert!(peer_addresses_match(peer, boot));
    }
}
