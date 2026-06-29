use std::fmt;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
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

/// Channel entry from `list_channels`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Channel {
    pub channel_id: String,
    pub is_public: bool,
    pub pubkey: String,
    pub state: serde_json::Value,
    pub local_balance: String,
    pub remote_balance: String,
    #[serde(default)]
    pub offered_tlc_balance: String,
    #[serde(default)]
    pub received_tlc_balance: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_detail: Option<String>,
}

/// Peer entry from `list_peers`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PeerInfo {
    pub pubkey: String,
    pub address: String,
}

/// Node entry from `graph_nodes`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphNode {
    pub pubkey: String,
    pub addresses: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_accept_min_ckb_funding_amount: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GraphNodesResult {
    nodes: Vec<GraphNode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[allow(dead_code)]
    last_cursor: Option<serde_json::Value>,
}

/// Node hop in a payment route from FNN (when exposed by the node build).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionRouteNode {
    pub pubkey: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,
}

/// Route taken by a payment session (when exposed by the node build).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionRoute {
    pub nodes: Vec<SessionRouteNode>,
}

/// Payment summary from `list_payments`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaymentSummary {
    pub payment_hash: String,
    pub status: String,
    pub created_at: u64,
    pub last_updated_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failed_error: Option<String>,
    pub fee: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routers: Vec<SessionRoute>,
}

#[derive(Debug, Deserialize)]
struct ListChannelsResult {
    channels: Vec<Channel>,
}

#[derive(Debug, Deserialize)]
struct ListPeersResult {
    peers: Vec<PeerInfo>,
}

#[derive(Debug, Deserialize)]
struct ListPaymentsResult {
    payments: Vec<PaymentSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_cursor: Option<String>,
}

/// Paginated payments from `list_payments`.
#[derive(Debug, Clone)]
pub struct ListPaymentsPage {
    pub payments: Vec<PaymentSummary>,
    pub last_cursor: Option<String>,
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

async fn call_rpc<T: DeserializeOwned>(
    method: &str,
    params: serde_json::Value,
) -> Result<T, RpcError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    });

    let response = client.post(FNN_RPC_URL).json(&body).send().await?;
    let payload: RpcResponse<T> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    payload.result.ok_or(RpcError::MissingResult)
}

pub async fn fetch_node_info() -> Result<NodeInfo, RpcError> {
    call_rpc("node_info", serde_json::json!([])).await
}

pub async fn fetch_list_channels() -> Result<Vec<Channel>, RpcError> {
    let active: ListChannelsResult = call_rpc("list_channels", serde_json::json!([{}])).await?;
    let pending: ListChannelsResult = call_rpc(
        "list_channels",
        serde_json::json!([{ "only_pending": true }]),
    )
    .await?;

    Ok(merge_channel_lists(active.channels, pending.channels)
        .into_iter()
        .filter(|channel| is_listable_channel(&channel.state))
        .collect())
}

fn merge_channel_lists(active: Vec<Channel>, pending: Vec<Channel>) -> Vec<Channel> {
    let mut merged = active;
    for channel in pending {
        if !merged
            .iter()
            .any(|existing| existing.channel_id == channel.channel_id)
        {
            merged.push(channel);
        }
    }
    merged
}

pub async fn fetch_list_peers() -> Result<Vec<PeerInfo>, RpcError> {
    let result: ListPeersResult = call_rpc("list_peers", serde_json::json!([])).await?;
    Ok(result.peers)
}

pub async fn fetch_graph_nodes() -> Result<Vec<GraphNode>, RpcError> {
    let result: GraphNodesResult =
        call_rpc("graph_nodes", serde_json::json!([{ "limit": "0x100" }])).await?;
    Ok(result.nodes)
}

pub async fn fetch_list_payments(limit: u32) -> Result<Vec<PaymentSummary>, RpcError> {
    Ok(fetch_list_payments_page(limit, None).await?.payments)
}

pub async fn fetch_list_payments_page(
    limit: u32,
    after: Option<&str>,
) -> Result<ListPaymentsPage, RpcError> {
    let mut params = serde_json::json!({
        "limit": format!("0x{limit:x}"),
    });
    if let Some(cursor) = after.filter(|value| !value.trim().is_empty()) {
        params["after"] = serde_json::Value::String(cursor.to_string());
    }

    let result: ListPaymentsResult = call_rpc("list_payments", serde_json::json!([params])).await?;
    Ok(ListPaymentsPage {
        payments: result.payments,
        last_cursor: result.last_cursor,
    })
}

/// Invoice currency for a CKB network (Fibt = testnet, Fibb = mainnet).
pub fn currency_for_network(network: &str) -> &'static str {
    match network {
        "mainnet" => "Fibb",
        _ => "Fibt",
    }
}

