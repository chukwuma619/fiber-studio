use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::fnn::assets::{self, AssetView};
use crate::fnn::invoices::StoredInvoice;
use crate::fnn::rpc::{self, CkbInvoiceStatus, GetInvoiceResult};

/// Dashboard only shows a handful of incoming invoices — enrich recent ones only.
pub const DASHBOARD_INVOICE_ENRICH_LIMIT: usize = 15;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceListItem {
    pub payment_hash: String,
    pub invoice_address: String,
    pub amount_display: String,
    pub asset_symbol: String,
    pub note: String,
    pub status: String,
    pub expires_in: Option<String>,
}

pub async fn build_invoice_list_items_with_catalog(
    stored: Vec<StoredInvoice>,
    catalog: &[AssetView],
) -> Vec<InvoiceListItem> {
    build_invoice_list_items_with_limit(stored, None, catalog).await
}

pub async fn build_invoice_list_items_with_limit(
    stored: Vec<StoredInvoice>,
    enrich_limit: Option<usize>,
    catalog: &[AssetView],
) -> Vec<InvoiceListItem> {
    if stored.is_empty() {
        return Vec::new();
    }

    let enrich_count = enrich_limit.unwrap_or(stored.len()).min(stored.len());
    let live_statuses = fetch_live_invoice_statuses(&stored[..enrich_count]).await;

    stored
        .into_iter()
        .enumerate()
        .map(|(index, record)| {
            let live = live_statuses
                .get(index)
                .and_then(|result| result.as_ref().ok());
            stored_invoice_to_item(record, live, catalog)
        })
        .collect()
}

pub async fn build_invoice_list_item(
    stored: StoredInvoice,
    catalog: &[AssetView],
) -> InvoiceListItem {
    let live = rpc::get_invoice(&stored.payment_hash).await.ok();
    stored_invoice_to_item(stored, live.as_ref(), catalog)
}

pub fn select_incoming_invoices(
    items: &[InvoiceListItem],
    paid_limit: usize,
) -> Vec<InvoiceListItem> {
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

async fn fetch_live_invoice_statuses(
    records: &[StoredInvoice],
) -> Vec<Result<GetInvoiceResult, rpc::RpcError>> {
    if records.is_empty() {
        return Vec::new();
    }

    let mut handles = Vec::with_capacity(records.len());
    for record in records {
        let payment_hash = record.payment_hash.clone();
        handles.push(tokio::spawn(async move {
            rpc::get_invoice(&payment_hash).await
        }));
    }

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        results.push(handle.await.unwrap_or(Err(rpc::RpcError::MissingResult)));
    }

    results
}

fn stored_invoice_to_item(
    record: StoredInvoice,
    live: Option<&GetInvoiceResult>,
    catalog: &[AssetView],
) -> InvoiceListItem {
    let mut status = "Open".to_string();
    let mut amount_hex = record.amount_shannons.clone();
    let mut asset = asset_for_stored_invoice(&record, catalog);

    if let Some(live) = live {
        status = invoice_status_label(&live.status).to_string();
        if let Some(amount) = &live.invoice.amount {
            amount_hex = amount.clone();
        }
        asset = assets::asset_for_invoice(catalog, &live.invoice);
    }

    let raw = rpc::parse_hex_u128(&amount_hex).unwrap_or(0);
    let note = record
        .description
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "—".to_string());

    InvoiceListItem {
        payment_hash: record.payment_hash,
        invoice_address: record.invoice_address,
        amount_display: assets::format_amount_display(raw, &asset),
        asset_symbol: asset.symbol,
        note,
        status: status.clone(),
        expires_in: expires_in_label(&record.created_at, record.expiry_seconds, &status),
    }
}

