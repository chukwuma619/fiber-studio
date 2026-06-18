use serde::Serialize;
use tauri::{AppHandle, State};

use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::peer_connect;
use crate::fnn::rpc::{
    self, Channel, NodeInfo, PaymentSummary, PeerInfo, is_channel_ready, parse_hex_u128,
};
use crate::fnn::studio;
use crate::state::AppState;

const HOME_CHANNEL_LIMIT: usize = 5;
const HOME_PAYMENT_LIMIT: u32 = 5;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeDashboardResponse {
    pub available: bool,
    pub node_info: Option<HomeNodeInfo>,
    pub channels: Vec<HomeChannel>,
    pub peers: Vec<HomePeer>,
    pub payments: Vec<HomePayment>,
    pub total_local_balance: String,
    pub configured_relay_pubkey: Option<String>,
    pub configured_relay_multiaddr: Option<String>,
    pub network: Option<String>,
    pub relay_status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeNodeInfo {
    pub version: String,
    pub pubkey: String,
    pub node_name: Option<String>,
    pub channel_count: u32,
    pub pending_channel_count: u32,
    pub peers_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeChannel {
    pub channel_id: String,
    pub pubkey: String,
    pub is_public: bool,
    pub state: String,
    pub local_balance: String,
    pub remote_balance: String,
    pub local_percent: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomePeer {
    pub pubkey: String,
    pub address: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomePayment {
    pub payment_hash: String,
    pub status: String,
    pub created_at: u64,
    pub last_updated_at: u64,
    pub failed_error: Option<String>,
    pub fee: String,
}

#[tauri::command]
pub async fn get_home_dashboard(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<HomeDashboardResponse, String> {
    let mut manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(HomeDashboardResponse {
            available: false,
            node_info: None,
            channels: Vec::new(),
            peers: Vec::new(),
            payments: Vec::new(),
            total_local_balance: "0".to_string(),
            configured_relay_pubkey: None,
            configured_relay_multiaddr: None,
            network: None,
            relay_status: "not_configured".to_string(),
        });
    }

    manager.ensure_relay_connect_loop(&app);

    let data_directory = manager.data_directory().cloned();
    let manager_relay_status = manager.relay_state().status;
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
    let peers = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;
    let payments = rpc::fetch_list_payments(HOME_PAYMENT_LIMIT)
        .await
        .map_err(|error| error.to_string())?;

    let total_local_balance = sum_local_balances(&channels);
    let home_channels = select_home_channels(channels);

    let relay_status = relay_status_from_peers(
        &peers,
        studio_metadata.as_ref(),
        &manager_relay_status,
    );

    Ok(HomeDashboardResponse {
        available: true,
        node_info: Some(to_home_node_info(node_info)),
        channels: home_channels,
        peers: peers.into_iter().map(to_home_peer).collect(),
        payments: payments.into_iter().map(to_home_payment).collect(),
        total_local_balance: total_local_balance.to_string(),
        configured_relay_pubkey: studio_metadata
            .as_ref()
            .map(|metadata| metadata.custom_public_node_pubkey.clone())
            .filter(|pubkey| !pubkey.trim().is_empty()),
        configured_relay_multiaddr: studio_metadata
            .as_ref()
            .map(|metadata| metadata.custom_public_node_multiaddr.clone())
            .filter(|address| !address.trim().is_empty()),
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        relay_status,
    })
}

fn relay_status_from_peers(
    peers: &[PeerInfo],
    metadata: Option<&studio::StudioMetadata>,
    manager_relay_status: &str,
) -> String {
    let Some(metadata) = metadata else {
        return "not_configured".to_string();
    };

    let configured_pubkey = metadata.custom_public_node_pubkey.trim();
    if configured_pubkey.is_empty() {
        return "not_configured".to_string();
    }

    if peers
        .iter()
        .any(|peer| peer_connect::pubkeys_equal(&peer.pubkey, configured_pubkey))
    {
        return "connected".to_string();
    }

    manager_relay_status.to_string()
}

fn to_home_node_info(info: NodeInfo) -> HomeNodeInfo {
    HomeNodeInfo {
        version: info.version,
        pubkey: info.pubkey,
        node_name: info.node_name,
        channel_count: parse_hex_u32(&info.channel_count),
        pending_channel_count: parse_hex_u32(&info.pending_channel_count),
        peers_count: parse_hex_u32(&info.peers_count),
    }
}

fn parse_hex_u32(hex: &str) -> u32 {
    parse_hex_u128(hex).unwrap_or(0).min(u32::MAX as u128) as u32
}

fn sum_local_balances(channels: &[Channel]) -> u128 {
    channels
        .iter()
        .filter(|channel| is_channel_ready(&channel.state))
        .filter_map(|channel| parse_hex_u128(&channel.local_balance))
        .sum()
}

fn select_home_channels(mut channels: Vec<Channel>) -> Vec<HomeChannel> {
    channels.sort_by(|left, right| {
        let left_ready = is_channel_ready(&left.state);
        let right_ready = is_channel_ready(&right.state);
        right_ready
            .cmp(&left_ready)
            .then_with(|| left.pubkey.cmp(&right.pubkey))
    });

    channels
        .into_iter()
        .take(HOME_CHANNEL_LIMIT)
        .map(to_home_channel)
        .collect()
}

fn to_home_channel(channel: Channel) -> HomeChannel {
    let local = parse_hex_u128(&channel.local_balance).unwrap_or(0);
    let remote = parse_hex_u128(&channel.remote_balance).unwrap_or(0);
    let total = local.saturating_add(remote);
    let local_percent = if total == 0 {
        0
    } else {
        ((local * 100) / total).min(100) as u8
    };

    HomeChannel {
        channel_id: channel.channel_id,
        pubkey: channel.pubkey,
        is_public: channel.is_public,
        state: rpc::channel_state_label(&channel.state),
        local_balance: channel.local_balance,
        remote_balance: channel.remote_balance,
        local_percent,
    }
}

fn to_home_peer(peer: PeerInfo) -> HomePeer {
    HomePeer {
        pubkey: peer.pubkey,
        address: peer.address,
    }
}

fn to_home_payment(payment: PaymentSummary) -> HomePayment {
    HomePayment {
        payment_hash: payment.payment_hash,
        status: payment.status,
        created_at: payment.created_at,
        last_updated_at: payment.last_updated_at,
        failed_error: payment.failed_error,
        fee: payment.fee,
    }
}
