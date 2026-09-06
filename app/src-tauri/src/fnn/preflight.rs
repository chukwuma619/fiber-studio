use serde::{Deserialize, Serialize};

use super::assets;
use super::channel::{self, HomeChannel};
use super::peer_connect;
use super::relays;
use super::rpc;

const GRAPH_PAGE_LIMIT: u32 = 0x100;
const GRAPH_CHANNEL_SCAN_PAGES: u32 = 2;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightSnapshotPayload {
    #[serde(default)]
    pub payee_pubkey: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightPayeeGraph {
    pub in_graph: bool,
    pub neighbor_count: u32,
    pub neighbor_pubkeys: Vec<String>,
    pub shares_official_relay: bool,
    pub is_official_relay: bool,
    pub lookup_complete: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightSnapshot {
    pub own_pubkey: Option<String>,
    pub channels: Vec<HomeChannel>,
    pub connected_peer_pubkeys: Vec<String>,
    pub graph_node_count: u32,
    pub graph_ready: bool,
    pub official_relay_pubkeys: Vec<String>,
    pub local_official_relay_connected: bool,
    pub local_official_relay_channel_ready: bool,
    pub payee: Option<PreflightPayeeGraph>,
}

pub fn extract_invoice_payee_pubkey(attrs: &[serde_json::Value]) -> Option<String> {
    const KEYS: &[&str] = &["payee_public_key", "PayeePublicKey", "payeePublicKey"];

    for attr in attrs {
        for key in KEYS {
            if let Some(value) = attr.get(*key).and_then(json_pubkey_string) {
                return Some(value);
            }
        }
    }

    None
}

fn json_pubkey_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        _ => None,
    }
}

pub async fn fetch_preflight_snapshot(
    network: &str,
    payee_pubkey: Option<&str>,
) -> Result<PreflightSnapshot, String> {
    let (node_info, channels, peers, graph_nodes) = tokio::join!(
        rpc::fetch_node_info(),
        rpc::fetch_list_channels(),
        rpc::fetch_list_peers(),
        rpc::fetch_graph_nodes_page(GRAPH_PAGE_LIMIT, None),
    );

    let node_info = node_info.map_err(|error| error.to_string())?;
    let channels = channels.map_err(|error| error.to_string())?;
    let peers = peers.map_err(|error| error.to_string())?;
    let graph_nodes = graph_nodes.map_err(|error| error.to_string())?;

    let catalog = assets::build_asset_catalog(&node_info);
    let home_channels = channels
        .iter()
        .cloned()
        .map(|channel| channel::to_home_channel(channel, &catalog))
        .collect();

    let official_relays: Vec<String> = relays::relays_for_network(network)
        .into_iter()
        .map(|relay| relay.pubkey)
        .collect();

    let connected_peer_pubkeys = peers.iter().map(|peer| peer.pubkey.clone()).collect();

    let local_official_relay_connected = official_relays.iter().any(|relay| {
        peers
            .iter()
            .any(|peer| peer_connect::pubkeys_equal(&peer.pubkey, relay))
    });

    let local_official_relay_channel_ready = official_relays.iter().any(|relay| {
        channels.iter().any(|channel| {
            peer_connect::pubkeys_equal(&channel.pubkey, relay) && rpc::is_channel_ready(&channel.state)
        })
    });

    let graph_node_count = graph_nodes.items.len() as u32;
    let graph_nodes_has_more = graph_nodes.last_cursor.is_some();

    let payee = if let Some(payee) = payee_pubkey.map(str::trim).filter(|value| !value.is_empty()) {
        Some(
            lookup_payee_graph(
                payee,
                &official_relays,
                &graph_nodes.items,
                graph_nodes_has_more,
            )
            .await?,
        )
    } else {
        None
    };

    Ok(PreflightSnapshot {
        own_pubkey: Some(node_info.pubkey),
        channels: home_channels,
        connected_peer_pubkeys,
        graph_node_count,
        graph_ready: graph_node_count > 0,
        official_relay_pubkeys: official_relays,
        local_official_relay_connected,
        local_official_relay_channel_ready,
        payee,
    })
}

async fn lookup_payee_graph(
    payee: &str,
    official_relays: &[String],
    first_nodes: &[rpc::GraphNode],
    nodes_has_more: bool,
) -> Result<PreflightPayeeGraph, String> {
    let in_nodes = first_nodes
        .iter()
        .any(|node| peer_connect::pubkeys_equal(&node.pubkey, payee));
    let is_official_relay = official_relays
        .iter()
        .any(|relay| peer_connect::pubkeys_equal(relay, payee));

    let mut neighbor_pubkeys = Vec::new();
    let mut after = None;
    let mut channels_has_more = false;

    for _ in 0..GRAPH_CHANNEL_SCAN_PAGES {
        let page = rpc::fetch_graph_channels_page(GRAPH_PAGE_LIMIT, after.as_deref())
            .await
            .map_err(|error| error.to_string())?;

        for channel in &page.items {
            if peer_connect::pubkeys_equal(&channel.node1, payee) {
                push_unique_pubkey(&mut neighbor_pubkeys, &channel.node2);
            } else if peer_connect::pubkeys_equal(&channel.node2, payee) {
                push_unique_pubkey(&mut neighbor_pubkeys, &channel.node1);
            }
        }

        after = page.last_cursor.clone();
        if after.is_none() {
            channels_has_more = false;
            break;
        }
        channels_has_more = true;
    }

    let in_graph = in_nodes || !neighbor_pubkeys.is_empty();
    let shares_official_relay = is_official_relay
        || neighbor_pubkeys.iter().any(|neighbor| {
            official_relays
                .iter()
                .any(|relay| peer_connect::pubkeys_equal(relay, neighbor))
        });

    let lookup_complete = in_graph || (!nodes_has_more && !channels_has_more);

    Ok(PreflightPayeeGraph {
        in_graph,
        neighbor_count: neighbor_pubkeys.len() as u32,
        neighbor_pubkeys,
        shares_official_relay,
        is_official_relay,
        lookup_complete,
    })
}

fn push_unique_pubkey(pubkeys: &mut Vec<String>, pubkey: &str) {
    if pubkeys
        .iter()
        .any(|existing| peer_connect::pubkeys_equal(existing, pubkey))
    {
        return;
    }
    pubkeys.push(pubkey.to_string());
}

#[cfg(test)]
mod tests {
    use super::extract_invoice_payee_pubkey;

    #[test]
    fn extracts_snake_case_payee_public_key() {
        let attrs = vec![serde_json::json!({
            "payee_public_key": "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71"
        })];
        assert_eq!(
            extract_invoice_payee_pubkey(&attrs).as_deref(),
            Some("02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71")
        );
    }

    #[test]
    fn extracts_pascal_case_payee_public_key() {
        let attrs = vec![serde_json::json!({
            "PayeePublicKey": "0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc"
        })];
        assert_eq!(
            extract_invoice_payee_pubkey(&attrs).as_deref(),
            Some("0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc")
        );
    }

    #[test]
    fn returns_none_when_payee_attr_missing() {
        let attrs = vec![serde_json::json!({ "description": "coffee" })];
        assert_eq!(extract_invoice_payee_pubkey(&attrs), None);
    }
}