fn asset_for_stored_invoice(record: &StoredInvoice, catalog: &[AssetView]) -> AssetView {
    if let Some(script) = record.udt_type_script.as_ref() {
        return assets::asset_for_channel_funding(catalog, Some(script));
    }
    if let Some(name) = record.asset_name.as_deref() {
        if let Some(asset) = catalog
            .iter()
            .find(|entry| entry.symbol.eq_ignore_ascii_case(name))
        {
            return asset.clone();
        }
    }
    assets::ckb_asset()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fnn::assets::{self, AssetView};
    use crate::fnn::rpc::{CkbInvoice, CkbInvoiceStatus, GetInvoiceResult, InvoiceData};

    fn stored(
        description: Option<&str>,
        created_at: DateTime<Utc>,
        expiry_seconds: u64,
    ) -> StoredInvoice {
        StoredInvoice {
            payment_hash: "0xabc".to_string(),
            invoice_address: "fibt1".to_string(),
            amount_shannons: "0x5f5e100".to_string(),
            description: description.map(str::to_string),
            created_at: created_at.to_rfc3339(),
            expiry_seconds,
            udt_type_script: None,
            asset_name: None,
        }
    }

    fn live(status: CkbInvoiceStatus, amount: Option<&str>) -> GetInvoiceResult {
        GetInvoiceResult {
            invoice_address: "fibt1".to_string(),
            status,
            invoice: CkbInvoice {
                currency: Some("Fibt".to_string()),
                amount: amount.map(str::to_string),
                data: InvoiceData {
                    payment_hash: "0xabc".to_string(),
                    attrs: Vec::new(),
                },
                udt_type_script: None,
            },
        }
    }

    fn item(status: &str) -> InvoiceListItem {
        InvoiceListItem {
            payment_hash: status.to_string(),
            invoice_address: "fibt1".to_string(),
            amount_display: "1 CKB".to_string(),
            asset_symbol: "CKB".to_string(),
            note: "—".to_string(),
            status: status.to_string(),
            expires_in: None,
        }
    }

    #[test]
    fn incoming_list_keeps_every_received_invoice_and_caps_paid() {
        let items = vec![
            item("Open"),
            item("Received"),
            item("Paid"),
            item("Cancelled"),
            item("Paid"),
        ];

        let incoming = select_incoming_invoices(&items, 1);
        assert_eq!(
            incoming
                .iter()
                .map(|item| item.status.as_str())
                .collect::<Vec<_>>(),
            vec!["Received", "Paid"]
        );
        assert_eq!(incoming[1].payment_hash, "Paid");
    }

    #[test]
    fn stored_invoice_uses_ckb_and_hides_a_blank_note() {
        let item = stored_invoice_to_item(
            stored(Some("   "), Utc::now(), 3 * 60 * 60),
            None,
            &[assets::ckb_asset()],
        );

        assert_eq!(item.status, "Open");
        assert_eq!(item.note, "—");
        assert_eq!(item.amount_display, "1 CKB");
        let expires = item.expires_in.expect("open invoice expires");
        assert!(expires.contains('h'), "{expires}");
    }

    #[test]
    fn live_invoice_overrides_status_amount_and_drops_expiry() {
        let item = stored_invoice_to_item(
            stored(Some("rent"), Utc::now(), 3600),
            Some(&live(CkbInvoiceStatus::Paid, Some("0x2"))),
            &[assets::ckb_asset()],
        );

        assert_eq!(item.status, "Paid");
        assert_eq!(item.note, "rent");
        assert_eq!(item.amount_display, "0.00000002 CKB");
        assert!(item.expires_in.is_none());
    }

    #[test]
    fn past_expiry_is_labeled_even_while_the_status_is_still_open() {
        let created = Utc::now() - chrono::Duration::hours(3);
        let item = stored_invoice_to_item(stored(None, created, 60), None, &[assets::ckb_asset()]);

        assert_eq!(item.expires_in.as_deref(), Some("Expired"));
    }

    #[test]
    fn asset_name_selects_the_catalog_entry() {
        let mut record = stored(None, Utc::now(), 120);
        record.amount_shannons = "0x96".to_string();
        record.asset_name = Some("rusd".to_string());
        let catalog = [AssetView {
            id: "rusd".to_string(),
            name: "RUSD".to_string(),
            symbol: "RUSD".to_string(),
            decimals: 2,
            udt_type_script: None,
        }];

        let item = stored_invoice_to_item(record, None, &catalog);
        assert_eq!(item.asset_symbol, "RUSD");
        assert_eq!(item.amount_display, "1.5 RUSD");
        assert!(item.expires_in.unwrap().ends_with('m'));
    }
}
