use serde::Serialize;

use crate::fnn::amounts::ckb_from_shannons_hex;
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
    pub amount_ckb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_pubkey: Option<String>,
    pub route_hops: Vec<String>,
}

pub fn map_payment_list_item(
    payment: PaymentSummary,
    stored: Option<&StoredSentPayment>,
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
        amount_ckb: amount_shannons.map(|hex| format!("{} CKB", ckb_from_shannons_hex(hex))),
        target_pubkey: stored.and_then(|entry| entry.target_pubkey.clone()),
        route_hops,
    }
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
