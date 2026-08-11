use serde::Serialize;

use super::channel::{sum_local_balances_for_asset, sum_remote_balances_for_asset};
use super::rpc::{self, CkbScript, Channel, NodeInfo, UdtScript};

pub const CKB_ASSET_ID: &str = "ckb";
pub const CKB_DECIMALS: u8 = 8;

/// Serializable asset entry for the UI catalog (CKB + whitelisted UDTs).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetView {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub udt_type_script: Option<CkbScript>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetBalanceView {
    pub asset_id: String,
    pub symbol: String,
    pub amount_display: String,
    pub raw_amount: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetChannelTotals {
    pub asset_id: String,
    pub symbol: String,
    pub local_balance: String,
    pub remote_balance: String,
    pub local_balance_display: String,
    pub capacity_display: String,
}

pub fn udt_script_to_ckb(script: &UdtScript) -> CkbScript {
    CkbScript {
        code_hash: script.code_hash.clone(),
        hash_type: script.hash_type.clone(),
        args: script.args.clone(),
    }
}

pub fn scripts_equal(left: &CkbScript, right: &CkbScript) -> bool {
    left.code_hash.eq_ignore_ascii_case(&right.code_hash)
        && left.hash_type.eq_ignore_ascii_case(&right.hash_type)
        && left.args.eq_ignore_ascii_case(&right.args)
}

pub fn asset_id_for_udt(script: &CkbScript) -> String {
    let args = script.args.trim();
    if args.starts_with("0x") || args.starts_with("0X") {
        args.to_lowercase()
    } else {
        format!("0x{args}")
    }
}

pub fn decimals_for_name(name: &str) -> u8 {
    match name.trim().to_uppercase().as_str() {
        "CKB" => CKB_DECIMALS,
        "RUSD" | "USDI" | "CWBTC" => 8,
        _ => 8,
    }
}

struct KnownUdtToken {
    code_hash: &'static str,
    args: &'static str,
    symbol: &'static str,
}

const KNOWN_UDT_TOKENS: &[KnownUdtToken] = &[
    KnownUdtToken {
        code_hash: "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
        args: "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b",
        symbol: "RUSD",
    },
    KnownUdtToken {
        code_hash: "0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb",
        args: "0x9a1086531ed6dc69e0bd44cef5278e03faf3015b31aff60b08fb87663ce8507100000000",
        symbol: "cWBTC",
    },
];

pub fn symbol_for_udt_script(script: &CkbScript) -> String {
    let code_hash = script.code_hash.to_lowercase();
    let args = script.args.to_lowercase();

    for known in KNOWN_UDT_TOKENS {
        if code_hash == known.code_hash.to_lowercase() && args == known.args.to_lowercase() {
            return known.symbol.to_string();
        }
    }

    "UDT".to_string()
}

pub fn asset_for_discovered_udt(script: &CkbScript) -> AssetView {
    let symbol = symbol_for_udt_script(script);
    let decimals = decimals_for_name(&symbol);
    AssetView {
        id: asset_id_for_udt(script),
        name: symbol.clone(),
        symbol,
        decimals,
        udt_type_script: Some(script.clone()),
    }
}

#[derive(Debug, Clone)]
pub struct WalletOnChainSnapshot {
    pub balances: Vec<AssetBalanceView>,
}

fn udt_amount_from_scan(
    scanned: &std::collections::HashMap<String, (CkbScript, u128)>,
    script: &CkbScript,
) -> u128 {
    scanned
        .values()
        .find(|(candidate, _)| scripts_equal(candidate, script))
        .map(|(_, amount)| *amount)
        .unwrap_or(0)
}

pub fn build_asset_catalog(node_info: &NodeInfo) -> Vec<AssetView> {
    let mut assets = vec![ckb_asset()];

    for udt in &node_info.udt_cfg_infos {
        let script = udt_script_to_ckb(&udt.script);
        assets.push(AssetView {
            id: asset_id_for_udt(&script),
            name: udt.name.clone(),
            symbol: udt.name.clone(),
            decimals: decimals_for_name(&udt.name),
            udt_type_script: Some(script),
        });
    }

    assets
}

pub fn ckb_asset() -> AssetView {
    AssetView {
        id: CKB_ASSET_ID.to_string(),
        name: "CKB".to_string(),
        symbol: "CKB".to_string(),
        decimals: CKB_DECIMALS,
        udt_type_script: None,
    }
}

