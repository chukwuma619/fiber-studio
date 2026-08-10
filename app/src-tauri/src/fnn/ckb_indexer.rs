use std::collections::HashMap;

use serde::Deserialize;

use super::rpc::{self, CkbScript, JsonRpcError, RpcError};

const TESTNET_CKB_RPC_URL: &str = "https://testnet.ckbapp.dev/";

#[derive(Debug, Deserialize)]
struct CellsCapacityResult {
    capacity: String,
}

#[derive(Debug, Deserialize)]
struct IndexerRpcResponse<T> {
    result: Option<T>,
    error: Option<JsonRpcError>,
}

pub fn ckb_rpc_url(network: &str) -> &'static str {
    match network {
        "mainnet" => super::config::MAINNET_CKB_RPC_URL,
        _ => TESTNET_CKB_RPC_URL,
    }
}

/// Returns total on-chain capacity (shannons) for cells locked by the wallet script.
pub async fn fetch_lock_script_capacity(
    rpc_url: &str,
    lock_script: &CkbScript,
) -> Result<u128, RpcError> {
    let client = reqwest::Client::new();
    let search_key = serde_json::json!({
        "script": {
            "code_hash": lock_script.code_hash,
            "hash_type": lock_script.hash_type,
            "args": lock_script.args,
        },
        "script_type": "lock"
    });
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "get_cells_capacity",
        "params": [search_key],
        "id": 1
    });

    let response = client.post(rpc_url).json(&body).send().await?;
    let payload: IndexerRpcResponse<CellsCapacityResult> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    let result = payload.result.ok_or(RpcError::MissingResult)?;
    rpc::parse_hex_u128(&result.capacity).ok_or(RpcError::MissingResult)
}

#[derive(Debug, Deserialize)]
struct CellOutput {
    #[serde(rename = "type", default)]
    type_script: Option<CkbScript>,
}

#[derive(Debug, Deserialize)]
struct CellObject {
    output: CellOutput,
    output_data: String,
}

#[derive(Debug, Deserialize)]
struct GetCellsResult {
    objects: Vec<CellObject>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_cursor: Option<serde_json::Value>,
}

fn script_map_key(script: &CkbScript) -> String {
    format!(
        "{}|{}|{}",
        script.code_hash.to_lowercase(),
        script.hash_type.to_lowercase(),
        script.args.to_lowercase()
    )
}

fn u128_from_le_hex_data(hex_data: &str) -> u128 {
    let trimmed = hex_data.trim();
    let without_prefix = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);
    if without_prefix.is_empty() {
        return 0;
    }

    let mut bytes = Vec::new();
    for index in (0..without_prefix.len()).step_by(2) {
        let end = (index + 2).min(without_prefix.len());
        let byte = u8::from_str_radix(&without_prefix[index..end], 16).unwrap_or(0);
        bytes.push(byte);
    }

    let mut value = 0u128;
    for (index, byte) in bytes.iter().take(16).enumerate() {
        value |= (*byte as u128) << (index * 8);
    }
    value
}

fn is_end_cursor(cursor: &serde_json::Value) -> bool {
    match cursor {
        serde_json::Value::String(value) => {
            let trimmed = value.trim();
            trimmed.is_empty() || trimmed.eq_ignore_ascii_case("0x")
        }
        serde_json::Value::Null => true,
        _ => false,
    }
}

fn get_cells_params(
    search_key: &serde_json::Value,
    after: Option<&serde_json::Value>,
) -> serde_json::Value {
    const PAGE_LIMIT: &str = "0x100";
    match after {
        Some(cursor) => serde_json::json!([search_key, "asc", PAGE_LIMIT, cursor]),
        None => serde_json::json!([search_key, "asc", PAGE_LIMIT]),
    }
}

/// Scans all live cells locked by the wallet and aggregates UDT amounts by type script.
pub async fn scan_wallet_udt_balances(
    rpc_url: &str,
    lock_script: &CkbScript,
) -> Result<HashMap<String, (CkbScript, u128)>, RpcError> {
    let client = reqwest::Client::new();
    let search_key = serde_json::json!({
        "script": {
            "code_hash": lock_script.code_hash,
            "hash_type": lock_script.hash_type,
            "args": lock_script.args,
        },
        "script_type": "lock"
    });

    let mut totals: HashMap<String, (CkbScript, u128)> = HashMap::new();
    let mut cursor: Option<serde_json::Value> = None;

    loop {
        let params = get_cells_params(&search_key, cursor.as_ref());

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "get_cells",
            "params": params,
            "id": 1
        });

        let response = client.post(rpc_url).json(&body).send().await?;
        let payload: IndexerRpcResponse<GetCellsResult> = response.json().await?;

        if let Some(error) = payload.error {
            return Err(RpcError::Rpc(error));
        }

        let result = payload.result.ok_or(RpcError::MissingResult)?;
        let page_empty = result.objects.is_empty();
        for cell in result.objects {
            if let Some(type_script) = cell.output.type_script {
                let amount = u128_from_le_hex_data(&cell.output_data);
                let key = script_map_key(&type_script);
                totals
                    .entry(key)
                    .and_modify(|(_, total)| *total = total.saturating_add(amount))
                    .or_insert((type_script, amount));
            }
        }

        let next_cursor = result.last_cursor;
        if next_cursor.is_none()
            || next_cursor.as_ref().is_some_and(is_end_cursor)
            || page_empty
        {
            break;
        }
        cursor = next_cursor;
    }

    Ok(totals)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ckb_rpc_url_maps_networks() {
        assert_eq!(
            ckb_rpc_url("mainnet"),
            super::super::config::MAINNET_CKB_RPC_URL
        );
        assert_eq!(ckb_rpc_url("testnet"), TESTNET_CKB_RPC_URL);
    }

    #[test]
    fn get_cells_params_puts_cursor_in_after_slot() {
        let search_key = serde_json::json!({"script_type": "lock"});
        let cursor = serde_json::json!("0xabc");
        let params = get_cells_params(&search_key, Some(&cursor));
        let array = params.as_array().expect("array");
        assert_eq!(array.len(), 4);
        assert_eq!(array[2], serde_json::json!("0x100"));
        assert_eq!(array[3], cursor);
    }

    #[test]
    fn is_end_cursor_recognizes_empty_hex() {
        assert!(is_end_cursor(&serde_json::json!("0x")));
        assert!(!is_end_cursor(&serde_json::json!("0x01")));
    }
}