/// Invoice status from `get_invoice`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum CkbInvoiceStatus {
    Open,
    Cancelled,
    Expired,
    Received,
    Paid,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct InvoiceData {
    pub payment_hash: String,
    #[serde(default)]
    pub attrs: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct CkbInvoice {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    pub amount: Option<String>,
    pub data: InvoiceData,
}

/// Payment target for FNN `send_payment`.
pub enum PaymentKind<'a> {
    Invoice {
        invoice: &'a str,
    },
    Keysend {
        target_pubkey: &'a str,
        amount: u128,
    },
}

/// Options for FNN `send_payment`.
pub struct SendPaymentRequest<'a> {
    pub kind: PaymentKind<'a>,
    pub dry_run: bool,
    pub max_fee_amount: Option<u128>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct NewInvoiceResult {
    pub invoice_address: String,
    pub invoice: CkbInvoice,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct GetInvoiceResult {
    pub invoice_address: String,
    pub invoice: CkbInvoice,
    pub status: CkbInvoiceStatus,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct ParseInvoiceResult {
    pub invoice: CkbInvoice,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct SendPaymentResult {
    pub payment_hash: String,
    pub status: String,
    pub fee: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failed_error: Option<String>,
    #[serde(default)]
    pub routers: Vec<SessionRoute>,
}

/// Creates a new CKB invoice via FNN `new_invoice`.
pub async fn new_invoice(
    amount_shannons: u128,
    currency: &str,
    description: Option<&str>,
    expiry_seconds: u64,
) -> Result<NewInvoiceResult, RpcError> {
    let mut params = serde_json::json!({
        "amount": format!("0x{amount_shannons:x}"),
        "currency": currency,
        "expiry": format!("0x{expiry_seconds:x}"),
        "hash_algorithm": "sha256",
        "allow_mpp": true,
    });

    if let Some(desc) = description.filter(|value| !value.trim().is_empty()) {
        params["description"] = serde_json::Value::String(desc.to_string());
    }

    call_rpc("new_invoice", serde_json::json!([params])).await
}

/// Retrieves an invoice by payment hash via FNN `get_invoice`.
pub async fn get_invoice(payment_hash: &str) -> Result<GetInvoiceResult, RpcError> {
    call_rpc(
        "get_invoice",
        serde_json::json!([{ "payment_hash": payment_hash }]),
    )
    .await
}

/// Parses an encoded invoice string via FNN `parse_invoice`.
pub async fn parse_invoice(invoice: &str) -> Result<ParseInvoiceResult, RpcError> {
    call_rpc(
        "parse_invoice",
        serde_json::json!([{ "invoice": invoice }]),
    )
    .await
}

/// Sends or previews a payment via FNN `send_payment`.
pub async fn send_payment(request: SendPaymentRequest<'_>) -> Result<SendPaymentResult, RpcError> {
    let mut params = serde_json::json!({
        "dry_run": request.dry_run,
    });

    match request.kind {
        PaymentKind::Invoice { invoice } => {
            params["invoice"] = serde_json::Value::String(invoice.to_string());
        }
        PaymentKind::Keysend {
            target_pubkey,
            amount,
        } => {
            params["target_pubkey"] = serde_json::Value::String(target_pubkey.to_string());
            params["amount"] = serde_json::Value::String(format!("0x{amount:x}"));
            params["keysend"] = serde_json::Value::Bool(true);
        }
    }

    if let Some(max_fee) = request.max_fee_amount {
        params["max_fee_amount"] = serde_json::Value::String(format!("0x{max_fee:x}"));
    }

    if let Some(timeout) = request.timeout {
        params["timeout"] = serde_json::Value::String(format!("0x{timeout:x}"));
    }

    call_rpc("send_payment", serde_json::json!([params])).await
}

/// Retrieves a payment by hash via FNN `get_payment`.
pub async fn get_payment(payment_hash: &str) -> Result<SendPaymentResult, RpcError> {
    call_rpc(
        "get_payment",
        serde_json::json!([{ "payment_hash": payment_hash }]),
    )
    .await
}

/// Cancels an open invoice via FNN `cancel_invoice`.
pub async fn cancel_invoice(payment_hash: &str) -> Result<GetInvoiceResult, RpcError> {
    call_rpc(
        "cancel_invoice",
        serde_json::json!([{ "payment_hash": payment_hash }]),
    )
    .await
}

#[derive(Debug, Deserialize)]
struct OpenChannelResult {
    #[serde(default, rename = "channel_id")]
    channel_id: Option<String>,
}

/// Opens a channel with a connected peer.
pub async fn open_channel(
    pubkey: &str,
    funding_amount: &str,
    is_public: bool,
) -> Result<Option<String>, RpcError> {
    let params = serde_json::json!([{
        "pubkey": pubkey,
        "funding_amount": funding_amount,
        "public": is_public,
    }]);

    let result: OpenChannelResult = call_rpc("open_channel", params).await?;
    Ok(result.channel_id)
}

/// Cooperatively shuts down a channel.
pub async fn shutdown_channel(
    channel_id: &str,
    close_script: &CkbScript,
) -> Result<(), RpcError> {
    let params = serde_json::json!([{
        "channel_id": channel_id,
        "close_script": close_script,
        "fee_rate": "0x3fc",
        "force": false,
    }]);

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "shutdown_channel",
        "params": params,
        "id": 1
    });

    let response = client.post(FNN_RPC_URL).json(&body).send().await?;
    let payload: RpcResponse<serde_json::Value> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    Ok(())
}

/// Abandons a channel that is still opening (not Ready or Closed).
pub async fn abandon_channel(channel_id: &str) -> Result<(), RpcError> {
    let params = serde_json::json!([{ "channel_id": channel_id }]);

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "abandon_channel",
        "params": params,
        "id": 1
    });

    let response = client.post(FNN_RPC_URL).json(&body).send().await?;
    let payload: RpcResponse<serde_json::Value> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    Ok(())
}

