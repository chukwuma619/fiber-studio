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
use crate::fnn::studio;
use crate::state::AppState;

use super::channels::fetch_wallet_balance_for_network;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectedPeer {
    pub pubkey: String,
    pub address: String,
    pub is_configured: bool,
    pub is_official_relay: bool,
    pub is_bootnode: bool,
    pub channel_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkPageResponse {
    pub available: bool,
    pub network: Option<String>,
    pub node_pubkey: Option<String>,
    pub connection_mode: String,
    pub configured_peer_pubkey: Option<String>,
    pub configured_peer_multiaddr: Option<String>,
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
    pub has_channel_to_configured_peer: bool,
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
    pub is_configured: bool,
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
pub struct SetConfiguredPeerPayload {
    pub pubkey: String,
    #[serde(default)]
    pub multiaddr: Option<String>,
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
        connection_mode: "custom-public-node".to_string(),
        configured_peer_pubkey: None,
        configured_peer_multiaddr: None,
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
        has_channel_to_configured_peer: false,
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

    let configured_peer_pubkey = studio_metadata
        .as_ref()
        .map(|metadata| metadata.custom_public_node_pubkey.clone())
        .filter(|pubkey| !pubkey.trim().is_empty());

    let configured_peer_multiaddr = studio_metadata
        .as_ref()
        .map(|metadata| metadata.custom_public_node_multiaddr.clone())
        .filter(|address| !address.trim().is_empty());

    let configured_pubkey_str = configured_peer_pubkey.as_deref().unwrap_or("");

    let relay_status = if configured_pubkey_str.is_empty() {
        "not_configured".to_string()
    } else {
        peer_connect::relay_status_for_configured_peer(
            &peers,
            configured_pubkey_str,
            &manager_relay_status,
        )
    };

    let connection_mode =
        relays::connection_mode_for_pubkey(network, configured_pubkey_str).to_string();

    let min_funding_ckb =
        min_funding_ckb_for_open(&node_info.open_channel_auto_accept_min_ckb_funding_amount);

    let has_channel_to_configured_peer = configured_peer_pubkey
        .as_deref()
        .map(|pubkey| has_active_or_pending_channel_to_peer(&channels, pubkey))
        .unwrap_or(false);

    let relay_entries: Vec<NetworkRelayEntry> = relays::relays_for_network(network)
        .into_iter()
        .map(|relay| {
            let connected = peer_is_connected(&peers, &relay.pubkey);
            let channel_count = count_channels_to_peer(&channels, &relay.pubkey);
            let has_active_or_pending_channel =
                has_active_or_pending_channel_to_peer(&channels, &relay.pubkey);
            let is_configured = configured_peer_pubkey
                .as_deref()
                .map(|pubkey| peer_connect::pubkeys_equal(pubkey, &relay.pubkey))
                .unwrap_or(false);

            NetworkRelayEntry {
                id: relay.id,
                pubkey: relay.pubkey,
                multiaddr: relay.multiaddr,
                connected,
                channel_count,
                has_active_or_pending_channel,
                is_configured,
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
            let is_configured = configured_peer_pubkey
                .as_deref()
                .map(|pubkey| peer_connect::pubkeys_equal(pubkey, &peer.pubkey))
                .unwrap_or(false);
            NetworkConnectedPeer {
                pubkey: peer.pubkey.clone(),
                address: peer.address.clone(),
                is_configured,
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
        connection_mode,
        configured_peer_pubkey,
        configured_peer_multiaddr,
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
        has_channel_to_configured_peer,
    })
}

#[tauri::command]
pub async fn connect_peer(
    state: State<'_, AppState>,
    payload: ConnectPeerPayload,
) -> Result<PeerConnectResult, String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before connecting to a peer.".to_string());
    }
    drop(manager);

    let multiaddr = payload.multiaddr.unwrap_or_default();
    let status = peer_connect::ensure_peer_connected(pubkey, multiaddr.trim())
        .await
        .map_err(|error| error.to_string())?;

    Ok(PeerConnectResult {
        status: connect_status_label(status).to_string(),
    })
}

#[tauri::command]
pub async fn set_configured_peer(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: SetConfiguredPeerPayload,
) -> Result<PeerConnectResult, String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err(
            "Node is not running. Start your node before changing the configured peer.".to_string(),
        );
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
            "Bootnodes are for network discovery only and cannot be set as your primary peer."
                .to_string(),
        );
    }

    let mut manager = state.fnn.lock().await;

    studio_metadata.custom_public_node_pubkey = pubkey.to_string();
    studio_metadata.custom_public_node_multiaddr = payload
        .multiaddr
        .map(|value| value.trim().to_string())
        .unwrap_or_default();

    studio::write_studio_metadata(&data_directory, &studio_metadata)
        .map_err(|error| format!("Failed to write studio metadata: {error}"))?;

    manager.restart_relay_connect_loop(&app);
    drop(manager);

    let multiaddr = studio_metadata.custom_public_node_multiaddr.trim();
    let status = peer_connect::ensure_peer_connected(pubkey, multiaddr)
        .await
        .map_err(|error| error.to_string())?;

    Ok(PeerConnectResult {
        status: connect_status_label(status).to_string(),
    })
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
