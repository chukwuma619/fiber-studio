use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::fnn::amounts::ckb_from_shannons_hex;
use crate::fnn::invoices::StoredInvoice;
use crate::fnn::rpc::{self, CkbInvoiceStatus};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceListItem {
    pub payment_hash: String,
    pub invoice_address: String,
    pub amount_ckb: String,
    pub note: String,
    pub status: String,
    pub expires_in: Option<String>,
}

pub async fn build_invoice_list_items(stored: Vec<StoredInvoice>) -> Vec<InvoiceListItem> {
    let mut items = Vec::with_capacity(stored.len());

    for record in stored {
        let mut status = "Open".to_string();
        let mut amount_hex = record.amount_shannons.clone();

        match rpc::get_invoice(&record.payment_hash).await {
            Ok(live) => {
                status = invoice_status_label(&live.status).to_string();
                if let Some(amount) = live.invoice.amount {
                    amount_hex = amount;
                }
            }
            Err(_) => {
                // Keep stored defaults when live lookup fails.
            }
        }

        let note = record
            .description
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "—".to_string());

        items.push(InvoiceListItem {
            payment_hash: record.payment_hash,
            invoice_address: record.invoice_address,
            amount_ckb: format!("{} CKB", ckb_from_shannons_hex(&amount_hex)),
            note,
            status: status.clone(),
            expires_in: expires_in_label(&record.created_at, record.expiry_seconds, &status),
        });
    }

    items
}

pub fn select_incoming_invoices(items: &[InvoiceListItem], paid_limit: usize) -> Vec<InvoiceListItem> {
    let mut incoming: Vec<InvoiceListItem> = items
        .iter()
        .filter(|item| item.status == "Received")
        .cloned()
        .collect();

    incoming.extend(
        items
            .iter()
            .filter(|item| item.status == "Paid")
            .take(paid_limit)
            .cloned(),
    );

    incoming
}

fn invoice_status_label(status: &CkbInvoiceStatus) -> &'static str {
    match status {
        CkbInvoiceStatus::Open => "Open",
        CkbInvoiceStatus::Cancelled => "Cancelled",
        CkbInvoiceStatus::Expired => "Expired",
        CkbInvoiceStatus::Received => "Received",
        CkbInvoiceStatus::Paid => "Paid",
    }
}

fn expires_in_label(created_at: &str, expiry_seconds: u64, status: &str) -> Option<String> {
    if status == "Expired" || status == "Paid" || status == "Cancelled" {
        return None;
    }

    let created = DateTime::parse_from_rfc3339(created_at)
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let expires_at = created + chrono::Duration::seconds(expiry_seconds as i64);
    let remaining = expires_at.signed_duration_since(Utc::now());

    if remaining.num_seconds() <= 0 {
        return Some("Expired".to_string());
    }

    let hours = remaining.num_hours();
    let minutes = remaining.num_minutes() % 60;
    if hours > 0 {
        Some(format!("{hours}h {minutes}m"))
    } else {
        Some(format!("{minutes}m"))
    }
}
