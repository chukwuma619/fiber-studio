use std::collections::HashMap;

use serde::Deserialize;

use super::rpc::{self, CkbScript, JsonRpcError, RpcError};

const TESTNET_CKB_RPC_URL: &str = "https://testnet.ckbapp.dev/";

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

/// Indexer search key that matches only cells whose lock script equals `lock_script`.
fn lock_script_search_key(lock_script: &CkbScript) -> serde_json::Value {
    serde_json::json!({
        "script": {
            "code_hash": lock_script.code_hash,
            "hash_type": lock_script.hash_type,
            "args": lock_script.args,
        },
        "script_type": "lock",
        "script_search_mode": "exact"
    })
}

#[derive(Debug, Deserialize)]
struct CellOutput {
    capacity: String,
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

/// Aggregated wallet cell balances from a single indexer scan.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct WalletCellBalances {
    /// Capacity of plain CKB cells (no type script, empty data) usable as funding inputs.
    pub spendable_ckb_shannons: u128,
    /// Total capacity of every live cell under the lock (including typed/data cells).
    pub total_capacity_shannons: u128,
    /// UDT amounts keyed by type-script identity.
    pub udt_balances: HashMap<String, (CkbScript, u128)>,
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

/// True when cell data is empty (`""`, `"0x"`, or whitespace-only hex).
pub fn is_empty_cell_data(hex_data: &str) -> bool {
    let trimmed = hex_data.trim();
    let without_prefix = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);
    without_prefix.is_empty()
}

