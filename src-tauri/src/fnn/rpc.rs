use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use thiserror::Error;

const FNN_RPC_URL: &str = "http://127.0.0.1:8227";
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(500);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    pub version: String,
    pub pubkey: String,
}

#[derive(Debug, Deserialize)]
struct RpcResponse {
    result: Option<NodeInfo>,
    error: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
pub enum RpcError {
    #[error("fnn RPC request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("fnn RPC error: {0}")]
    Rpc(String),
    #[error("fnn RPC did not become ready within {0} seconds")]
    Timeout(u64),
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
    let payload: RpcResponse = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error.to_string()));
    }

    payload
        .result
        .ok_or_else(|| RpcError::Rpc("node_info returned no result".into()))
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
