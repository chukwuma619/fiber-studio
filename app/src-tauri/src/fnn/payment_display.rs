use serde::Serialize;

use crate::fnn::assets::{self, AssetView};
use crate::fnn::rpc::{self, PaymentSummary};
use crate::fnn::sent_payments::StoredSentPayment;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaymentListItem {
    pub payment_hash: String,
    pub status: String,
    pub created_at: u64,
    pub last_updated_at: u64,
    pub failed_error: Option<String>,
    pub fee: String,
    pub payment_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_display: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_pubkey: Option<String>,
    pub route_hops: Vec<String>,
    pub fee_display: String,
}

pub fn map_payment_list_item(
    payment: PaymentSummary,
    stored: Option<&StoredSentPayment>,
    catalog: &[AssetView],
) -> PaymentListItem {
    let route_from_rpc = route_hops_from_routers(&payment.routers);
    let route_hops = if route_from_rpc.is_empty() {
        stored
            .map(|entry| entry.route_hops.clone())
            .unwrap_or_default()
    } else {
        route_from_rpc
    };

    let amount_shannons = stored
        .map(|entry| entry.amount_shannons.as_str())
        .or_else(|| amount_shannons_from_routers(&payment.routers));

    let asset = stored_asset(catalog, stored);
    let (amount_display, asset_symbol) = amount_shannons.map(|hex| {
        let raw = rpc::parse_hex_u128(hex).unwrap_or(0);
        (
            assets::format_amount_display(raw, &asset),
            asset.symbol.clone(),
        )
    }).unzip();

    let fee_raw = rpc::parse_hex_u128(&payment.fee).unwrap_or(0);
    let fee_asset = assets::ckb_asset();

    PaymentListItem {
        payment_hash: payment.payment_hash,
        status: payment.status,
        created_at: payment.created_at,
        last_updated_at: payment.last_updated_at,
        failed_error: payment.failed_error,
        fee: payment.fee,
        payment_kind: stored
            .map(|entry| entry.kind.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        amount_display,
        asset_symbol,
        target_pubkey: stored.and_then(|entry| entry.target_pubkey.clone()),
        route_hops,
        fee_display: assets::format_amount_display(fee_raw, &fee_asset),
    }
}

fn stored_asset(catalog: &[AssetView], stored: Option<&StoredSentPayment>) -> AssetView {
    if let Some(entry) = stored {
        if let Some(name) = entry.asset_name.as_deref() {
            if let Some(asset) = catalog.iter().find(|item| item.symbol.eq_ignore_ascii_case(name)) {
                return asset.clone();
            }
        }
        if let Some(script) = entry.udt_type_script.as_ref() {
            return assets::asset_for_channel_funding(catalog, Some(script));
        }
    }
    assets::ckb_asset()
}

pub fn route_hops_from_routers(routers: &[rpc::SessionRoute]) -> Vec<String> {
    routers
        .first()
        .map(|route| {
            route
                .nodes
                .iter()
                .map(|node| node.pubkey.clone())
                .collect()
        })
        .unwrap_or_default()
}

pub fn route_hops_from_payment(result: &rpc::SendPaymentResult) -> Vec<String> {
    route_hops_from_routers(&result.routers)
}

fn amount_shannons_from_routers(routers: &[rpc::SessionRoute]) -> Option<&str> {
    routers.first().and_then(|route| {
        route
            .nodes
            .last()
            .and_then(|node| node.amount.as_deref())
    })
}
