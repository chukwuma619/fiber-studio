use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::assets;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::payment_display;
use crate::fnn::rebalance::{self, RebalanceStrategy};
use crate::fnn::rpc;
use crate::fnn::sent_payments;
use crate::state::AppState;

/// Fiber has no dedicated rebalance RPC. Studio performs a circular self-payment
/// via `build_router` + `send_payment_with_router` (keysend) so the route leaves
/// through the source channel and returns through the target channel.
///
/// There is no unpinned `allow_self_payment` fallback — that can move liquidity
/// on the wrong channels. Only routing fees leave the node.

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebalanceChannelPayload {
    pub source_channel_id: String,
    pub target_channel_id: String,
    /// Human-entered decimal amount string (exact parsing; no f64 rounding).
    pub amount: String,
    #[serde(default)]
    pub dry_run: bool,
    /// Human-entered max fee in the payment asset (CKB or the channel UDT).
    #[serde(default)]
    pub max_fee: Option<String>,
    #[serde(default)]
    pub max_fee_ckb: Option<f64>,
    #[serde(default)]
    pub strategy: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebalanceChannelResult {
    pub payment_hash: String,
    pub status: String,
    pub fee: String,
    pub fee_display: String,
    pub amount_display: String,
    pub asset_symbol: String,
    pub route_hops: Vec<String>,
    pub strategy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_error: Option<String>,
    pub max_amount_display: String,
    pub source_peer: String,
    pub target_peer: String,
}

fn map_rebalance_rpc_error(error: rpc::RpcError) -> String {
    let message = error.to_string();
    if message.is_empty() {
        return "Could not find a circular route between these channels.".to_string();
    }
    if message.to_ascii_lowercase().contains("self payment")
        || message.to_ascii_lowercase().contains("allow_self_payment")
    {
        return "This node could not complete a circular self-payment. You need at least two ready channels in the same asset and a path through the network.".to_string();
    }
    if message.to_ascii_lowercase().contains("no path")
        || message.to_ascii_lowercase().contains("failed to build")
        || message.to_ascii_lowercase().contains("no router")
    {
        return format!(
            "No circular route found between these channels. {message} Open another public channel in the same asset, or wait for the network graph to sync."
        );
    }
    message
}

fn to_result(
    payment: rpc::SendPaymentResult,
    plan: &rebalance::RebalancePlan<'_>,
    strategy: RebalanceStrategy,
) -> RebalanceChannelResult {
    let fee_raw = rpc::parse_hex_u128(&payment.fee).unwrap_or(0);
    let fee_asset = plan.asset.clone();
    let route_hops = payment_display::route_hops_from_payment(&payment);
    RebalanceChannelResult {
        payment_hash: payment.payment_hash,
        status: payment.status,
        fee: payment.fee,
        fee_display: assets::format_amount_display(fee_raw, &fee_asset),
        amount_display: assets::format_amount_display(plan.amount, &plan.asset),
        asset_symbol: plan.asset.symbol.clone(),
        route_hops,
        strategy: strategy.as_str().to_string(),
        failed_error: payment.failed_error,
        max_amount_display: assets::format_amount_display(plan.max_amount, &plan.asset),
        source_peer: plan.source.pubkey.clone(),
        target_peer: plan.target.pubkey.clone(),
    }
}

async fn try_explicit_route(
    plan: &rebalance::RebalancePlan<'_>,
    own_pubkey: &str,
    dry_run: bool,
) -> Result<rpc::SendPaymentResult, String> {
    let hops = rebalance::circular_hops_info(plan.source, plan.target, own_pubkey);
    let router = rpc::build_router(plan.amount, &hops, rebalance::udt_script(&plan.asset))
        .await
        .map_err(map_rebalance_rpc_error)?;

    if router.is_empty() {
        return Err("Fiber returned an empty route for these channels.".to_string());
    }

    rpc::send_payment_with_router(router.as_slice(), rebalance::udt_script(&plan.asset), dry_run)
        .await
        .map_err(map_rebalance_rpc_error)
}

fn parse_strategy(value: Option<&str>) -> Result<RebalanceStrategy, String> {
    match value.map(str::trim) {
        None | Some("") | Some("explicit_route") => Ok(RebalanceStrategy::ExplicitRoute),
        Some("circular_self_payment") => Err(
            "Unpinned circular self-payments are disabled. Preview an explicit source→target route instead."
                .to_string(),
        ),
        Some(other) => Err(format!("Unknown rebalance strategy: {other}.")),
    }
}

fn default_max_fee(plan: &rebalance::RebalancePlan<'_>) -> u128 {
    if plan.asset.udt_type_script.is_none() {
        rebalance::CKB_REBALANCE_RESERVE
    } else {
        (plan.amount / 100).max(1)
    }
}

fn resolve_max_fee(
    plan: &rebalance::RebalancePlan<'_>,
    max_fee: Option<&str>,
    max_fee_ckb: Option<f64>,
) -> Result<u128, String> {
    if let Some(text) = max_fee.map(str::trim).filter(|value| !value.is_empty()) {
        return assets::parse_human_amount_str(text, plan.asset.decimals);
    }
    if plan.asset.udt_type_script.is_none() {
        if let Some(ckb) = max_fee_ckb {
            return crate::fnn::amounts::ckb_to_shannons(ckb);
        }
    }
    Ok(default_max_fee(plan))
}

fn reject_if_fee_exceeds_max(
    payment: &rpc::SendPaymentResult,
    plan: &rebalance::RebalancePlan<'_>,
    max_fee: u128,
) -> Result<(), String> {
    let fee_raw = rpc::parse_hex_u128(&payment.fee).unwrap_or(0);
    if rebalance::fee_exceeds_max(fee_raw, Some(max_fee)) {
        return Err(format!(
            "Routing fee {} exceeds your max fee of {}.",
            assets::format_amount_display(fee_raw, &plan.asset),
            assets::format_amount_display(max_fee, &plan.asset),
        ));
    }
    Ok(())
}

async fn execute_rebalance(
    plan: &rebalance::RebalancePlan<'_>,
    own_pubkey: &str,
    dry_run: bool,
    max_fee: u128,
    preferred: Option<&str>,
) -> Result<(rpc::SendPaymentResult, RebalanceStrategy), String> {
    parse_strategy(preferred)?;

    let result = try_explicit_route(plan, own_pubkey, dry_run).await?;
    if result.status.eq_ignore_ascii_case("Failed")
        || result.failed_error.as_ref().is_some_and(|error| !error.trim().is_empty())
    {
        return Err(
            result
                .failed_error
                .clone()
                .filter(|error| !error.trim().is_empty())
                .unwrap_or_else(|| "Fiber could not build a circular route between these channels.".to_string()),
        );
    }
    reject_if_fee_exceeds_max(&result, plan, max_fee)?;
    Ok((result, RebalanceStrategy::ExplicitRoute))
}

#[tauri::command]
pub async fn rebalance_channel(
    state: State<'_, AppState>,
    payload: RebalanceChannelPayload,
) -> Result<RebalanceChannelResult, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err(
            "Node is not running. Start your node before rebalancing a channel.".to_string(),
        );
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let channels = rpc::fetch_list_channels()
        .await
        .map_err(|error| error.to_string())?;
    let catalog = assets::build_asset_catalog(&node_info);

    let source_probe = rebalance::find_ready_channel(&channels, &payload.source_channel_id)?;
    let asset = assets::asset_for_channel_funding(
        &catalog,
        source_probe.funding_udt_type_script.as_ref(),
    );
    let amount_raw = assets::parse_human_amount_str(&payload.amount, asset.decimals)?;

    let plan = rebalance::plan_rebalance(
        &channels,
        &catalog,
        &payload.source_channel_id,
        &payload.target_channel_id,
        amount_raw,
    )?;

    let max_fee = resolve_max_fee(
        &plan,
        payload.max_fee.as_deref(),
        payload.max_fee_ckb,
    )?;

    let (payment, strategy) = execute_rebalance(
        &plan,
        &node_info.pubkey,
        payload.dry_run,
        max_fee,
        payload.strategy.as_deref(),
    )
    .await?;

    if !payload.dry_run {
        let route_hops = payment_display::route_hops_from_payment(&payment);
        let stored = sent_payments::new_stored_sent_payment(
            payment.payment_hash.clone(),
            "rebalance",
            plan.amount,
            Some(node_info.pubkey.clone()),
            route_hops,
            plan.asset.udt_type_script.clone(),
            if plan.asset.udt_type_script.is_some() {
                Some(plan.asset.symbol.clone())
            } else {
                None
            },
        );
        let _ = sent_payments::upsert_sent_payment(&data_directory, stored);
    }

    Ok(to_result(payment, &plan, strategy))
}