/// Connect to a peer. Returns `Ok(())` when RPC succeeds (result may be null).
pub async fn connect_peer(params: serde_json::Value) -> Result<(), RpcError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "connect_peer",
        "params": params,
        "id": 1
    });

    let response = client.post(FNN_RPC_URL).json(&body).send().await?;
    let payload: RpcResponse<serde_json::Value> = response.json().await?;

    if let Some(error) = payload.error {
        return Err(RpcError::Rpc(error));
    }

    Ok(())
}

/// Parses a hex-encoded integer (with or without `0x` prefix).
pub fn parse_hex_u128(hex: &str) -> Option<u128> {
    let trimmed = hex.strip_prefix("0x").unwrap_or(hex);
    u128::from_str_radix(trimmed, 16).ok()
}

/// Returns the PascalCase variant name for a channel state JSON value.
pub fn channel_state_label(state: &serde_json::Value) -> String {
    if let Some(label) = state.as_str() {
        return label.to_string();
    }

    if let Some(obj) = state.as_object() {
        if let Some(name) = obj.get("state_name").and_then(|value| value.as_str()) {
            return name.to_string();
        }
        if let Some((key, _)) = obj.iter().next() {
            return key.clone();
        }
    }

    "Unknown".to_string()
}

pub fn is_channel_ready(state: &serde_json::Value) -> bool {
    channel_state_label(state) == "ChannelReady"
}

pub fn is_channel_pending(state: &serde_json::Value) -> bool {
    is_listable_channel(state) && !is_channel_ready(state) && channel_state_label(state) != "ShuttingDown"
}

