use std::fmt;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const FNN_RPC_PORT: u16 = 8227;
const FNN_RPC_URL: &str = "http://127.0.0.1:8227";
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(500);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(120);

/// JSON-RPC 2.0 error object returned by fnn.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl fmt::Display for JsonRpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}) {}", self.code, self.message)?;
        if let Some(data) = &self.data {
            write!(f, " [data: {data}]")?;
        }
        Ok(())
    }
}

impl std::error::Error for JsonRpcError {}

/// CKB script object used in RPC responses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CkbScript {
    pub code_hash: String,
    pub hash_type: String,
    pub args: String,
}

/// UDT script referenced in node configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UdtScript {
    pub code_hash: String,
    pub hash_type: String,
    pub args: String,
}

/// Type-ID cell dependency for a UDT configuration entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UdtTypeIdDep {
    pub code_hash: String,
    pub hash_type: String,
    pub args: String,
}

/// Cell dependency entry for a UDT configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UdtDep {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cell_dep: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub type_id: Option<UdtTypeIdDep>,
}

/// UDT configuration entry from `node_info`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UdtArgInfo {
    pub name: String,
    pub script: UdtScript,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_accept_amount: Option<String>,
    pub cell_deps: Vec<UdtDep>,
}

/// Full `node_info` RPC result (upstream `NodeInfoResult`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NodeInfo {
    pub version: String,
    pub commit_hash: String,
    pub pubkey: String,
    pub features: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_name: Option<String>,
    pub addresses: Vec<String>,
    pub chain_hash: String,
    pub open_channel_auto_accept_min_ckb_funding_amount: String,
    pub auto_accept_channel_ckb_funding_amount: String,
    pub default_funding_lock_script: CkbScript,
    pub tlc_expiry_delta: String,
    pub tlc_min_value: String,
    pub tlc_fee_proportional_millionths: String,
    pub channel_count: String,
    pub pending_channel_count: String,
    pub peers_count: String,
    pub udt_cfg_infos: Vec<UdtArgInfo>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RpcResponse<T> {
    #[serde(default)]
    jsonrpc: Option<String>,
    result: Option<T>,
    error: Option<JsonRpcError>,
    #[serde(default)]
    id: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
pub enum RpcError {
    #[error("fnn RPC request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("fnn RPC error: {0}")]
    Rpc(#[from] JsonRpcError),
    #[error("fnn RPC did not become ready within {0} seconds")]
    Timeout(u64),
    #[error("fnn RPC response missing result")]
    MissingResult,
}

pub async fn fetch_node_info() -> Result<NodeInfo, RpcError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "node_info",
        "params": [],
        "id": 1
    });

    let response = client.post(FNN_RPC_URL).json(&body).send().await?;
    let payload: RpcResponse<NodeInfo> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    payload.result.ok_or(RpcError::MissingResult)
}

pub async fn wait_for_node_info() -> Result<NodeInfo, RpcError> {
    let started = Instant::now();

    loop {
        match fetch_node_info().await {
            Ok(info) => return Ok(info),
            Err(_) if started.elapsed() < HEALTH_TIMEOUT => {
                tokio::time::sleep(HEALTH_POLL_INTERVAL).await;
            }
            Err(RpcError::Timeout(_)) => {
                return Err(RpcError::Timeout(HEALTH_TIMEOUT.as_secs()));
            }
            Err(_) if started.elapsed() >= HEALTH_TIMEOUT => {
                return Err(RpcError::Timeout(HEALTH_TIMEOUT.as_secs()));
            }
            Err(_) => {
                tokio::time::sleep(HEALTH_POLL_INTERVAL).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NODE_INFO_SUCCESS: &str = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "version": "0.9.0-rc4",
            "commit_hash": "05ccebf 2026-06-18",
            "pubkey": "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
            "features": ["GOSSIP_QUERIES_REQUIRED"],
            "node_name": "CkbaNode-1",
            "addresses": ["/ip4/127.0.0.1/tcp/8228"],
            "chain_hash": "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606",
            "open_channel_auto_accept_min_ckb_funding_amount": "0x9502f9000",
            "auto_accept_channel_ckb_funding_amount": "0x5d21dba00",
            "default_funding_lock_script": {
                "code_hash": "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
                "hash_type": "type",
                "args": "0x24ab9e804a1b7f3f303ff54af57e6a0112c72f2a"
            },
            "tlc_expiry_delta": "0xdbba00",
            "tlc_min_value": "0x0",
            "tlc_fee_proportional_millionths": "0x3e8",
            "channel_count": "0x7b",
            "pending_channel_count": "0x0",
            "peers_count": "0xa",
            "udt_cfg_infos": []
        }
    }"#;

    const METHOD_NOT_FOUND_ERROR: &str = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "error": {
            "code": -32601,
            "message": "Method not found"
        }
    }"#;

    const INVALID_PARAMS_ERROR: &str = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "error": {
            "code": -32602,
            "message": "Invalid params",
            "data": "failed to decode hex string"
        }
    }"#;

    #[test]
    fn deserializes_node_info_success_response() {
        let payload: RpcResponse<NodeInfo> = serde_json::from_str(NODE_INFO_SUCCESS).unwrap();
        let info = payload.result.expect("result should be present");
        assert_eq!(info.version, "0.9.0-rc4");
        assert_eq!(info.pubkey, "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71");
        assert_eq!(info.channel_count, "0x7b");
        assert!(payload.error.is_none());
    }

    #[test]
    fn deserializes_json_rpc_errors() {
        let payload: RpcResponse<NodeInfo> =
            serde_json::from_str(METHOD_NOT_FOUND_ERROR).unwrap();
        let error = payload.error.expect("error should be present");
        assert_eq!(error.code, -32601);
        assert_eq!(error.message, "Method not found");
        assert!(error.data.is_none());

        let payload: RpcResponse<NodeInfo> =
            serde_json::from_str(INVALID_PARAMS_ERROR).unwrap();
        let error = payload.error.expect("error should be present");
        assert_eq!(error.code, -32602);
        assert_eq!(error.message, "Invalid params");
        assert_eq!(error.data, Some(serde_json::Value::String("failed to decode hex string".into())));
    }

    #[test]
    fn formats_json_rpc_error_for_display() {
        let error = JsonRpcError {
            code: -32000,
            message: "invoice not found".into(),
            data: None,
        };
        assert_eq!(error.to_string(), "(-32000) invoice not found");
    }
}
