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
