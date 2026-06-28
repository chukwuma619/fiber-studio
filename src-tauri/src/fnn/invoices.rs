use std::fs;
use std::path::Path;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const INVOICES_FILE: &str = "invoices.json";
pub const MAX_STORED_INVOICES: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredInvoice {
    pub payment_hash: String,
    pub invoice_address: String,
    pub amount_shannons: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: String,
    pub expiry_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct InvoiceStore {
    invoices: Vec<StoredInvoice>,
}

#[derive(Debug, Error)]
pub enum InvoiceStoreError {
    #[error("failed to read invoice store: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse invoice store: {0}")]
    Parse(#[from] serde_json::Error),
}

pub fn read_invoices(data_dir: &Path) -> Result<Vec<StoredInvoice>, InvoiceStoreError> {
    let path = data_dir.join(INVOICES_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)?;
    let store: InvoiceStore = serde_json::from_str(&raw)?;
    Ok(store.invoices)
}

pub fn append_invoice(
    data_dir: &Path,
    invoice: StoredInvoice,
) -> Result<(), InvoiceStoreError> {
    let mut invoices = read_invoices(data_dir)?;
    invoices.retain(|existing| existing.payment_hash != invoice.payment_hash);
    invoices.insert(0, invoice);

    if invoices.len() > MAX_STORED_INVOICES {
        invoices.truncate(MAX_STORED_INVOICES);
    }

    let store = InvoiceStore { invoices };
    let path = data_dir.join(INVOICES_FILE);
    let json = serde_json::to_string_pretty(&store)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn new_stored_invoice(
    payment_hash: String,
    invoice_address: String,
    amount_shannons: u128,
    description: Option<String>,
    expiry_seconds: u64,
) -> StoredInvoice {
    StoredInvoice {
        payment_hash,
        invoice_address,
        amount_shannons: format!("0x{amount_shannons:x}"),
        description,
        created_at: Utc::now().to_rfc3339(),
        expiry_seconds,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> std::path::PathBuf {
        let dir = env::temp_dir().join(format!(
            "fiber-studio-invoices-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_invoice(payment_hash: &str) -> StoredInvoice {
        StoredInvoice {
            payment_hash: payment_hash.to_string(),
            invoice_address: format!("fibt{payment_hash}"),
            amount_shannons: "0xbebc200".to_string(),
            description: Some("test".to_string()),
            created_at: Utc::now().to_rfc3339(),
            expiry_seconds: 3600,
        }
    }

    #[test]
    fn read_returns_empty_when_file_missing() {
        let dir = temp_dir();
        let invoices = read_invoices(&dir).unwrap();
        assert!(invoices.is_empty());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn append_and_read_round_trip() {
        let dir = temp_dir();
        let invoice = sample_invoice("0xabc");
        append_invoice(&dir, invoice.clone()).unwrap();

        let loaded = read_invoices(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0], invoice);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn append_dedupes_by_payment_hash() {
        let dir = temp_dir();
        append_invoice(&dir, sample_invoice("0xabc")).unwrap();
        let mut updated = sample_invoice("0xabc");
        updated.description = Some("updated".to_string());
        append_invoice(&dir, updated.clone()).unwrap();

        let loaded = read_invoices(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].description, Some("updated".to_string()));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn append_caps_at_max_stored() {
        let dir = temp_dir();
        for index in 0..MAX_STORED_INVOICES + 5 {
            append_invoice(&dir, sample_invoice(&format!("0x{index:04x}"))).unwrap();
        }

        let loaded = read_invoices(&dir).unwrap();
        assert_eq!(loaded.len(), MAX_STORED_INVOICES);
        assert_eq!(loaded[0].payment_hash, format!("0x{:04x}", MAX_STORED_INVOICES + 4));
        let _ = fs::remove_dir_all(dir);
    }
}
