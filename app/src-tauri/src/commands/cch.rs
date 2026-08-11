use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::assets::{self, AssetView};
use crate::fnn::cch::{self, CchInvoice, CchOrder};
use crate::fnn::invoices;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::rpc::{self, CkbScript};
use crate::fnn::studio;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CchOrderView {
    pub payment_hash: String,
    pub status: String,
    pub amount_sats: String,
    pub amount_display: String,
    pub fee_sats: String,
    pub fee_display: String,
    pub asset_symbol: String,
    pub wrapped_btc_type_script: CkbScript,
    pub incoming_invoice: String,
    pub incoming_invoice_kind: String,
    pub outgoing_pay_req: String,
    pub timestamp: u64,
    pub expiry_delta_seconds: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    pub is_final: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCchRpcUrlPayload {
    pub cch_rpc_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CchSendBtcPayload {
    pub btc_pay_req: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CchReceiveBtcPayload {
    pub amount: String,
    pub expiry_hours: u64,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CchPaymentHashPayload {
    pub payment_hash: String,
}

async fn data_directory(state: &State<'_, AppState>) -> Result<std::path::PathBuf, String> {
    let manager = state.fnn.lock().await;
    manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".into())
}

async fn require_running(state: &State<'_, AppState>) -> Result<(), String> {
    let manager = state.fnn.lock().await;
    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Start your Fiber node before using cross-chain payments.".into());
    }
    Ok(())
}

fn read_cch_rpc_url(data_dir: &std::path::Path) -> Result<String, String> {
    let metadata = studio::read_studio_metadata(data_dir)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;
    metadata
        .cch_rpc_url_trimmed()
        .map(str::to_string)
        .ok_or_else(|| {
            "CCH hub RPC URL is not configured. Set it in Settings → Cross-chain.".into()
        })
}

fn cwbtc_asset(catalog: &[AssetView]) -> Result<AssetView, String> {
    catalog
        .iter()
        .find(|asset| asset.symbol.eq_ignore_ascii_case("cWBTC"))
        .cloned()
        .ok_or_else(|| {
            "cWBTC is not in this node's UDT whitelist. Add it under fiber.udt_whitelist in config.yml."
                .into()
        })
}

fn order_to_view(order: CchOrder, catalog: &[AssetView]) -> CchOrderView {
    let amount_raw = rpc::parse_hex_u128(&order.amount_sats).unwrap_or(0);
    let fee_raw = rpc::parse_hex_u128(&order.fee_sats).unwrap_or(0);
    let discovered = assets::asset_for_discovered_udt(&order.wrapped_btc_type_script);
    let asset = catalog
        .iter()
        .find(|entry| {
            entry
                .udt_type_script
                .as_ref()
                .is_some_and(|script| assets::scripts_equal(script, &order.wrapped_btc_type_script))
        })
        .cloned()
        .unwrap_or(discovered);

    CchOrderView {
        payment_hash: order.payment_hash,
        status: order.status.as_str().to_string(),
        amount_sats: order.amount_sats,
        amount_display: assets::format_amount_display(amount_raw, &asset),
        fee_sats: order.fee_sats,
        fee_display: assets::format_amount_display(fee_raw, &asset),
        asset_symbol: asset.symbol,
        wrapped_btc_type_script: order.wrapped_btc_type_script,
        incoming_invoice: order.incoming_invoice.encoded().to_string(),
        incoming_invoice_kind: order.incoming_invoice.kind_label().to_string(),
        outgoing_pay_req: order.outgoing_pay_req,
        timestamp: rpc::parse_hex_u128(&order.timestamp)
            .and_then(|value| u64::try_from(value).ok())
            .unwrap_or(0),
        expiry_delta_seconds: rpc::parse_hex_u128(&order.expiry_delta_seconds)
            .and_then(|value| u64::try_from(value).ok())
            .unwrap_or(0),
        failure_reason: order.failure_reason,
        is_final: order.status.is_final(),
    }
}

fn validate_wrapped_btc(order: &CchOrder, expected: &CkbScript) -> Result<(), String> {
    if assets::scripts_equal(&order.wrapped_btc_type_script, expected) {
        Ok(())
    } else {
        Err(
            "CCH hub returned a wrapped BTC type script that does not match this node's cWBTC."
                .into(),
        )
    }
}

async fn node_catalog() -> Result<Vec<AssetView>, String> {
    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    Ok(assets::build_asset_catalog(&node_info))
}

#[tauri::command]
pub async fn update_cch_rpc_url(
    state: State<'_, AppState>,
    payload: UpdateCchRpcUrlPayload,
) -> Result<crate::commands::settings::NodeSettingsResponse, String> {
    let data_dir = data_directory(&state).await?;
    let trimmed = payload.cch_rpc_url.trim();

    if !trimmed.is_empty() {
        cch::normalize_rpc_url(trimmed).map_err(|error| error.to_string())?;
    }

    let mut metadata = studio::read_studio_metadata(&data_dir)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;
    metadata.cch_rpc_url = trimmed.to_string();
    studio::write_studio_metadata(&data_dir, &metadata)
        .map_err(|error| format!("Failed to save CCH hub URL: {error}"))?;

    crate::commands::settings::get_node_settings(state, Some(data_dir.display().to_string())).await
}

#[tauri::command]
pub async fn cch_send_btc(
    state: State<'_, AppState>,
    payload: CchSendBtcPayload,
) -> Result<CchOrderView, String> {
    require_running(&state).await?;
    let data_dir = data_directory(&state).await?;
    let rpc_url = read_cch_rpc_url(&data_dir)?;
    let metadata = studio::read_studio_metadata(&data_dir)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;
    let currency = rpc::currency_for_network(&metadata.network);

    let catalog = node_catalog().await?;
    let cwbtc = cwbtc_asset(&catalog)?;
    let expected_script = cwbtc
        .udt_type_script
        .as_ref()
        .ok_or_else(|| "cWBTC type script is missing.".to_string())?;

    let order = cch::send_btc(&rpc_url, &payload.btc_pay_req, currency)
        .await
        .map_err(|error| error.to_string())?;

    validate_wrapped_btc(&order, expected_script)?;

    match &order.incoming_invoice {
        CchInvoice::Fiber(invoice) if !invoice.trim().is_empty() => {}
        _ => {
            return Err("CCH hub did not return a Fiber invoice to pay.".into());
        }
    }

    Ok(order_to_view(order, &catalog))
}

#[tauri::command]
pub async fn cch_receive_btc(
    state: State<'_, AppState>,
    payload: CchReceiveBtcPayload,
) -> Result<CchOrderView, String> {
    require_running(&state).await?;
    let data_dir = data_directory(&state).await?;
    let rpc_url = read_cch_rpc_url(&data_dir)?;
    let metadata = studio::read_studio_metadata(&data_dir)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;
    let currency = rpc::currency_for_network(&metadata.network);

    let catalog = node_catalog().await?;
    let cwbtc = cwbtc_asset(&catalog)?;
    let udt_script = cwbtc
        .udt_type_script
        .as_ref()
        .ok_or_else(|| "cWBTC type script is missing.".to_string())?;

    if payload.expiry_hours < 6 {
        return Err(
            "Expiry must be at least 6 hours so the CCH hub has enough time-lock margin.".into(),
        );
    }

    let amount_raw = assets::parse_human_amount_str(&payload.amount, cwbtc.decimals)?;
    let expiry_seconds = payload
        .expiry_hours
        .checked_mul(3_600)
        .ok_or_else(|| "Expiry is too large.".to_string())?;

    let created = rpc::new_invoice_with_udt(
        amount_raw,
        currency,
        payload.description.as_deref(),
        expiry_seconds,
        Some(udt_script),
    )
    .await
    .map_err(|error| format!("Failed to create Fiber invoice: {error}"))?;

    let payment_hash = created.invoice.data.payment_hash.clone();
    let stored = invoices::new_stored_invoice(
        payment_hash,
        created.invoice_address.clone(),
        amount_raw,
        payload.description.clone(),
        expiry_seconds,
        Some(udt_script.clone()),
        Some(cwbtc.symbol.clone()),
    );
    invoices::append_invoice(&data_dir, stored)
        .map_err(|error| format!("Failed to store invoice: {error}"))?;

    let order = cch::receive_btc(&rpc_url, &created.invoice_address)
        .await
        .map_err(|error| error.to_string())?;

    validate_wrapped_btc(&order, udt_script)?;

    match &order.incoming_invoice {
        CchInvoice::Lightning(invoice) if !invoice.trim().is_empty() => {}
        _ => {
            return Err("CCH hub did not return a Lightning invoice for the payer.".into());
        }
    }

    Ok(order_to_view(order, &catalog))
}

#[tauri::command]
pub async fn cch_get_order(
    state: State<'_, AppState>,
    payload: CchPaymentHashPayload,
) -> Result<CchOrderView, String> {
    let data_dir = data_directory(&state).await?;
    let rpc_url = read_cch_rpc_url(&data_dir)?;

    let catalog = match rpc::fetch_node_info().await {
        Ok(info) => assets::build_asset_catalog(&info),
        Err(_) => Vec::new(),
    };

    let order = cch::get_cch_order(&rpc_url, &payload.payment_hash)
        .await
        .map_err(|error| error.to_string())?;

    Ok(order_to_view(order, &catalog))
}

#[cfg(test)]
mod tests {
    use crate::fnn::cch::CchOrderStatus;

    #[test]
    fn order_status_labels() {
        assert_eq!(CchOrderStatus::OutgoingInFlight.as_str(), "OutgoingInFlight");
        assert!(CchOrderStatus::Success.is_final());
        assert!(!CchOrderStatus::Pending.is_final());
    }
}
