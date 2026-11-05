use std::collections::HashMap;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

use super::assets::{self, AssetView};
use super::peer_connect::normalize_pubkey;
use super::rpc::{self, GraphChannelInfo, GraphNode, RpcError};

pub const GRAPH_PAGE_LIMIT: u32 = 100;
pub const GRAPH_MAX_PAGES: u32 = 40;
pub const GRAPH_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexedPublicChannel {
    pub node1: String,
    pub node2: String,
    pub asset_symbol: String,
    pub decimals: u8,
    pub capacity_raw: u128,
}

#[derive(Debug, Clone)]
pub struct GraphIndex {
    pub fetched_at: Instant,
    pub names: HashMap<String, Option<String>>,
    pub nodes_partial: bool,
    pub channels: Vec<IndexedPublicChannel>,
    pub channels_partial: bool,
}

impl GraphIndex {
    pub fn graph_partial(&self) -> bool {
        self.nodes_partial || self.channels_partial
    }
}

pub fn clean_node_name(name: Option<&str>) -> Option<String> {
    name.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub fn truncate_pubkey(pubkey: &str) -> String {
    if pubkey.len() <= 14 {
        return pubkey.to_string();
    }
    format!("{}…{}", &pubkey[..6], &pubkey[pubkey.len() - 4..])
}

pub fn node_display_label(is_self: bool, node_name: Option<&str>, pubkey: &str) -> String {
    if is_self {
        return "You".to_string();
    }
    if let Some(name) = clean_node_name(node_name) {
        return name;
    }
    truncate_pubkey(pubkey)
}

pub async fn cached_graph_index(
    cache: &Mutex<Option<GraphIndex>>,
    force_refresh: bool,
) -> Result<GraphIndex, RpcError> {
    if !force_refresh {
        let guard = cache.lock().await;
        if let Some(index) = guard.as_ref() {
            if index.fetched_at.elapsed() < GRAPH_CACHE_TTL {
                return Ok(index.clone());
            }
        }
    }

    let index = fetch_graph_index().await?;
    let mut guard = cache.lock().await;
    *guard = Some(index.clone());
    Ok(index)
}

async fn fetch_graph_index() -> Result<GraphIndex, RpcError> {
    let node_info = rpc::fetch_node_info().await?;
    let catalog = assets::build_asset_catalog(&node_info);
    let (nodes, nodes_partial) = collect_nodes().await?;
    let (channels, channels_partial) = collect_channels(&catalog).await?;

    Ok(GraphIndex {
        fetched_at: Instant::now(),
        names: index_node_names(&nodes),
        nodes_partial,
        channels,
        channels_partial,
    })
}

fn index_node_names(nodes: &[GraphNode]) -> HashMap<String, Option<String>> {
    let mut names = HashMap::new();
    for node in nodes {
        let key = normalize_pubkey(&node.pubkey);
        if key.is_empty() {
            continue;
        }
        let cleaned = clean_node_name(node.node_name.as_deref());
        names
            .entry(key)
            .and_modify(|existing: &mut Option<String>| {
                if existing.is_none() {
                    *existing = cleaned.clone();
                }
            })
            .or_insert(cleaned);
    }
    names
}

fn index_channel(
    channel: &GraphChannelInfo,
    catalog: &[AssetView],
) -> Option<IndexedPublicChannel> {
    if channel.node1.trim().is_empty() || channel.node2.trim().is_empty() {
        return None;
    }
    let asset = assets::asset_for_channel_funding(catalog, channel.udt_type_script.as_ref());
    Some(IndexedPublicChannel {
        node1: channel.node1.clone(),
        node2: channel.node2.clone(),
        asset_symbol: asset.symbol,
        decimals: asset.decimals,
        capacity_raw: rpc::parse_hex_u128(&channel.capacity).unwrap_or(0),
    })
}

async fn collect_nodes() -> Result<(Vec<GraphNode>, bool), RpcError> {
    let mut items = Vec::new();
    let mut after: Option<String> = None;
    for _ in 0..GRAPH_MAX_PAGES {
        let page = rpc::fetch_graph_nodes_page(GRAPH_PAGE_LIMIT, after.as_deref()).await?;
        let page_len = page.items.len();
        items.extend(page.items);
        if page_len < GRAPH_PAGE_LIMIT as usize {
            return Ok((items, false));
        }
        let Some(next) = page.last_cursor.filter(|cursor| !cursor.is_empty()) else {
            return Ok((items, false));
        };
        if after.as_deref() == Some(next.as_str()) {
            return Ok((items, true));
        }
        after = Some(next);
    }
    Ok((items, true))
}

async fn collect_channels(
    catalog: &[AssetView],
) -> Result<(Vec<IndexedPublicChannel>, bool), RpcError> {
    let mut items = Vec::new();
    let mut after: Option<String> = None;
    for _ in 0..GRAPH_MAX_PAGES {
        let page = rpc::fetch_graph_channels_page(GRAPH_PAGE_LIMIT, after.as_deref()).await?;
        let page_len = page.items.len();
        items.extend(
            page.items
                .iter()
                .filter_map(|channel| index_channel(channel, catalog)),
        );
        if page_len < GRAPH_PAGE_LIMIT as usize {
            return Ok((items, false));
        }
        let Some(next) = page.last_cursor.filter(|cursor| !cursor.is_empty()) else {
            return Ok((items, false));
        };
        if after.as_deref() == Some(next.as_str()) {
            return Ok((items, true));
        }
        after = Some(next);
    }
    Ok((items, true))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_self_known_name_and_unknown_pubkey() {
        let self_pubkey = "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let alice = "03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        let unknown = "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

        assert_eq!(node_display_label(true, Some("Studio"), self_pubkey), "You");
        assert_eq!(node_display_label(false, Some("Alice"), alice), "Alice");
        assert_eq!(
            node_display_label(false, None, unknown),
            truncate_pubkey(unknown)
        );
    }

    #[test]
    fn blank_announced_name_falls_back_to_pubkey() {
        let pubkey = "03dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        assert_eq!(
            node_display_label(false, Some("   "), pubkey),
            truncate_pubkey(pubkey)
        );
    }
}
