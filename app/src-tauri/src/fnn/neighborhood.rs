use std::collections::HashMap;

use serde::Serialize;
use tokio::sync::Mutex;

use super::assets::{self, AssetView};
use super::channel;
use super::graph_index::{self, GraphIndex, IndexedPublicChannel};
use super::peer_connect::{self, normalize_pubkey};
use super::rpc::{self, RpcError};
use super::studio;

pub const NEIGHBOR_LINK_LIMIT: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OwnChannelInput {
    pub peer_pubkey: String,
    pub is_public: bool,
    pub asset_symbol: String,
    pub local_balance_display: String,
    pub remote_balance_display: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnChannelRow {
    pub asset_symbol: String,
    pub local_balance_display: String,
    pub remote_balance_display: String,
    pub is_public: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublicLink {
    pub pubkey: String,
    pub node_name: Option<String>,
    pub label: String,
    pub asset_symbol: String,
    pub channel_count: u32,
    pub capacity_display: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NeighborhoodPeer {
    pub pubkey: String,
    pub node_name: Option<String>,
    pub label: String,
    pub has_public_channel: bool,
    pub channels: Vec<OwnChannelRow>,
    pub public_links: Vec<PublicLink>,
    pub hidden_public_link_count: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedNode {
    pub pubkey: String,
    pub node_name: Option<String>,
    pub label: String,
    pub public_links: Vec<PublicLink>,
    pub hidden_public_link_count: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NeighborhoodResponse {
    pub self_pubkey: String,
    pub self_label: String,
    pub peers: Vec<NeighborhoodPeer>,
    pub expanded: Option<ExpandedNode>,
    pub graph_partial: bool,
}

pub async fn load_channel_neighborhood(
    cache: &Mutex<Option<GraphIndex>>,
    expand_pubkey: Option<&str>,
    refresh: bool,
    data_directory: Option<&std::path::Path>,
) -> Result<NeighborhoodResponse, RpcError> {
    let node_info = rpc::fetch_node_info().await?;
    let catalog = assets::build_asset_catalog(&node_info);
    let channels = rpc::fetch_list_channels().await?;
    let index = graph_index::cached_graph_index(cache, refresh).await?;
    let studio_metadata = data_directory.and_then(|path| studio::read_studio_metadata(path).ok());
    let protocol_known = studio_metadata
        .as_ref()
        .is_some_and(|metadata| metadata.channel_protocol_known());
    let own_channels = channels
        .into_iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .map(|channel| {
            let is_legacy = studio_metadata.as_ref().is_some_and(|metadata| {
                metadata.channel_is_legacy(&channel.channel_id, channel.created_at)
            });
            let view = channel::to_home_channel(channel, &catalog, is_legacy, protocol_known);
            OwnChannelInput {
                peer_pubkey: view.pubkey,
                is_public: view.is_public,
                asset_symbol: view.asset_symbol,
                local_balance_display: view.local_balance_display,
                remote_balance_display: view.remote_balance_display,
            }
        })
        .collect::<Vec<_>>();

    Ok(build_neighborhood(
        &node_info.pubkey,
        graph_index::clean_node_name(node_info.node_name.as_deref()).as_deref(),
        &index.names,
        &own_channels,
        &index.channels,
        expand_pubkey,
        index.graph_partial(),
    ))
}

pub fn build_neighborhood(
    self_pubkey: &str,
    self_name: Option<&str>,
    names: &HashMap<String, Option<String>>,
    own_channels: &[OwnChannelInput],
    public_channels: &[IndexedPublicChannel],
    expand_pubkey: Option<&str>,
    graph_partial: bool,
) -> NeighborhoodResponse {
    let mut grouped: HashMap<String, NeighborhoodPeer> = HashMap::new();

    for channel in own_channels {
        if channel.peer_pubkey.trim().is_empty()
            || peer_connect::pubkeys_equal(&channel.peer_pubkey, self_pubkey)
        {
            continue;
        }
        let key = normalize_pubkey(&channel.peer_pubkey);
        let peer = grouped.entry(key).or_insert_with(|| {
            let node_name = lookup_name(names, &channel.peer_pubkey);
            NeighborhoodPeer {
                label: graph_index::node_display_label(
                    false,
                    node_name.as_deref(),
                    &channel.peer_pubkey,
                ),
                pubkey: channel.peer_pubkey.clone(),
                node_name,
                has_public_channel: false,
                channels: Vec::new(),
                public_links: Vec::new(),
                hidden_public_link_count: 0,
            }
        });
        if channel.is_public {
            peer.has_public_channel = true;
        }
        peer.channels.push(OwnChannelRow {
            asset_symbol: channel.asset_symbol.clone(),
            local_balance_display: channel.local_balance_display.clone(),
            remote_balance_display: channel.remote_balance_display.clone(),
            is_public: channel.is_public,
        });
    }

    let mut peers = grouped.into_values().collect::<Vec<_>>();
    for peer in &mut peers {
        if !peer.has_public_channel {
            continue;
        }
        let (links, hidden) =
            public_links_for(&peer.pubkey, self_pubkey, self_name, names, public_channels);
        peer.public_links = links;
        peer.hidden_public_link_count = hidden;
    }
    peers.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
            .then_with(|| left.pubkey.cmp(&right.pubkey))
    });

    let expanded = expand_pubkey
        .map(str::trim)
        .filter(|pubkey| !pubkey.is_empty())
        .map(|pubkey| {
            let node_name = lookup_name(names, pubkey);
            let (links, hidden) =
                public_links_for(pubkey, self_pubkey, self_name, names, public_channels);
            ExpandedNode {
                label: graph_index::node_display_label(false, node_name.as_deref(), pubkey),
                pubkey: pubkey.to_string(),
                node_name,
                public_links: links,
                hidden_public_link_count: hidden,
            }
        });

    NeighborhoodResponse {
        self_pubkey: self_pubkey.to_string(),
        self_label: graph_index::node_display_label(true, self_name, self_pubkey),
        peers,
        expanded,
        graph_partial,
    }
}

fn lookup_name(names: &HashMap<String, Option<String>>, pubkey: &str) -> Option<String> {
    names
        .get(&normalize_pubkey(pubkey))
        .cloned()
        .flatten()
        .filter(|name| !name.trim().is_empty())
}

fn public_links_for(
    node_pubkey: &str,
    self_pubkey: &str,
    self_name: Option<&str>,
    names: &HashMap<String, Option<String>>,
    public_channels: &[IndexedPublicChannel],
) -> (Vec<PublicLink>, u32) {
    let mut grouped: HashMap<(String, String), LinkAccum> = HashMap::new();

    for channel in public_channels {
        let Some(other) = other_endpoint(channel, node_pubkey) else {
            continue;
        };
        if peer_connect::pubkeys_equal(&other, self_pubkey)
            || peer_connect::pubkeys_equal(&other, node_pubkey)
        {
            continue;
        }
        let key = (normalize_pubkey(&other), channel.asset_symbol.clone());
        let entry = grouped.entry(key).or_insert_with(|| LinkAccum {
            pubkey: other,
            asset_symbol: channel.asset_symbol.clone(),
            decimals: channel.decimals,
            channel_count: 0,
            capacity_raw: 0,
        });
        entry.channel_count = entry.channel_count.saturating_add(1);
        entry.capacity_raw = entry.capacity_raw.saturating_add(channel.capacity_raw);
    }

    let mut links = grouped
        .into_values()
        .map(|entry| {
            let node_name = if peer_connect::pubkeys_equal(&entry.pubkey, self_pubkey) {
                self_name.map(str::to_string)
            } else {
                lookup_name(names, &entry.pubkey)
            };
            let asset = AssetView {
                id: entry.asset_symbol.clone(),
                name: entry.asset_symbol.clone(),
                symbol: entry.asset_symbol.clone(),
                decimals: entry.decimals,
                udt_type_script: None,
            };
            PublicLink {
                label: graph_index::node_display_label(false, node_name.as_deref(), &entry.pubkey),
                pubkey: entry.pubkey,
                node_name,
                asset_symbol: entry.asset_symbol,
                channel_count: entry.channel_count,
                capacity_display: assets::format_amount_display(entry.capacity_raw, &asset),
            }
        })
        .collect::<Vec<_>>();

    links.sort_by(|left, right| {
        right
            .channel_count
            .cmp(&left.channel_count)
            .then_with(|| {
                left.label
                    .to_ascii_lowercase()
                    .cmp(&right.label.to_ascii_lowercase())
            })
            .then_with(|| left.pubkey.cmp(&right.pubkey))
    });

    let hidden = links.len().saturating_sub(NEIGHBOR_LINK_LIMIT) as u32;
    links.truncate(NEIGHBOR_LINK_LIMIT);
    (links, hidden)
}

fn other_endpoint(channel: &IndexedPublicChannel, node_pubkey: &str) -> Option<String> {
    if peer_connect::pubkeys_equal(&channel.node1, node_pubkey) {
        Some(channel.node2.clone())
    } else if peer_connect::pubkeys_equal(&channel.node2, node_pubkey) {
        Some(channel.node1.clone())
    } else {
        None
    }
}

struct LinkAccum {
    pubkey: String,
    asset_symbol: String,
    decimals: u8,
    channel_count: u32,
    capacity_raw: u128,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fnn::assets::CKB_DECIMALS;

    fn pubkey(seed: u8) -> String {
        format!("02{seed:02x}{}", "aa".repeat(31))
    }

    fn own(peer: &str, is_public: bool, local: &str, remote: &str) -> OwnChannelInput {
        OwnChannelInput {
            peer_pubkey: peer.to_string(),
            is_public,
            asset_symbol: "CKB".to_string(),
            local_balance_display: local.to_string(),
            remote_balance_display: remote.to_string(),
        }
    }

    fn public_channel(left: &str, right: &str, capacity_ckb: u128) -> IndexedPublicChannel {
        IndexedPublicChannel {
            node1: left.to_string(),
            node2: right.to_string(),
            asset_symbol: "CKB".to_string(),
            decimals: CKB_DECIMALS,
            capacity_raw: capacity_ckb.saturating_mul(100_000_000),
        }
    }

    #[test]
    fn groups_own_channels_and_hides_private_peer_links() {
        let self_pubkey = pubkey(1);
        let alice = pubkey(2);
        let carol = pubkey(3);
        let hub = pubkey(4);
        let names = HashMap::from([(normalize_pubkey(&alice), Some("Alice".to_string()))]);
        let response = build_neighborhood(
            &self_pubkey,
            Some("Studio"),
            &names,
            &[
                own(&alice, true, "2000 CKB", "8000 CKB"),
                own(&alice, true, "100 CKB", "50 CKB"),
                own(&carol, false, "10 CKB", "10 CKB"),
            ],
            &[
                public_channel(&alice, &hub, 50_000),
                public_channel(&carol, &hub, 1_000),
                public_channel(&alice, &self_pubkey, 10_000),
            ],
            None,
            false,
        );

        assert_eq!(response.self_label, "You");
        assert_eq!(response.peers.len(), 2);
        let alice_peer = response
            .peers
            .iter()
            .find(|peer| peer.label == "Alice")
            .expect("alice");
        assert_eq!(alice_peer.channels.len(), 2);
        assert_eq!(alice_peer.public_links.len(), 1);
        assert_eq!(alice_peer.public_links[0].capacity_display, "50000 CKB");
        assert!(alice_peer
            .public_links
            .iter()
            .all(|link| !peer_connect::pubkeys_equal(&link.pubkey, &self_pubkey)));

        let carol_peer = response
            .peers
            .iter()
            .find(|peer| peer_connect::pubkeys_equal(&peer.pubkey, &carol))
            .expect("carol");
        assert!(!carol_peer.has_public_channel);
        assert!(carol_peer.public_links.is_empty());
    }

    #[test]
    fn collapses_same_pair_and_caps_public_links() {
        let self_pubkey = pubkey(1);
        let alice = pubkey(2);
        let mut channels = vec![
            public_channel(&alice, &pubkey(10), 1),
            public_channel(&alice, &pubkey(10), 2),
        ];
        for seed in 11..20 {
            channels.push(public_channel(&alice, &pubkey(seed), 1));
        }

        let response = build_neighborhood(
            &self_pubkey,
            None,
            &HashMap::new(),
            &[own(&alice, true, "1 CKB", "1 CKB")],
            &channels,
            Some(&pubkey(10)),
            true,
        );

        let alice_peer = &response.peers[0];
        assert_eq!(alice_peer.public_links.len(), NEIGHBOR_LINK_LIMIT);
        assert_eq!(alice_peer.hidden_public_link_count, 2);
        let collapsed = alice_peer
            .public_links
            .iter()
            .find(|link| peer_connect::pubkeys_equal(&link.pubkey, &pubkey(10)))
            .expect("collapsed pair");
        assert_eq!(collapsed.channel_count, 2);
        assert_eq!(collapsed.capacity_display, "3 CKB");
        assert!(response.graph_partial);
        let expanded = response.expanded.expect("expanded node");
        assert!(peer_connect::pubkeys_equal(&expanded.pubkey, &pubkey(10)));
        assert_eq!(expanded.public_links.len(), 1);
        assert!(peer_connect::pubkeys_equal(
            &expanded.public_links[0].pubkey,
            &alice
        ));
    }
}
