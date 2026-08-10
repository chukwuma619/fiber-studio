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
struct CellWithData {
    output_data: String,
}

#[derive(Debug, Deserialize)]
struct GetCellsResult {
    objects: Vec<CellWithData>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_cursor: Option<serde_json::Value>,
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

/// Returns total on-chain UDT amount for cells locked by the wallet and typed by the UDT script.
pub async fn fetch_udt_balance(
    rpc_url: &str,
    lock_script: &CkbScript,
    udt_type_script: &CkbScript,
) -> Result<u128, RpcError> {
    let client = reqwest::Client::new();
    let search_key = serde_json::json!({
        "script": {
            "code_hash": lock_script.code_hash,
            "hash_type": lock_script.hash_type,
            "args": lock_script.args,
        },
        "script_type": "lock",
        "filter": {
            "script": {
                "code_hash": udt_type_script.code_hash,
                "hash_type": udt_type_script.hash_type,
                "args": udt_type_script.args,
            },
            "script_type": "type",
        }
    });

    let mut total = 0u128;
    let mut cursor: Option<serde_json::Value> = None;

    loop {
        let mut params = serde_json::json!([search_key, "asc", "0x100"]);
        if let Some(last_cursor) = &cursor {
            params[2] = last_cursor.clone();
        }

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
        for cell in result.objects {
            total = total.saturating_add(u128_from_le_hex_data(&cell.output_data));
        }

        cursor = result.last_cursor;
        if cursor.is_none() {
            break;
        }
    }

    Ok(total)
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
}
