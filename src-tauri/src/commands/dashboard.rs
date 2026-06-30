use serde::Serialize;
use tauri::{AppHandle, State};

use crate::fnn::channel::{self, HomeChannel};
use crate::fnn::invoice_display::{self, InvoiceListItem};
use crate::fnn::invoices;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::payment_display::{self, PaymentListItem};
use crate::fnn::peer_connect;
use crate::fnn::rpc::{self, parse_hex_u128, Channel, NodeInfo};
use crate::fnn::sent_payments;
use crate::fnn::studio;
use crate::state::AppState;

const HOME_CHANNEL_LIMIT: usize = 5;
const HOME_PAYMENT_LIMIT: u32 = 5;
const HOME_INCOMING_PAID_LIMIT: usize = 5;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeDashboardResponse {
    pub available: bool,
    pub node_info: Option<HomeNodeInfo>,
    pub channels: Vec<HomeChannel>,
    pub payments: Vec<HomePayment>,
    pub incoming_invoices: Vec<HomeIncomingInvoice>,
    pub active_channel_count: u32,
    pub pending_channel_count: u32,
    pub total_local_balance: String,
    pub saved_peer_pubkeys: Vec<String>,
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
pub struct HomePayment {
    pub payment_hash: String,
    pub status: String,
    pub created_at: u64,
    pub last_updated_at: u64,
    pub failed_error: Option<String>,
    pub fee: String,
    pub payment_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_ckb: Option<String>,
    pub route_hops: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeIncomingInvoice {
    pub payment_hash: String,
    pub amount_ckb: String,
    pub note: String,
    pub status: String,
}

fn to_home_payment(item: PaymentListItem) -> HomePayment {
    HomePayment {
        payment_hash: item.payment_hash,
        status: item.status,
        created_at: item.created_at,
        last_updated_at: item.last_updated_at,
        failed_error: item.failed_error,
        fee: item.fee,
        payment_kind: item.payment_kind,
        amount_ckb: item.amount_ckb,
        route_hops: item.route_hops,
    }
}

fn to_home_incoming(item: InvoiceListItem) -> HomeIncomingInvoice {
    HomeIncomingInvoice {
        payment_hash: item.payment_hash,
        amount_ckb: item.amount_ckb,
        note: item.note,
        status: item.status,
    }
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
            payments: Vec::new(),
            incoming_invoices: Vec::new(),
            active_channel_count: 0,
            pending_channel_count: 0,
            total_local_balance: "0".to_string(),
            saved_peer_pubkeys: Vec::new(),
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

    let (node_info, channels, peers, payments) = tokio::join!(
        rpc::fetch_node_info(),
        rpc::fetch_list_channels(),
        rpc::fetch_list_peers(),
        rpc::fetch_list_payments(HOME_PAYMENT_LIMIT),
    );

    let node_info = node_info.map_err(|error| error.to_string())?;
    let channels = channels.map_err(|error| error.to_string())?;
    let peers = peers.map_err(|error| error.to_string())?;
    let payments = payments.map_err(|error| error.to_string())?;

    let stored_sent_payments = data_directory
        .as_ref()
        .map(|path| sent_payments::read_sent_payments(path).unwrap_or_default())
        .unwrap_or_default();

    let stored_invoices = data_directory
        .as_ref()
        .map(|path| invoices::read_invoices(path).unwrap_or_default())
        .unwrap_or_default();
    let invoice_items = invoice_display::build_invoice_list_items_with_limit(
        stored_invoices,
        Some(invoice_display::DASHBOARD_INVOICE_ENRICH_LIMIT),
    )
    .await;
    let incoming_invoices = invoice_display::select_incoming_invoices(
        &invoice_items,
        HOME_INCOMING_PAID_LIMIT,
    )
    .into_iter()
    .map(to_home_incoming)
    .collect();

    let active_channel_count = channel::count_active_channels(&channels);
    let pending_channel_count = channel::count_pending_channels(&channels);
    let total_local_balance = channel::sum_local_balances(&channels);
    let home_channels = select_home_channels(channels);

    let saved_peers = studio_metadata
        .as_ref()
        .map(|metadata| metadata.saved_peers.as_slice())
        .unwrap_or(&[]);

    let relay_status =
        peer_connect::relay_status_for_saved_peers(&peers, saved_peers, &manager_relay_status);

    let saved_peer_pubkeys: Vec<String> = studio_metadata
        .as_ref()
        .map(|metadata| {
            metadata
                .saved_peer_pubkeys()
                .into_iter()
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    Ok(HomeDashboardResponse {
        available: true,
        node_info: Some(to_home_node_info(node_info)),
        channels: home_channels,
        payments: payments
            .into_iter()
            .map(|payment| {
                let stored = stored_sent_payments
                    .iter()
                    .find(|entry| entry.payment_hash == payment.payment_hash);
                to_home_payment(payment_display::map_payment_list_item(
                    payment,
                    stored,
                ))
            })
            .collect(),
        incoming_invoices,
        active_channel_count,
        pending_channel_count,
        total_local_balance: total_local_balance.to_string(),
        saved_peer_pubkeys,
        network: studio_metadata
            .as_ref()
            .map(|metadata| metadata.network.clone()),
        relay_status,
    })
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

fn select_home_channels(channels: Vec<Channel>) -> Vec<HomeChannel> {
    channel::map_channels(channels)
        .into_iter()
        .take(HOME_CHANNEL_LIMIT)
        .collect()
}