/// Eligibility rule shared with Fiber/ckb-sdk funding input selection.
pub fn is_plain_ckb_funding_cell(
    type_script: Option<&CkbScript>,
    output_data: &str,
) -> bool {
    type_script.is_none() && is_empty_cell_data(output_data)
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

fn accumulate_wallet_cell(balances: &mut WalletCellBalances, cell: CellObject) {
    let capacity = rpc::parse_hex_u128(&cell.output.capacity).unwrap_or(0);
    balances.total_capacity_shannons = balances
        .total_capacity_shannons
        .saturating_add(capacity);

    match cell.output.type_script {
        Some(type_script) => {
            let amount = u128_from_le_hex_data(&cell.output_data);
            let key = script_map_key(&type_script);
            balances
                .udt_balances
                .entry(key)
                .and_modify(|(_, total)| *total = total.saturating_add(amount))
                .or_insert((type_script, amount));
        }
        None => {
            if is_plain_ckb_funding_cell(None, &cell.output_data) {
                balances.spendable_ckb_shannons =
                    balances.spendable_ckb_shannons.saturating_add(capacity);
            }
        }
    }
}

/// Scans live cells under the wallet lock and returns spendable CKB plus UDT totals.
pub async fn scan_wallet_cell_balances(
    rpc_url: &str,
    lock_script: &CkbScript,
) -> Result<WalletCellBalances, RpcError> {
    let client = reqwest::Client::new();
    let search_key = lock_script_search_key(lock_script);

    let mut balances = WalletCellBalances::default();
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
            accumulate_wallet_cell(&mut balances, cell);
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

    Ok(balances)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_lock_script() -> CkbScript {
        CkbScript {
            code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8"
                .to_string(),
            hash_type: "type".to_string(),
            args: "0xabcdef0123456789".to_string(),
        }
    }

    fn sample_udt_script() -> CkbScript {
        CkbScript {
            code_hash: "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a"
                .to_string(),
            hash_type: "type".to_string(),
            args: "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b"
                .to_string(),
        }
    }

    #[test]
    fn ckb_rpc_url_maps_networks() {
        assert_eq!(
            ckb_rpc_url("mainnet"),
            super::super::config::MAINNET_CKB_RPC_URL
        );
        assert_eq!(ckb_rpc_url("testnet"), TESTNET_CKB_RPC_URL);
    }

    #[test]
    fn cells_capacity_request_uses_exact_script_search_mode() {
        let lock_script = sample_lock_script();
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "get_cells_capacity",
            "params": [lock_script_search_key(&lock_script)],
            "id": 1
        });
        let search_key = body["params"][0]
            .as_object()
            .expect("search key object");

        assert_eq!(body["method"], "get_cells_capacity");
        assert_eq!(
            search_key.get("script_search_mode"),
            Some(&serde_json::json!("exact"))
        );
        assert_eq!(search_key["script_type"], "lock");
        assert_eq!(search_key["script"]["code_hash"], lock_script.code_hash);
        assert_eq!(search_key["script"]["hash_type"], lock_script.hash_type);
        assert_eq!(search_key["script"]["args"], lock_script.args);
        assert!(search_key.get("filter").is_none());
    }

    #[test]
    fn spendable_capacity_search_key_filters_type_and_data_cells() {
        // Equivalent indexer filter to Fiber/ckb-sdk: type len 0, data len 0.
        let mut search_key = lock_script_search_key(&sample_lock_script());
        search_key["filter"] = serde_json::json!({
            "script_len_range": ["0x0", "0x1"],
            "output_data_len_range": ["0x0", "0x1"],
        });
        assert_eq!(search_key["script_search_mode"], "exact");
        assert_eq!(
            search_key["filter"]["script_len_range"],
            serde_json::json!(["0x0", "0x1"])
        );
        assert_eq!(
            search_key["filter"]["output_data_len_range"],
            serde_json::json!(["0x0", "0x1"])
        );
    }

    #[test]
    fn lock_script_search_key_requires_exact_match() {
        let search_key = lock_script_search_key(&sample_lock_script());
        assert_eq!(search_key["script_search_mode"], "exact");
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

    #[test]
    fn plain_ckb_funding_cell_excludes_type_and_data() {
        assert!(is_plain_ckb_funding_cell(None, "0x"));
        assert!(is_plain_ckb_funding_cell(None, ""));
        assert!(!is_plain_ckb_funding_cell(None, "0x01"));
        assert!(!is_plain_ckb_funding_cell(
            Some(&sample_udt_script()),
            "0x"
        ));
        assert!(!is_plain_ckb_funding_cell(
            Some(&sample_udt_script()),
            "0x01000000000000000000000000000000"
        ));
    }

    #[test]
    fn accumulate_wallet_cell_separates_spendable_from_udt_capacity() {
        let mut balances = WalletCellBalances::default();
        let plain_ckb = 100u128 * 100_000_000;
        let udt_occupied_ckb = 142u128 * 100_000_000;
        let data_cell_ckb = 50u128 * 100_000_000;

        accumulate_wallet_cell(
            &mut balances,
            CellObject {
                output: CellOutput {
                    capacity: format!("0x{plain_ckb:x}"),
                    type_script: None,
                },
                output_data: "0x".to_string(),
            },
        );
        accumulate_wallet_cell(
            &mut balances,
            CellObject {
                output: CellOutput {
                    capacity: format!("0x{udt_occupied_ckb:x}"),
                    type_script: Some(sample_udt_script()),
                },
                output_data: "0x00e1f505000000000000000000000000".to_string(),
            },
        );
        accumulate_wallet_cell(
            &mut balances,
            CellObject {
                output: CellOutput {
                    capacity: format!("0x{data_cell_ckb:x}"),
                    type_script: None,
                },
                output_data: "0xdead".to_string(),
            },
        );

        assert_eq!(balances.spendable_ckb_shannons, plain_ckb);
        assert_eq!(
            balances.total_capacity_shannons,
            plain_ckb + udt_occupied_ckb + data_cell_ckb
        );
        assert_eq!(balances.udt_balances.len(), 1);
        let (_, amount) = balances.udt_balances.values().next().expect("udt");
        assert_eq!(*amount, 100_000_000);
    }
}
