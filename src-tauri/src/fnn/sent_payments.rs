use std::fs;
use std::path::Path;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const SENT_PAYMENTS_FILE: &str = "sent-payments.json";
pub const MAX_STORED_SENT_PAYMENTS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredSentPayment {
    pub payment_hash: String,
    pub kind: String,
    pub amount_shannons: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_pubkey: Option<String>,
    #[serde(default)]
    pub route_hops: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct SentPaymentStore {
    payments: Vec<StoredSentPayment>,
}

#[derive(Debug, Error)]
pub enum SentPaymentStoreError {
    #[error("failed to read sent payment store: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse sent payment store: {0}")]
    Parse(#[from] serde_json::Error),
}

pub fn read_sent_payments(data_dir: &Path) -> Result<Vec<StoredSentPayment>, SentPaymentStoreError> {
    let path = data_dir.join(SENT_PAYMENTS_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)?;
    let store: SentPaymentStore = serde_json::from_str(&raw)?;
    Ok(store.payments)
}

pub fn upsert_sent_payment(
    data_dir: &Path,
    payment: StoredSentPayment,
) -> Result<(), SentPaymentStoreError> {
    let mut payments = read_sent_payments(data_dir)?;
    if let Some(existing) = payments
        .iter_mut()
        .find(|entry| entry.payment_hash == payment.payment_hash)
    {
        if payment.route_hops.len() > existing.route_hops.len() {
            existing.route_hops = payment.route_hops.clone();
        }
        if existing.target_pubkey.is_none() {
            existing.target_pubkey = payment.target_pubkey.clone();
        }
        return write_store(data_dir, payments);
    }

    payments.insert(0, payment);
    if payments.len() > MAX_STORED_SENT_PAYMENTS {
        payments.truncate(MAX_STORED_SENT_PAYMENTS);
    }
    write_store(data_dir, payments)
}

fn write_store(
    data_dir: &Path,
    payments: Vec<StoredSentPayment>,
) -> Result<(), SentPaymentStoreError> {
    let store = SentPaymentStore { payments };
    let path = data_dir.join(SENT_PAYMENTS_FILE);
    let json = serde_json::to_string_pretty(&store)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn new_stored_sent_payment(
    payment_hash: String,
    kind: &str,
    amount_shannons: u128,
    target_pubkey: Option<String>,
    route_hops: Vec<String>,
) -> StoredSentPayment {
    StoredSentPayment {
        payment_hash,
        kind: kind.to_string(),
        amount_shannons: format!("0x{amount_shannons:x}"),
        target_pubkey,
        route_hops,
        created_at: Utc::now().to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> std::path::PathBuf {
        let dir = env::temp_dir().join(format!(
            "fiber-studio-sent-payments-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn upsert_dedupes_by_payment_hash() {
        let dir = temp_dir();
        let payment = new_stored_sent_payment(
            "0xabc".to_string(),
            "invoice",
            100_000_000,
            None,
            vec!["0x01".to_string()],
        );
        upsert_sent_payment(&dir, payment.clone()).unwrap();

        let mut updated = payment;
        updated.route_hops = vec!["0x01".to_string(), "0x02".to_string()];
        upsert_sent_payment(&dir, updated).unwrap();

        let loaded = read_sent_payments(&dir).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].route_hops.len(), 2);
        let _ = fs::remove_dir_all(dir);
    }
}