/// Whether a channel should appear in Fiber Studio channel lists.
/// Abandoned or otherwise closed failed opens remain in fnn's pending query but are not live channels.
pub fn is_listable_channel(state: &serde_json::Value) -> bool {
    channel_state_label(state) != "Closed"
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
        assert_eq!(
            info.pubkey,
            "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71"
        );
        assert_eq!(info.channel_count, "0x7b");
        assert!(payload.error.is_none());
    }

    #[test]
    fn deserializes_json_rpc_errors() {
        let payload: RpcResponse<NodeInfo> = serde_json::from_str(METHOD_NOT_FOUND_ERROR).unwrap();
        let error = payload.error.expect("error should be present");
        assert_eq!(error.code, -32601);
        assert_eq!(error.message, "Method not found");
        assert!(error.data.is_none());

        let payload: RpcResponse<NodeInfo> = serde_json::from_str(INVALID_PARAMS_ERROR).unwrap();
        let error = payload.error.expect("error should be present");
        assert_eq!(error.code, -32602);
        assert_eq!(error.message, "Invalid params");
        assert_eq!(
            error.data,
            Some(serde_json::Value::String(
                "failed to decode hex string".into()
            ))
        );
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

    const LIST_CHANNELS_SUCCESS: &str = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "channels": [{
                "channel_id": "0xabc123",
                "is_public": true,
                "is_acceptor": false,
                "is_one_way": false,
                "channel_outpoint": null,
                "pubkey": "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
                "funding_udt_type_script": null,
                "state": "ChannelReady",
                "local_balance": "0xbebc200",
                "offered_tlc_balance": "0x0",
                "remote_balance": "0x2faf080",
                "received_tlc_balance": "0x0",
                "pending_tlcs": [],
                "latest_commitment_transaction_hash": null,
                "created_at": 1718000000000,
                "enabled": true,
                "tlc_expiry_delta": 86400000,
                "tlc_fee_proportional_millionths": 1000,
                "shutdown_transaction_hash": null,
                "failure_detail": null
            }]
        }
    }"#;

    const LIST_PAYMENTS_SUCCESS: &str = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "payments": [{
                "payment_hash": "0xdeadbeef",
                "status": "Success",
                "created_at": 1718000000000,
                "last_updated_at": 1718000001000,
                "failed_error": null,
                "fee": "0x3e8",
                "custom_records": null,
                "routers": []
            }],
            "last_cursor": null
        }
    }"#;

    #[test]
    fn deserializes_list_channels_success_response() {
        let payload: RpcResponse<ListChannelsResult> =
            serde_json::from_str(LIST_CHANNELS_SUCCESS).unwrap();
        let result = payload.result.expect("result should be present");
        assert_eq!(result.channels.len(), 1);
        assert_eq!(result.channels[0].local_balance, "0xbebc200");
        assert!(is_channel_ready(&result.channels[0].state));
    }

    #[test]
    fn deserializes_list_payments_success_response() {
        let payload: RpcResponse<ListPaymentsResult> =
            serde_json::from_str(LIST_PAYMENTS_SUCCESS).unwrap();
        let result = payload.result.expect("result should be present");
        assert_eq!(result.payments.len(), 1);
        assert_eq!(result.payments[0].status, "Success");
    }

    #[test]
    fn parse_hex_u128_handles_prefixed_and_plain_hex() {
        assert_eq!(parse_hex_u128("0xbebc200"), Some(200_000_000));
        assert_eq!(parse_hex_u128("bebc200"), Some(200_000_000));
    }

    #[test]
    fn channel_state_label_reads_state_name_object() {
        let state = serde_json::json!({
            "state_name": "NegotiatingFunding",
            "state_flags": "OUR_INIT_SENT|INIT_SENT"
        });
        assert_eq!(channel_state_label(&state), "NegotiatingFunding");
    }

    #[test]
    fn is_listable_channel_excludes_closed() {
        let closed = serde_json::json!({
            "state_name": "Closed",
            "state_flags": "FUNDING_ABORTED"
        });
        let opening = serde_json::json!({
            "state_name": "NegotiatingFunding",
            "state_flags": "OUR_INIT_SENT"
        });

        assert!(!super::is_listable_channel(&closed));
        assert!(super::is_listable_channel(&opening));
        assert!(super::is_listable_channel(&serde_json::json!("ChannelReady")));
    }

    #[test]
    fn is_channel_pending_includes_opening_excludes_ready_and_closing() {
        let ready = serde_json::json!("ChannelReady");
        let opening = serde_json::json!({
            "state_name": "NegotiatingFunding",
            "state_flags": "OUR_INIT_SENT"
        });
        let closing = serde_json::json!("ShuttingDown");
        let closed = serde_json::json!({
            "state_name": "Closed",
            "state_flags": "FUNDING_ABORTED"
        });

        assert!(!super::is_channel_pending(&ready));
        assert!(super::is_channel_pending(&opening));
        assert!(!super::is_channel_pending(&closing));
        assert!(!super::is_channel_pending(&closed));
    }

    #[test]
    fn merge_channel_lists_dedupes_by_channel_id() {
        let active = vec![Channel {
            channel_id: "0xabc".into(),
            is_public: true,
            pubkey: "02aa".into(),
            state: serde_json::json!("ChannelReady"),
            local_balance: "0x1".into(),
            remote_balance: "0x2".into(),
            offered_tlc_balance: String::new(),
            received_tlc_balance: String::new(),
            enabled: true,
            failure_detail: None,
        }];
        let pending = vec![
            Channel {
                channel_id: "0xabc".into(),
                is_public: true,
                pubkey: "02aa".into(),
                state: serde_json::json!("AwaitingTxSignatures"),
                local_balance: "0x1".into(),
                remote_balance: "0x0".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: false,
                failure_detail: None,
            },
            Channel {
                channel_id: "0xdef".into(),
                is_public: false,
                pubkey: "02bb".into(),
                state: serde_json::json!({
                    "state_name": "NegotiatingFunding",
                    "state_flags": "OUR_INIT_SENT"
                }),
                local_balance: "0x3".into(),
                remote_balance: "0x0".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: false,
                failure_detail: Some("Peer did not respond".into()),
            },
        ];

        let merged = merge_channel_lists(active, pending);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].channel_id, "0xabc");
        assert_eq!(merged[1].channel_id, "0xdef");
    }
}