pub fn find_asset_for_udt_script<'a>(
    catalog: &'a [AssetView],
    script: &CkbScript,
) -> Option<&'a AssetView> {
    catalog
        .iter()
        .find(|asset| asset.udt_type_script.as_ref().is_some_and(|udt| scripts_equal(udt, script)))
}

pub fn asset_for_channel_funding(
    catalog: &[AssetView],
    funding_udt: Option<&CkbScript>,
) -> AssetView {
    if let Some(script) = funding_udt {
        find_asset_for_udt_script(catalog, script).cloned().unwrap_or_else(|| {
            AssetView {
                id: asset_id_for_udt(script),
                name: "UDT".to_string(),
                symbol: "UDT".to_string(),
                decimals: 8,
                udt_type_script: Some(script.clone()),
            }
        })
    } else {
        ckb_asset()
    }
}

pub fn format_raw_amount(raw: u128, asset: &AssetView) -> String {
    format_human_amount(raw, asset.decimals)
}

pub fn format_amount_display(raw: u128, asset: &AssetView) -> String {
    format!("{} {}", format_raw_amount(raw, asset), asset.symbol)
}

pub fn format_human_amount(raw: u128, decimals: u8) -> String {
    if decimals == 0 {
        return raw.to_string();
    }

    let scale = 10u128.pow(decimals as u32);
    let whole = raw / scale;
    let fraction = raw % scale;
    let fraction_str = format!("{fraction:0>width$}", width = decimals as usize);
    let trimmed = fraction_str.trim_end_matches('0');
    if trimmed.is_empty() {
        return whole.to_string();
    }
    let display_decimals = trimmed.chars().take(8).collect::<String>();
    format!("{whole}.{display_decimals}")
}

pub fn parse_human_amount(value: f64, decimals: u8) -> Result<u128, String> {
    if !value.is_finite() || value <= 0.0 {
        return Err("Amount must be greater than zero.".to_string());
    }

    let scale = 10u128.pow(decimals as u32);
    let scaled = (value * scale as f64).round();
    if scaled <= 0.0 {
        return Err("Amount is too small.".to_string());
    }

    Ok(scaled as u128)
}

pub fn parse_human_amount_str(value: &str, decimals: u8) -> Result<u128, String> {
    crate::fnn::amounts::parse_decimal_amount_str(value, decimals)
}

pub fn invoice_udt_script(invoice: &rpc::CkbInvoice) -> Option<CkbScript> {
    if let Some(script) = invoice.udt_type_script.as_ref() {
        return Some(script.clone());
    }

    extract_udt_script_from_attrs(&invoice.data.attrs)
}

fn extract_udt_script_from_attrs(attrs: &[serde_json::Value]) -> Option<CkbScript> {
    for attr in attrs {
        if let Some(script) = attr.get("udt_type_script").and_then(parse_script_value) {
            return Some(script);
        }
        if let Some(script) = attr.get("UdtTypeScript").and_then(parse_script_value) {
            return Some(script);
        }
    }
    None
}

fn parse_script_value(value: &serde_json::Value) -> Option<CkbScript> {
    let code_hash = value
        .get("code_hash")
        .or_else(|| value.get("codeHash"))
        .and_then(|v| v.as_str())?;
    let hash_type = value
        .get("hash_type")
        .or_else(|| value.get("hashType"))
        .and_then(|v| v.as_str())?;
    let args = value.get("args").and_then(|v| v.as_str())?;
    Some(CkbScript {
        code_hash: code_hash.to_string(),
        hash_type: hash_type.to_string(),
        args: args.to_string(),
    })
}

pub fn asset_for_invoice(catalog: &[AssetView], invoice: &rpc::CkbInvoice) -> AssetView {
    if let Some(script) = invoice_udt_script(invoice) {
        asset_for_channel_funding(catalog, Some(&script))
    } else {
        ckb_asset()
    }
}

