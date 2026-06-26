use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::channel::{
    self, count_active_channels, count_pending_channels, map_channels, sum_local_balances,
    sum_total_capacity, HomeChannel,
};
use crate::fnn::ckb_indexer;
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
    pub pending_channel_count: u32,
    pub total_capacity: String,
    pub total_local_balance: String,
    pub on_chain_wallet_ckb: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_chain_wallet_error: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbandonChannelPayload {
    pub channel_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletBalanceResponse {
    pub available_ckb: u64,
    pub shannons: String,
}

async fn fetch_wallet_balance_for_network(network: &str) -> Result<WalletBalanceResponse, String> {
    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let rpc_url = ckb_indexer::ckb_rpc_url(network);
    let shannons = ckb_indexer::fetch_lock_script_capacity(
        rpc_url,
        &node_info.default_funding_lock_script,
    )
    .await
    .map_err(|error| format!("Failed to read on-chain wallet balance: {error}"))?;
    let available_ckb = (shannons / channel::SHANNONS_PER_CKB as u128) as u64;

    Ok(WalletBalanceResponse {
        available_ckb,
        shannons: format!("0x{shannons:x}"),
    })
}

#[tauri::command]
pub async fn get_wallet_balance(
    state: State<'_, AppState>,
) -> Result<WalletBalanceResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before checking wallet balance.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    fetch_wallet_balance_for_network(&studio_metadata.network).await
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
            pending_channel_count: 0,
            total_capacity: "0".to_string(),
            total_local_balance: "0".to_string(),
            on_chain_wallet_ckb: None,
            on_chain_wallet_error: None,
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
    let pending_channel_count = count_pending_channels(&channels);
    let total_capacity = sum_total_capacity(&channels);
    let total_local_balance = sum_local_balances(&channels);

    let (on_chain_wallet_ckb, on_chain_wallet_error) =
        match studio_metadata.as_ref().map(|metadata| metadata.network.as_str()) {
            Some(network) => match fetch_wallet_balance_for_network(network).await {
                Ok(balance) => (Some(balance.available_ckb), None),
                Err(error) => (None, Some(error)),
            },
            None => (None, Some("Network is not configured.".to_string())),
        };

    Ok(ChannelsPageResponse {
        available: true,
        channels: map_channels(channels),
        active_channel_count,
        pending_channel_count,
        total_capacity: total_capacity.to_string(),
        total_local_balance: total_local_balance.to_string(),
        on_chain_wallet_ckb,
        on_chain_wallet_error,
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

    if payload.funding_ckb < channel::CHANNEL_OPEN_MIN_FUNDING_CKB {
        return Err(format!(
            "Channel capacity must be at least {} CKB.",
            channel::CHANNEL_OPEN_MIN_FUNDING_CKB
        ));
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

    let required_ckb = channel::required_wallet_ckb_for_open(payload.funding_ckb);
    let wallet_balance =
        fetch_wallet_balance_for_network(&studio_metadata.network).await?;
    if wallet_balance.available_ckb < required_ckb {
        return Err(format!(
            "Insufficient on-chain CKB. Need at least {required_ckb} CKB ({} funding + {} reserve + {} fee buffer) but wallet has {} CKB.",
            payload.funding_ckb,
            channel::CHANNEL_RESERVE_CKB,
            channel::CHANNEL_OPEN_FEE_BUFFER_CKB,
            wallet_balance.available_ckb,
        ));
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

#[tauri::command]
pub async fn abandon_channel(
    state: State<'_, AppState>,
    payload: AbandonChannelPayload,
) -> Result<(), String> {
    let channel_id = payload.channel_id.trim();
    if channel_id.is_empty() {
        return Err("Channel ID is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before abandoning a channel.".to_string());
    }
    drop(manager);

    rpc::abandon_channel(channel_id)
        .await
        .map_err(|error| error.to_string())
}
