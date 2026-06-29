use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::amounts::{self, ckb_from_shannons_hex, format_ckb_amount};
use crate::fnn::channel::{sum_local_balances, SHANNONS_PER_CKB};
use crate::fnn::ckb_indexer;
use crate::fnn::invoice_display::{self, InvoiceListItem};
use crate::fnn::invoices;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::payment_display::{self, PaymentListItem};
use crate::fnn::peer_connect;
use crate::fnn::rpc::{self, CkbScript, CkbInvoice, CkbInvoiceStatus, PaymentKind, SendPaymentRequest};
use crate::fnn::sent_payments;
use crate::fnn::studio;
use crate::state::AppState;

const WALLET_PAYMENT_PAGE_SIZE: u32 = 25;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletPageResponse {
    pub available: bool,
    pub network: Option<String>,
    pub pubkey: Option<String>,
    pub in_channel_balance_ckb: u64,
    pub on_chain_wallet_ckb: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_chain_wallet_error: Option<String>,
    pub lock_script: Option<CkbScript>,
    pub invoices: Vec<WalletInvoiceItem>,
    pub payments: Vec<WalletPaymentItem>,
    pub payments_last_cursor: Option<String>,
    pub payments_has_more: bool,
    pub send_targets: Vec<WalletSendTarget>,
    pub relay_status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletSendTarget {
    pub pubkey: String,
    pub label: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletInvoiceItem {
    pub payment_hash: String,
    pub invoice_address: String,
    pub amount_ckb: String,
    pub note: String,
    pub status: String,
    pub expires_in: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletPaymentItem {
    pub payment_hash: String,
    pub status: String,
    pub created_at: u64,
    pub last_updated_at: u64,
    pub failed_error: Option<String>,
    pub fee: String,
    pub payment_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_ckb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_pubkey: Option<String>,
    pub route_hops: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoicePayload {
    pub amount: f64,
    pub expiry_hours: u64,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseInvoicePayload {
    pub invoice: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseInvoicePreview {
    pub amount_display: String,
    pub currency: String,
    pub payment_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub network_match: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_warning: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceResult {
    pub invoice_address: String,
    pub payment_hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPaymentPayload {
    pub invoice: String,
    #[serde(default)]
    pub max_fee_ckb: Option<f64>,
    #[serde(default)]
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeysendPaymentPayload {
    pub target_pubkey: String,
    pub amount: f64,
    #[serde(default)]
    pub max_fee_ckb: Option<f64>,
    #[serde(default)]
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentHashPayload {
    pub payment_hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadMorePaymentsPayload {
    pub after: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadMorePaymentsResult {
    pub payments: Vec<WalletPaymentItem>,
    pub last_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSendPaymentResult {
    pub fee_shannons: String,
    pub fee_ckb: String,
    pub amount_display: String,
    pub route_hops: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPaymentCommandResult {
    pub payment_hash: String,
    pub status: String,
    pub fee: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_error: Option<String>,
    pub route_hops: Vec<String>,
}

fn wallet_page_unavailable() -> WalletPageResponse {
    WalletPageResponse {
        available: false,
        network: None,
        pubkey: None,
        in_channel_balance_ckb: 0,
        on_chain_wallet_ckb: None,
        on_chain_wallet_error: None,
        lock_script: None,
        invoices: Vec::new(),
        payments: Vec::new(),
        payments_last_cursor: None,
        payments_has_more: false,
        send_targets: Vec::new(),
        relay_status: "not_configured".to_string(),
    }
}

fn ckb_to_shannons(amount_ckb: f64) -> Result<u128, String> {
    amounts::ckb_to_shannons(amount_ckb)
}

fn resolve_send_limits(
    max_fee_ckb: Option<f64>,
    timeout_seconds: Option<u64>,
) -> Result<(Option<u128>, Option<u64>), String> {
    let max_fee_amount = amounts::optional_ckb_to_shannons(max_fee_ckb)?;
    Ok((max_fee_amount, timeout_seconds))
}

fn to_wallet_invoice(item: InvoiceListItem) -> WalletInvoiceItem {
    WalletInvoiceItem {
        payment_hash: item.payment_hash,
        invoice_address: item.invoice_address,
        amount_ckb: item.amount_ckb,
        note: item.note,
        status: item.status,
        expires_in: item.expires_in,
    }
}

fn to_wallet_payment(item: PaymentListItem) -> WalletPaymentItem {
    WalletPaymentItem {
        payment_hash: item.payment_hash,
        status: item.status,
        created_at: item.created_at,
        last_updated_at: item.last_updated_at,
        failed_error: item.failed_error,
        fee: item.fee,
        payment_kind: item.payment_kind,
        amount_ckb: item.amount_ckb,
        target_pubkey: item.target_pubkey,
        route_hops: item.route_hops,
    }
}

fn extract_invoice_description(attrs: &[serde_json::Value]) -> Option<String> {
    for attr in attrs {
        if let Some(description) = attr.get("description").and_then(|value| value.as_str()) {
            if !description.trim().is_empty() {
                return Some(description.to_string());
            }
        }
        if let Some(description) = attr
            .get("Description")
            .and_then(|value| value.as_str())
        {
            if !description.trim().is_empty() {
                return Some(description.to_string());
            }
        }
    }
    None
}

fn expected_currency_for_network(network: &str) -> &'static str {
    match network {
        "mainnet" => "Fibb",
        _ => "Fibt",
    }
}

fn build_parse_invoice_preview(
    invoice: &CkbInvoice,
    network: Option<&str>,
) -> ParseInvoicePreview {
    let amount_shannons = invoice
        .amount
        .as_deref()
        .and_then(rpc::parse_hex_u128)
        .unwrap_or(0);
    let currency = invoice
        .currency
        .clone()
        .unwrap_or_else(|| "Fibt".to_string());
    let network_match = network.is_none_or(|value| {
        expected_currency_for_network(value).eq_ignore_ascii_case(&currency)
    });
    let network_warning = if network_match {
        None
    } else {
        Some(format!(
            "Invoice currency is {currency}; your node is on {}.",
            network.unwrap_or("unknown")
        ))
    };

    ParseInvoicePreview {
        amount_display: format!("{} CKB", format_ckb_amount(amount_shannons)),
        currency,
        payment_hash: invoice.data.payment_hash.clone(),
        description: extract_invoice_description(&invoice.data.attrs),
        network_match,
        network_warning,
    }
}

fn send_payment_request<'a>(
    invoice: &'a str,
    dry_run: bool,
    max_fee_amount: Option<u128>,
    timeout: Option<u64>,
) -> SendPaymentRequest<'a> {
    SendPaymentRequest {
        kind: PaymentKind::Invoice { invoice },
        dry_run,
        max_fee_amount,
        timeout,
    }
}

fn keysend_payment_request<'a>(
    target_pubkey: &'a str,
    amount_shannons: u128,
    dry_run: bool,
    max_fee_amount: Option<u128>,
    timeout: Option<u64>,
) -> SendPaymentRequest<'a> {
    SendPaymentRequest {
        kind: PaymentKind::Keysend {
            target_pubkey,
            amount: amount_shannons,
        },
        dry_run,
        max_fee_amount,
        timeout,
    }
}

fn build_send_targets(
    peers: &[rpc::PeerInfo],
    channels: &[rpc::Channel],
    configured_peer_pubkey: Option<&str>,
    own_pubkey: &str,
) -> Vec<WalletSendTarget> {
    let mut targets = Vec::new();

    let mut push_target = |pubkey: &str, label: String, kind: &str| {
        if pubkey.trim().is_empty() || peer_connect::pubkeys_equal(pubkey, own_pubkey) {
            return;
        }
        if targets
            .iter()
            .any(|target: &WalletSendTarget| {
                peer_connect::pubkeys_equal(&target.pubkey, pubkey)
            })
        {
            return;
        }
        targets.push(WalletSendTarget {
            pubkey: pubkey.to_string(),
            label,
            kind: kind.to_string(),
        });
    };

    if let Some(pubkey) = configured_peer_pubkey.filter(|value| !value.trim().is_empty()) {
        push_target(pubkey, "Configured relay".to_string(), "relay");
    }

    for channel in channels {
        push_target(
            &channel.pubkey,
            "Channel peer".to_string(),
            "channel",
        );
    }

    for peer in peers {
        push_target(&peer.pubkey, "Connected peer".to_string(), "peer");
    }

    targets
}

fn normalize_payment_hash(payment_hash: &str) -> String {
    let trimmed = payment_hash.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        trimmed.to_string()
    } else {
        format!("0x{trimmed}")
    }
}

fn map_wallet_payments(
    payments: Vec<rpc::PaymentSummary>,
    stored_sent_payments: &[sent_payments::StoredSentPayment],
) -> Vec<WalletPaymentItem> {
    payments
        .into_iter()
        .map(|payment| {
            let stored = stored_sent_payments
                .iter()
                .find(|entry| entry.payment_hash == payment.payment_hash);
            to_wallet_payment(payment_display::map_payment_list_item(payment, stored))
        })
        .collect()
}

fn payments_page_meta(
    page_size: u32,
    last_cursor: Option<String>,
    returned_count: usize,
) -> (Option<String>, bool) {
    let has_more = last_cursor.is_some() && returned_count >= page_size as usize;
    (last_cursor, has_more)
}

fn default_import_expiry_seconds() -> u64 {
    86_400
}

fn stored_invoice_from_get_invoice(
    payment_hash: String,
    result: rpc::GetInvoiceResult,
) -> invoices::StoredInvoice {
    let amount_shannons = result
        .invoice
        .amount
        .as_deref()
        .and_then(rpc::parse_hex_u128)
        .unwrap_or(0);
    let description = extract_invoice_description(&result.invoice.data.attrs);

    invoices::new_stored_invoice(
        payment_hash,
        result.invoice_address,
        amount_shannons,
        description,
        default_import_expiry_seconds(),
    )
}

async fn fetch_on_chain_balance(
    network: &str,
    lock_script: &CkbScript,
) -> (Option<u64>, Option<String>) {
    let rpc_url = ckb_indexer::ckb_rpc_url(network);
    match ckb_indexer::fetch_lock_script_capacity(rpc_url, lock_script).await {
        Ok(shannons) => {
            let available_ckb = (shannons / SHANNONS_PER_CKB) as u64;
            (Some(available_ckb), None)
        }
        Err(error) => (
            None,
            Some(format!("Failed to read on-chain wallet balance: {error}")),
        ),
    }
}

fn persist_sent_payment(
    data_directory: &PathBuf,
    payment_hash: &str,
    kind: &str,
    amount_shannons: u128,
    target_pubkey: Option<String>,
    route_hops: Vec<String>,
) {
    let stored = sent_payments::new_stored_sent_payment(
        payment_hash.to_string(),
        kind,
        amount_shannons,
        target_pubkey,
        route_hops,
    );
    let _ = sent_payments::upsert_sent_payment(data_directory, stored);
}

fn send_payment_command_result(result: rpc::SendPaymentResult) -> SendPaymentCommandResult {
    let route_hops = payment_display::route_hops_from_payment(&result);
    SendPaymentCommandResult {
        payment_hash: result.payment_hash,
        status: result.status,
        fee: result.fee,
        failed_error: result.failed_error,
        route_hops,
    }
}

async fn require_running_data_dir(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before using the wallet.".to_string());
    }

    manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())
}

#[tauri::command]
pub async fn get_wallet_page(state: State<'_, AppState>) -> Result<WalletPageResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(wallet_page_unavailable());
    }

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

    let total_local = sum_local_balances(&channels);
    let in_channel_balance_ckb = (total_local / SHANNONS_PER_CKB) as u64;

    let configured_peer_pubkey = studio_metadata
        .as_ref()
        .map(|metadata| metadata.custom_public_node_pubkey.clone())
        .filter(|pubkey| !pubkey.trim().is_empty());

    let relay_status = configured_peer_pubkey
        .as_deref()
        .map(|pubkey| {
            peer_connect::relay_status_for_configured_peer(
                &peers,
                pubkey,
                &manager_relay_status,
            )
        })
        .unwrap_or_else(|| "not_configured".to_string());

    let (on_chain_wallet_ckb, on_chain_wallet_error) =
        match studio_metadata.as_ref().map(|metadata| metadata.network.as_str()) {
            Some(network) => {
                fetch_on_chain_balance(network, &node_info.default_funding_lock_script).await
            }
            None => (None, Some("Network is not configured.".to_string())),
        };

    let stored_invoices = data_directory
        .as_ref()
        .map(|path| invoices::read_invoices(path).unwrap_or_default())
        .unwrap_or_default();
    let invoice_items = invoice_display::build_invoice_list_items(stored_invoices)
        .await
        .into_iter()
        .map(to_wallet_invoice)
        .collect();

    let payments_page = rpc::fetch_list_payments_page(WALLET_PAYMENT_PAGE_SIZE, None)
        .await
        .map_err(|error| error.to_string())?;

    let stored_sent_payments = data_directory
        .as_ref()
        .map(|path| sent_payments::read_sent_payments(path).unwrap_or_default())
        .unwrap_or_default();

    let payment_items = map_wallet_payments(payments_page.payments, &stored_sent_payments);
    let (payments_last_cursor, payments_has_more) = payments_page_meta(
        WALLET_PAYMENT_PAGE_SIZE,
        payments_page.last_cursor,
        payment_items.len(),
    );

    let send_targets = build_send_targets(
        &peers,
        &channels,
        configured_peer_pubkey.as_deref(),
        &node_info.pubkey,
    );

    Ok(WalletPageResponse {
        available: true,
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        pubkey: Some(node_info.pubkey),
        in_channel_balance_ckb,
        on_chain_wallet_ckb,
        on_chain_wallet_error,
        lock_script: Some(node_info.default_funding_lock_script),
        invoices: invoice_items,
        payments: payment_items,
        payments_last_cursor,
        payments_has_more,
        send_targets,
        relay_status,
    })
}

#[tauri::command]
pub async fn create_invoice(
    state: State<'_, AppState>,
    payload: CreateInvoicePayload,
) -> Result<CreateInvoiceResult, String> {
    if payload.expiry_hours == 0 {
        return Err("Expiry must be at least 1 hour.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;
    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let amount_shannons = ckb_to_shannons(payload.amount)?;
    let expiry_seconds = payload.expiry_hours.saturating_mul(3600);
    let currency = rpc::currency_for_network(&studio_metadata.network);

    let result = rpc::new_invoice(
        amount_shannons,
        currency,
        payload.description.as_deref(),
        expiry_seconds,
    )
    .await
    .map_err(|error| error.to_string())?;

    let payment_hash = result.invoice.data.payment_hash.clone();

    let stored = invoices::new_stored_invoice(
        payment_hash.clone(),
        result.invoice_address.clone(),
        amount_shannons,
        payload.description,
        expiry_seconds,
    );
    invoices::append_invoice(&data_directory, stored)
        .map_err(|error| format!("Failed to save invoice: {error}"))?;

    Ok(CreateInvoiceResult {
        invoice_address: result.invoice_address,
        payment_hash,
    })
}

#[tauri::command]
pub async fn preview_send_payment(
    state: State<'_, AppState>,
    payload: SendPaymentPayload,
) -> Result<PreviewSendPaymentResult, String> {
    let invoice = payload.invoice.trim();
    if invoice.is_empty() {
        return Err("Invoice string is required.".to_string());
    }

    let _data_directory = require_running_data_dir(&state).await?;

    let parsed = rpc::parse_invoice(invoice)
        .await
        .map_err(|error| format!("Invalid invoice: {error}"))?;

    let parse_preview = build_parse_invoice_preview(&parsed.invoice, None);
    let amount_shannons = parsed
        .invoice
        .amount
        .as_deref()
        .and_then(rpc::parse_hex_u128)
        .unwrap_or(0);

    let (max_fee_amount, timeout) =
        resolve_send_limits(payload.max_fee_ckb, payload.timeout_seconds)?;

    let preview = rpc::send_payment(send_payment_request(
        invoice,
        true,
        max_fee_amount,
        timeout,
    ))
        .await
        .map_err(|error| error.to_string())?;

    let route_hops = payment_display::route_hops_from_payment(&preview);

    Ok(PreviewSendPaymentResult {
        fee_shannons: preview.fee.clone(),
        fee_ckb: format!("{} CKB", ckb_from_shannons_hex(&preview.fee)),
        amount_display: if parse_preview.amount_display.is_empty() {
            format!("{} CKB", format_ckb_amount(amount_shannons))
        } else {
            parse_preview.amount_display
        },
        route_hops,
    })
}

#[tauri::command]
pub async fn parse_invoice_preview(
    state: State<'_, AppState>,
    payload: ParseInvoicePayload,
) -> Result<ParseInvoicePreview, String> {
    let invoice = payload.invoice.trim();
    if invoice.is_empty() {
        return Err("Invoice string is required.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;
    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let parsed = rpc::parse_invoice(invoice)
        .await
        .map_err(|error| format!("Invalid invoice: {error}"))?;

    Ok(build_parse_invoice_preview(
        &parsed.invoice,
        Some(studio_metadata.network.as_str()),
    ))
}

#[tauri::command]
pub async fn send_payment(
    state: State<'_, AppState>,
    payload: SendPaymentPayload,
) -> Result<SendPaymentCommandResult, String> {
    let invoice = payload.invoice.trim();
    if invoice.is_empty() {
        return Err("Invoice string is required.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;

    let parsed = rpc::parse_invoice(invoice)
        .await
        .map_err(|error| format!("Invalid invoice: {error}"))?;
    let amount_shannons = parsed
        .invoice
        .amount
        .as_deref()
        .and_then(rpc::parse_hex_u128)
        .unwrap_or(0);

    let (max_fee_amount, timeout) =
        resolve_send_limits(payload.max_fee_ckb, payload.timeout_seconds)?;

    let result = rpc::send_payment(send_payment_request(
        invoice,
        false,
        max_fee_amount,
        timeout,
    ))
        .await
        .map_err(|error| error.to_string())?;

    let route_hops = payment_display::route_hops_from_payment(&result);
    persist_sent_payment(
        &data_directory,
        &result.payment_hash,
        "invoice",
        amount_shannons,
        None,
        route_hops,
    );

    Ok(send_payment_command_result(result))
}

#[tauri::command]
pub async fn preview_keysend_payment(
    state: State<'_, AppState>,
    payload: KeysendPaymentPayload,
) -> Result<PreviewSendPaymentResult, String> {
    let target_pubkey = payload.target_pubkey.trim();
    if target_pubkey.is_empty() {
        return Err("Target pubkey is required.".to_string());
    }

    let _data_directory = require_running_data_dir(&state).await?;
    let amount_shannons = ckb_to_shannons(payload.amount)?;
    let (max_fee_amount, timeout) =
        resolve_send_limits(payload.max_fee_ckb, payload.timeout_seconds)?;

    let preview = rpc::send_payment(keysend_payment_request(
        target_pubkey,
        amount_shannons,
        true,
        max_fee_amount,
        timeout,
    ))
    .await
    .map_err(|error| error.to_string())?;

    Ok(PreviewSendPaymentResult {
        fee_shannons: preview.fee.clone(),
        fee_ckb: format!("{} CKB", ckb_from_shannons_hex(&preview.fee)),
        amount_display: format!("{} CKB", format_ckb_amount(amount_shannons)),
        route_hops: payment_display::route_hops_from_payment(&preview),
    })
}

#[tauri::command]
pub async fn send_keysend_payment(
    state: State<'_, AppState>,
    payload: KeysendPaymentPayload,
) -> Result<SendPaymentCommandResult, String> {
    let target_pubkey = payload.target_pubkey.trim();
    if target_pubkey.is_empty() {
        return Err("Target pubkey is required.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;
    let amount_shannons = ckb_to_shannons(payload.amount)?;
    let (max_fee_amount, timeout) =
        resolve_send_limits(payload.max_fee_ckb, payload.timeout_seconds)?;

    let result = rpc::send_payment(keysend_payment_request(
        target_pubkey,
        amount_shannons,
        false,
        max_fee_amount,
        timeout,
    ))
    .await
    .map_err(|error| error.to_string())?;

    let route_hops = payment_display::route_hops_from_payment(&result);
    persist_sent_payment(
        &data_directory,
        &result.payment_hash,
        "keysend",
        amount_shannons,
        Some(target_pubkey.to_string()),
        route_hops,
    );

    Ok(send_payment_command_result(result))
}

#[tauri::command]
pub async fn get_payment(
    state: State<'_, AppState>,
    payload: PaymentHashPayload,
) -> Result<SendPaymentCommandResult, String> {
    let payment_hash = payload.payment_hash.trim();
    if payment_hash.is_empty() {
        return Err("Payment hash is required.".to_string());
    }

    let _data_directory = require_running_data_dir(&state).await?;

    let result = rpc::get_payment(payment_hash)
        .await
        .map_err(|error| error.to_string())?;

    Ok(send_payment_command_result(result))
}

#[tauri::command]
pub async fn cancel_invoice(
    state: State<'_, AppState>,
    payload: PaymentHashPayload,
) -> Result<WalletInvoiceItem, String> {
    let payment_hash = payload.payment_hash.trim();
    if payment_hash.is_empty() {
        return Err("Payment hash is required.".to_string());
    }

    let _data_directory = require_running_data_dir(&state).await?;

    let result = rpc::cancel_invoice(payment_hash)
        .await
        .map_err(|error| error.to_string())?;

    let amount_hex = result
        .invoice
        .amount
        .as_deref()
        .unwrap_or("0x0");

    Ok(WalletInvoiceItem {
        payment_hash: payment_hash.to_string(),
        invoice_address: result.invoice_address,
        amount_ckb: format!("{} CKB", ckb_from_shannons_hex(amount_hex)),
        note: "—".to_string(),
        status: match result.status {
            CkbInvoiceStatus::Open => "Open",
            CkbInvoiceStatus::Cancelled => "Cancelled",
            CkbInvoiceStatus::Expired => "Expired",
            CkbInvoiceStatus::Received => "Received",
            CkbInvoiceStatus::Paid => "Paid",
        }
        .to_string(),
        expires_in: None,
    })
}

#[tauri::command]
pub async fn load_more_wallet_payments(
    state: State<'_, AppState>,
    payload: LoadMorePaymentsPayload,
) -> Result<LoadMorePaymentsResult, String> {
    let after = payload.after.trim();
    if after.is_empty() {
        return Err("Pagination cursor is required.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;

    let payments_page = rpc::fetch_list_payments_page(WALLET_PAYMENT_PAGE_SIZE, Some(after))
        .await
        .map_err(|error| error.to_string())?;

    let stored_sent_payments = sent_payments::read_sent_payments(&data_directory).unwrap_or_default();
    let payment_items = map_wallet_payments(payments_page.payments, &stored_sent_payments);
    let (last_cursor, has_more) = payments_page_meta(
        WALLET_PAYMENT_PAGE_SIZE,
        payments_page.last_cursor,
        payment_items.len(),
    );

    Ok(LoadMorePaymentsResult {
        payments: payment_items,
        last_cursor,
        has_more,
    })
}

#[tauri::command]
pub async fn import_invoice(
    state: State<'_, AppState>,
    payload: PaymentHashPayload,
) -> Result<WalletInvoiceItem, String> {
    let payment_hash = normalize_payment_hash(&payload.payment_hash);
    if payment_hash.is_empty() {
        return Err("Payment hash is required.".to_string());
    }

    let data_directory = require_running_data_dir(&state).await?;

    let live = rpc::get_invoice(&payment_hash)
        .await
        .map_err(|error| format!("Invoice not found on this node: {error}"))?;

    let stored = stored_invoice_from_get_invoice(payment_hash.clone(), live);
    invoices::append_invoice(&data_directory, stored)
        .map_err(|error| format!("Failed to save imported invoice: {error}"))?;

    let items = invoice_display::build_invoice_list_items(invoices::read_invoices(&data_directory).unwrap_or_default())
        .await;
    let imported = items
        .into_iter()
        .find(|item| item.payment_hash.eq_ignore_ascii_case(&payment_hash))
        .ok_or_else(|| "Imported invoice could not be loaded.".to_string())?;

    Ok(to_wallet_invoice(imported))
}

#[cfg(test)]
mod tests {
    use crate::fnn::amounts;

    #[test]
    fn format_ckb_amount_handles_fractions() {
        assert_eq!(amounts::format_ckb_amount(200_000_000), "2");
        assert_eq!(amounts::format_ckb_amount(250_000_000), "2.50");
        assert_eq!(amounts::format_ckb_amount(50_000_000), "0.50");
    }

    #[test]
    fn ckb_to_shannons_rejects_invalid_amounts() {
        assert!(amounts::ckb_to_shannons(0.0).is_err());
        assert!(amounts::ckb_to_shannons(-1.0).is_err());
        assert_eq!(amounts::ckb_to_shannons(1.0).unwrap(), 100_000_000);
    }
}
