use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::channel::{
    self, count_active_channels, map_channels, sum_local_balances, sum_total_capacity,
    HomeChannel,
};
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::peer_connect;
use crate::fnn::rpc::{self, CkbScript};
use crate::fnn::studio;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelsPageResponse {
    pub available: bool,
    pub channels: Vec<HomeChannel>,
    pub active_channel_count: u32,
    pub total_capacity: String,
    pub total_local_balance: String,
    pub network: Option<String>,
    pub default_funding_lock_script: Option<CkbScript>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelPayload {
    pub pubkey: String,
    pub funding_ckb: u64,
    pub is_public: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelResult {
    pub channel_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShutdownChannelPayload {
    pub channel_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerOpenChannelPolicy {
    pub pubkey: String,
    pub min_funding_ckb: Option<u64>,
    pub known: bool,
    pub recommended_funding_ckb: u64,
}

#[tauri::command]
pub async fn get_peer_open_channel_policy(
    state: State<'_, AppState>,
    pubkey: String,
) -> Result<PeerOpenChannelPolicy, String> {
    let pubkey = pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before opening a channel.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let saved_multiaddr = if peer_connect::pubkeys_equal(
        pubkey,
        studio_metadata.custom_public_node_pubkey.trim(),
    ) {
        studio_metadata.custom_public_node_multiaddr.trim()
    } else {
        ""
    };

    let _ = peer_connect::ensure_peer_connected(pubkey, saved_multiaddr)
        .await
        .map_err(|error| error.to_string())?;

    let min_funding_ckb = peer_connect::lookup_peer_auto_accept_min_ckb(pubkey).await;
    let known = min_funding_ckb.is_some();
    let recommended_funding_ckb = channel::recommended_funding_ckb(min_funding_ckb);

    Ok(PeerOpenChannelPolicy {
        pubkey: pubkey.to_string(),
        min_funding_ckb,
        known,
        recommended_funding_ckb,
    })
}

#[tauri::command]
pub async fn get_channels_page(
    state: State<'_, AppState>,
) -> Result<ChannelsPageResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(ChannelsPageResponse {
            available: false,
            channels: Vec::new(),
            active_channel_count: 0,
            total_capacity: "0".to_string(),
            total_local_balance: "0".to_string(),
            network: None,
            default_funding_lock_script: None,
        });
    }

    let data_directory = manager.data_directory().cloned();
    drop(manager);

    let studio_metadata = data_directory
        .as_ref()
        .and_then(|path| studio::read_studio_metadata(path).ok());

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let channels = rpc::fetch_list_channels()
        .await
        .map_err(|error| error.to_string())?;

    let active_channel_count = count_active_channels(&channels);
    let total_capacity = sum_total_capacity(&channels);
    let total_local_balance = sum_local_balances(&channels);

    Ok(ChannelsPageResponse {
        available: true,
        channels: map_channels(channels),
        active_channel_count,
        total_capacity: total_capacity.to_string(),
        total_local_balance: total_local_balance.to_string(),
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        default_funding_lock_script: Some(node_info.default_funding_lock_script),
    })
}

#[tauri::command]
pub async fn open_channel(
    state: State<'_, AppState>,
    payload: OpenChannelPayload,
) -> Result<OpenChannelResult, String> {
    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    if payload.funding_ckb == 0 {
        return Err("Channel capacity must be at least 1 CKB.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before opening a channel.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let saved_multiaddr = if peer_connect::pubkeys_equal(
        pubkey,
        studio_metadata.custom_public_node_pubkey.trim(),
    ) {
        studio_metadata.custom_public_node_multiaddr.trim()
    } else {
        ""
    };

    let connect_status = peer_connect::ensure_peer_connected(pubkey, saved_multiaddr)
        .await
        .map_err(|error| error.to_string())?;

    if connect_status == peer_connect::RelayConnectStatus::Failed {
        return Err(
            "Could not connect to peer. Ensure the peer is online and reachable.".to_string(),
        );
    }

    if let Some(min_funding_ckb) = peer_connect::lookup_peer_auto_accept_min_ckb(pubkey).await {
        if payload.funding_ckb < min_funding_ckb {
            return Err(format!(
                "This peer requires at least {min_funding_ckb} CKB to auto-accept a channel. Increase the capacity or the channel may stay pending until manually accepted."
            ));
        }
    }

    let funding_amount = channel::ckb_to_shannons_hex(payload.funding_ckb);
    let channel_id = rpc::open_channel(pubkey, &funding_amount, payload.is_public)
        .await
        .map_err(|error| error.to_string())?;

    Ok(OpenChannelResult { channel_id })
}

#[tauri::command]
pub async fn shutdown_channel(
    state: State<'_, AppState>,
    payload: ShutdownChannelPayload,
) -> Result<(), String> {
    let channel_id = payload.channel_id.trim();
    if channel_id.is_empty() {
        return Err("Channel ID is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before closing a channel.".to_string());
    }
    drop(manager);

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;

    rpc::shutdown_channel(channel_id, &node_info.default_funding_lock_script)
        .await
        .map_err(|error| error.to_string())
}
