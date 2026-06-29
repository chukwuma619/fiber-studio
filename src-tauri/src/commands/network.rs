use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::fnn::bootnodes;
use crate::fnn::channel::{
    self, has_active_or_pending_channel_to_peer, min_funding_ckb_for_open,
};
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::peer_connect::{self, RelayConnectStatus};
use crate::fnn::relays;
use crate::fnn::rpc::{self, Channel, PeerInfo};
use crate::fnn::studio::{self, SavedPeer};
use crate::state::AppState;

use super::channels::fetch_wallet_balance_for_network;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectedPeer {
    pub pubkey: String,
    pub address: String,
    pub is_saved: bool,
    pub is_official_relay: bool,
    pub is_bootnode: bool,
    pub channel_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSavedPeerEntry {
    pub pubkey: String,
    pub multiaddr: Option<String>,
    pub connected: bool,
    pub channel_count: u32,
    pub has_active_or_pending_channel: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkPageResponse {
    pub available: bool,
    pub network: Option<String>,
    pub node_pubkey: Option<String>,
    pub saved_peers: Vec<NetworkSavedPeerEntry>,
    pub saved_peer_connected_count: u32,
    pub relay_status: String,
    pub graph_node_count: u32,
    pub graph_ready: bool,
    pub connected_peer_count: u32,
    pub relays: Vec<NetworkRelayEntry>,
    pub connected_peers: Vec<NetworkConnectedPeer>,
    pub custom_peers: Vec<NetworkCustomPeer>,
    pub on_chain_wallet_ckb: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_chain_wallet_error: Option<String>,
    pub min_funding_ckb: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkRelayEntry {
    pub id: String,
    pub pubkey: String,
    pub multiaddr: Option<String>,
    pub connected: bool,
    pub channel_count: u32,
    pub has_active_or_pending_channel: bool,
    pub is_saved: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkCustomPeer {
    pub pubkey: String,
    pub address: String,
    pub channel_count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectPeerPayload {
    pub pubkey: String,
    #[serde(default)]
    pub multiaddr: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerConnectResult {
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddSavedPeerPayload {
    pub pubkey: String,
    #[serde(default)]
    pub multiaddr: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveSavedPeerPayload {
    pub pubkey: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectPeerPayload {
    pub pubkey: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetNetworkGraphPayload {
    pub kind: String,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub after: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkGraphNodeEntry {
    pub pubkey: String,
    pub node_name: Option<String>,
    pub address_count: u32,
    pub primary_address: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkGraphChannelEntry {
    pub channel_outpoint: String,
    pub node1: String,
    pub node2: String,
    pub capacity_ckb: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkGraphResponse {
    pub kind: String,
    pub nodes: Vec<NetworkGraphNodeEntry>,
    pub channels: Vec<NetworkGraphChannelEntry>,
    pub last_cursor: Option<String>,
    pub has_more: bool,
}

fn network_page_unavailable() -> NetworkPageResponse {
    NetworkPageResponse {
        available: false,
        network: None,
        node_pubkey: None,
        saved_peers: Vec::new(),
        saved_peer_connected_count: 0,
        relay_status: "not_configured".to_string(),
        graph_node_count: 0,
        graph_ready: false,
        connected_peer_count: 0,
        relays: Vec::new(),
        connected_peers: Vec::new(),
        custom_peers: Vec::new(),
        on_chain_wallet_ckb: None,
        on_chain_wallet_error: None,
        min_funding_ckb: channel::CHANNEL_OPEN_MIN_FUNDING_CKB,
    }
}

fn peer_is_connected(peers: &[PeerInfo], pubkey: &str) -> bool {
    peers
        .iter()
        .any(|peer| peer_connect::pubkeys_equal(&peer.pubkey, pubkey))
}

fn count_channels_to_peer(channels: &[Channel], pubkey: &str) -> u32 {
    channels
        .iter()
        .filter(|channel| peer_connect::pubkeys_equal(&channel.pubkey, pubkey))
        .count() as u32
}

fn connect_status_label(status: RelayConnectStatus) -> &'static str {
    match status {
        RelayConnectStatus::AlreadyConnected | RelayConnectStatus::Connected => "connected",
        RelayConnectStatus::Connecting => "connecting",
        RelayConnectStatus::Failed => "failed",
        RelayConnectStatus::NotConfigured => "not_configured",
    }
}

fn build_saved_peer_entry(
    saved_peer: &SavedPeer,
    peers: &[PeerInfo],
    channels: &[Channel],
) -> NetworkSavedPeerEntry {
    let connected = peer_is_connected(peers, &saved_peer.pubkey);
    let channel_count = count_channels_to_peer(channels, &saved_peer.pubkey);
    let has_active_or_pending_channel =
        has_active_or_pending_channel_to_peer(channels, &saved_peer.pubkey);
    let multiaddr = saved_peer.multiaddr.trim();
    NetworkSavedPeerEntry {
        pubkey: saved_peer.pubkey.clone(),
        multiaddr: if multiaddr.is_empty() {
            None
        } else {
            Some(multiaddr.to_string())
        },
        connected,
        channel_count,
        has_active_or_pending_channel,
    }
}

#[tauri::command]
pub async fn get_network_page(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<NetworkPageResponse, String> {
    let mut manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(network_page_unavailable());
    }

    manager.ensure_relay_connect_loop(&app);

    let data_directory = manager.data_directory().cloned();
    let manager_relay_status = manager.relay_state().status;
    drop(manager);

    let studio_metadata = data_directory
        .as_ref()
        .and_then(|path| studio::read_studio_metadata(path).ok());

    let network = studio_metadata
        .as_ref()
        .map(|metadata| metadata.network.as_str())
        .unwrap_or("testnet");

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let channels = rpc::fetch_list_channels()
        .await
        .map_err(|error| error.to_string())?;
    let peers = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;
    let graph_nodes = rpc::fetch_graph_nodes()
        .await
        .map_err(|error| error.to_string())?;

    let saved_peers = studio_metadata
        .as_ref()
        .map(|metadata| metadata.saved_peers.as_slice())
        .unwrap_or(&[]);

    let relay_status = peer_connect::relay_status_for_saved_peers(
        &peers,
        saved_peers,
        &manager_relay_status,
    );

    let saved_peer_entries: Vec<NetworkSavedPeerEntry> = saved_peers
        .iter()
        .map(|peer| build_saved_peer_entry(peer, &peers, &channels))
        .collect();

    let saved_peer_connected_count = saved_peer_entries
        .iter()
        .filter(|entry| entry.connected)
        .count() as u32;

    let min_funding_ckb =
        min_funding_ckb_for_open(&node_info.open_channel_auto_accept_min_ckb_funding_amount);

    let relay_entries: Vec<NetworkRelayEntry> = relays::relays_for_network(network)
        .into_iter()
        .map(|relay| {
            let connected = peer_is_connected(&peers, &relay.pubkey);
            let channel_count = count_channels_to_peer(&channels, &relay.pubkey);
            let has_active_or_pending_channel =
                has_active_or_pending_channel_to_peer(&channels, &relay.pubkey);
            let is_saved = saved_peers
                .iter()
                .any(|peer| peer_connect::pubkeys_equal(&peer.pubkey, &relay.pubkey));

            NetworkRelayEntry {
                id: relay.id,
                pubkey: relay.pubkey,
                multiaddr: relay.multiaddr,
                connected,
                channel_count,
                has_active_or_pending_channel,
                is_saved,
            }
        })
        .collect();

    let custom_peers: Vec<NetworkCustomPeer> = peers
        .iter()
        .filter(|peer| !relays::is_official_relay_pubkey(network, &peer.pubkey))
        .map(|peer| NetworkCustomPeer {
            pubkey: peer.pubkey.clone(),
            address: peer.address.clone(),
            channel_count: count_channels_to_peer(&channels, &peer.pubkey),
        })
        .collect();

    let connected_peers: Vec<NetworkConnectedPeer> = peers
        .iter()
        .map(|peer| {
            let is_official_relay = relays::is_official_relay_pubkey(network, &peer.pubkey);
            let is_bootnode = bootnodes::is_bootnode_peer(network, &peer.address);
            let is_saved = saved_peers
                .iter()
                .any(|saved| peer_connect::pubkeys_equal(&saved.pubkey, &peer.pubkey));
            NetworkConnectedPeer {
                pubkey: peer.pubkey.clone(),
                address: peer.address.clone(),
                is_saved,
                is_official_relay,
                is_bootnode,
                channel_count: count_channels_to_peer(&channels, &peer.pubkey),
            }
        })
        .collect();

    let connected_peer_count = connected_peers.len() as u32;

    let (on_chain_wallet_ckb, on_chain_wallet_error) =
        match studio_metadata.as_ref().map(|metadata| metadata.network.as_str()) {
            Some(network) => match fetch_wallet_balance_for_network(network).await {
                Ok(balance) => (Some(balance.available_ckb), None),
                Err(error) => (None, Some(error)),
            },
            None => (None, Some("Network is not configured.".to_string())),
        };

    let graph_node_count = graph_nodes.len() as u32;
    let graph_ready = graph_node_count > 0;

    Ok(NetworkPageResponse {
        available: true,
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        node_pubkey: Some(node_info.pubkey),
        saved_peers: saved_peer_entries,
        saved_peer_connected_count,
        relay_status,
        graph_node_count,
        graph_ready,
        connected_peer_count,
        relays: relay_entries,
        connected_peers,
        custom_peers,
        on_chain_wallet_ckb,
        on_chain_wallet_error,
        min_funding_ckb,
    })
}

async fn upsert_and_connect_saved_peer(
    app: &AppHandle,
    state: &State<'_, AppState>,
    pubkey: &str,
    multiaddr: Option<String>,
) -> Result<PeerConnectResult, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before saving a peer.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let mut studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let peers = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;

    if bootnodes::is_bootnode_pubkey(&studio_metadata.network, &peers, pubkey) {
        return Err(
            "Bootnodes are for network discovery only and cannot be saved as peers.".to_string(),
        );
    }

    let multiaddr_value = multiaddr
        .map(|value| value.trim().to_string())
        .unwrap_or_default();

    if studio_metadata.has_saved_peer(pubkey) {
        if let Some(peer) = studio_metadata.find_saved_peer_mut(pubkey) {
            if !multiaddr_value.is_empty() {
                peer.multiaddr = multiaddr_value.clone();
            }
        }
    } else {
        studio_metadata.saved_peers.push(SavedPeer {
            pubkey: pubkey.to_string(),
            multiaddr: multiaddr_value.clone(),
        });
    }

    studio_metadata.normalize_saved_peers();

    studio::write_studio_metadata(&data_directory, &studio_metadata)
        .map_err(|error| format!("Failed to write studio metadata: {error}"))?;

    let saved_multiaddr = studio_metadata
        .find_saved_peer(pubkey)
        .map(|peer| peer.multiaddr.as_str())
        .unwrap_or("");
    let status = peer_connect::ensure_peer_connected(pubkey, saved_multiaddr)
        .await
        .map_err(|error| error.to_string())?;

    let mut manager = state.fnn.lock().await;
    manager.restart_relay_connect_loop(app);
    drop(manager);

    Ok(PeerConnectResult {
        status: connect_status_label(status).to_string(),
    })
}

#[tauri::command]
pub async fn connect_peer(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: ConnectPeerPayload,
) -> Result<PeerConnectResult, String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    upsert_and_connect_saved_peer(&app, &state, pubkey, payload.multiaddr).await
}

#[tauri::command]
pub async fn add_saved_peer(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: AddSavedPeerPayload,
) -> Result<PeerConnectResult, String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    upsert_and_connect_saved_peer(&app, &state, pubkey, payload.multiaddr).await
}

#[tauri::command]
pub async fn remove_saved_peer(
    state: State<'_, AppState>,
    payload: RemoveSavedPeerPayload,
) -> Result<(), String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before removing a saved peer.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let mut studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    if studio_metadata.saved_peers.len() <= 1 {
        return Err("At least one saved peer is required.".to_string());
    }

    let before_len = studio_metadata.saved_peers.len();
    studio_metadata.saved_peers.retain(|peer| !peer_connect::pubkeys_equal(&peer.pubkey, pubkey));
    if studio_metadata.saved_peers.len() == before_len {
        return Err("Peer is not in your saved peer list.".to_string());
    }

    studio_metadata.normalize_saved_peers();

    studio::write_studio_metadata(&data_directory, &studio_metadata)
        .map_err(|error| format!("Failed to write studio metadata: {error}"))?;

    rpc::disconnect_peer(pubkey)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn disconnect_peer(
    state: State<'_, AppState>,
    payload: DisconnectPeerPayload,
) -> Result<(), String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before disconnecting a peer.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let peers = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;

    if bootnodes::is_bootnode_pubkey(&studio_metadata.network, &peers, pubkey) {
        return Err(
            "Bootnodes are auto-connected for discovery and cannot be disconnected from Studio."
                .to_string(),
        );
    }

    if studio_metadata.has_saved_peer(pubkey) {
        return Err(
            "Saved peers must be removed from your saved list instead of disconnected.".to_string(),
        );
    }

    rpc::disconnect_peer(pubkey)
        .await
        .map_err(|error| error.to_string())
}

const DEFAULT_GRAPH_PAGE_LIMIT: u32 = 25;

fn graph_capacity_ckb(capacity: &str) -> String {
    let shannons = rpc::parse_hex_u128(capacity).unwrap_or(0);
    let ckb = shannons / channel::SHANNONS_PER_CKB;
    format!("{ckb}")
}

#[tauri::command]
pub async fn get_network_graph(
    state: State<'_, AppState>,
    payload: GetNetworkGraphPayload,
) -> Result<NetworkGraphResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node to browse the network graph.".to_string());
    }
    drop(manager);

    let limit = payload.limit.unwrap_or(DEFAULT_GRAPH_PAGE_LIMIT).clamp(1, 100);
    let after = payload.after.as_deref();

    match payload.kind.as_str() {
        "nodes" => {
            let page = rpc::fetch_graph_nodes_page(limit, after)
                .await
                .map_err(|error| error.to_string())?;
            let has_more = page.last_cursor.is_some();
            Ok(NetworkGraphResponse {
                kind: "nodes".to_string(),
                nodes: page
                    .items
                    .into_iter()
                    .map(|node| NetworkGraphNodeEntry {
                        primary_address: node.addresses.first().cloned(),
                        address_count: node.addresses.len() as u32,
                        pubkey: node.pubkey,
                        node_name: node.node_name,
                    })
                    .collect(),
                channels: Vec::new(),
                last_cursor: page.last_cursor,
                has_more,
            })
        }
        "channels" => {
            let page = rpc::fetch_graph_channels_page(limit, after)
                .await
                .map_err(|error| error.to_string())?;
            let has_more = page.last_cursor.is_some();
            Ok(NetworkGraphResponse {
                kind: "channels".to_string(),
                nodes: Vec::new(),
                channels: page
                    .items
                    .into_iter()
                    .map(|channel| NetworkGraphChannelEntry {
                        channel_outpoint: channel.channel_outpoint,
                        node1: channel.node1,
                        node2: channel.node2,
                        capacity_ckb: graph_capacity_ckb(&channel.capacity),
                    })
                    .collect(),
                last_cursor: page.last_cursor,
                has_more,
            })
        }
        other => Err(format!("Unknown graph kind: {other}. Use \"nodes\" or \"channels\".")),
    }
}