pub fn build_channel_totals(catalog: &[AssetView], channels: &[Channel]) -> Vec<AssetChannelTotals> {
    let mut totals: Vec<AssetChannelTotals> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for asset in catalog {
        let funding_udt = asset.udt_type_script.as_ref();
        let local = sum_local_balances_for_asset(channels, funding_udt);
        let remote = sum_remote_balances_for_asset(channels, funding_udt);
        if local == 0 && remote == 0 {
            continue;
        }

        let capacity = local.saturating_add(remote);
        seen_ids.insert(asset.id.to_lowercase());
        totals.push(AssetChannelTotals {
            asset_id: asset.id.clone(),
            symbol: asset.symbol.clone(),
            local_balance: format!("0x{local:x}"),
            remote_balance: format!("0x{remote:x}"),
            local_balance_display: format_amount_display(local, asset),
            capacity_display: format_amount_display(capacity, asset),
        });
    }

    for channel in channels {
        let Some(script) = channel.funding_udt_type_script.as_ref() else {
            continue;
        };
        let asset = asset_for_channel_funding(catalog, Some(script));
        if seen_ids.contains(&asset.id.to_lowercase()) {
            continue;
        }
        let local = sum_local_balances_for_asset(channels, Some(script));
        let remote = sum_remote_balances_for_asset(channels, Some(script));
        if local == 0 && remote == 0 {
            continue;
        }
        let capacity = local.saturating_add(remote);
        seen_ids.insert(asset.id.to_lowercase());
        totals.push(AssetChannelTotals {
            asset_id: asset.id.clone(),
            symbol: asset.symbol.clone(),
            local_balance: format!("0x{local:x}"),
            remote_balance: format!("0x{remote:x}"),
            local_balance_display: format_amount_display(local, &asset),
            capacity_display: format_amount_display(capacity, &asset),
        });
    }

    totals
}

pub async fn fetch_wallet_on_chain_snapshot(
    network: &str,
    lock_script: &CkbScript,
    catalog: &[AssetView],
) -> Result<WalletOnChainSnapshot, super::rpc::RpcError> {
    let rpc_url = super::ckb_indexer::ckb_rpc_url(network);
    let ckb_raw =
        super::ckb_indexer::fetch_lock_script_capacity(rpc_url, lock_script).await?;
    let scanned =
        super::ckb_indexer::scan_wallet_udt_balances(rpc_url, lock_script).await?;

    let mut balances = vec![balance_view(&ckb_asset(), ckb_raw)];

    for asset in catalog {
        if let Some(udt_script) = asset.udt_type_script.as_ref() {
            let raw = udt_amount_from_scan(&scanned, udt_script);
            balances.push(balance_view(asset, raw));
        }
    }

    for (_, (script, raw)) in scanned {
        if raw == 0 {
            continue;
        }
        if catalog
            .iter()
            .any(|asset| asset.udt_type_script.as_ref().is_some_and(|s| scripts_equal(s, &script)))
        {
            continue;
        }
        let asset = asset_for_discovered_udt(&script);
        balances.push(balance_view(&asset, raw));
    }

    Ok(WalletOnChainSnapshot { balances })
}

pub fn balance_view(asset: &AssetView, raw: u128) -> AssetBalanceView {
    AssetBalanceView {
        asset_id: asset.id.clone(),
        symbol: asset.symbol.clone(),
        amount_display: format_amount_display(raw, asset),
        raw_amount: format!("0x{raw:x}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_and_parse_human_amount() {
        let asset = ckb_asset();
        let raw = parse_human_amount(1.5, asset.decimals).expect("parse");
        assert_eq!(raw, 150_000_000);
        assert_eq!(format_amount_display(raw, &asset), "1.5 CKB");
    }

    #[test]
    fn format_human_amount_keeps_sub_cent_fees_visible() {
        // Matches the issue example: non-zero fee below 0.01 CKB must not look like 0.
        assert_eq!(format_human_amount(366_504, 8), "0.00366504");
        assert_eq!(format_human_amount(1, 8), "0.00000001");
        assert_eq!(
            format_amount_display(366_504, &ckb_asset()),
            "0.00366504 CKB"
        );
    }

    #[test]
    fn parse_human_amount_str_handles_decimals() {
        assert_eq!(
            super::parse_human_amount_str("2.25", 8).expect("parse"),
            225_000_000
        );
        assert_eq!(
            super::parse_human_amount_str("0.01111111000", 8).expect("parse"),
            1_111_111
        );
        assert_eq!(
            super::parse_human_amount_str("0.011111111", 8).unwrap_err(),
            "Amount supports at most 8 decimal places."
        );
    }

    #[test]
    fn symbol_for_cwbtc_testnet_script() {
        let script = super::rpc::CkbScript {
            code_hash: "0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb".into(),
            hash_type: "type".into(),
            args: "0x9a1086531ed6dc69e0bd44cef5278e03faf3015b31aff60b08fb87663ce8507100000000".into(),
        };
        assert_eq!(symbol_for_udt_script(&script), "cWBTC");
    }
}
