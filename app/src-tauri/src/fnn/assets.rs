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

pub fn find_asset_by_id<'a>(catalog: &'a [AssetView], asset_id: &str) -> Option<&'a AssetView> {
    catalog
        .iter()
        .find(|asset| asset.id.eq_ignore_ascii_case(asset_id))
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
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Amount is required.".to_string());
    }

    if trimmed.contains('.') {
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() != 2 {
            return Err("Invalid amount.".to_string());
        }
        let whole = parts[0].parse::<u128>().map_err(|_| "Invalid amount.".to_string())?;
        let frac = parts[1];
        if frac.len() > decimals as usize {
            return Err(format!("Too many decimal places (max {decimals})."));
        }
        let frac_padded = format!("{frac:0<width$}", width = decimals as usize);
        let frac_value = frac_padded
            .parse::<u128>()
            .map_err(|_| "Invalid amount.".to_string())?;
        let scale = 10u128.pow(decimals as u32);
        let raw = whole.saturating_mul(scale).saturating_add(frac_value);
        if raw == 0 {
            return Err("Amount must be greater than zero.".to_string());
        }
        return Ok(raw);
    }

    let whole = trimmed
        .parse::<u128>()
        .map_err(|_| "Invalid amount.".to_string())?;
    if whole == 0 {
        return Err("Amount must be greater than zero.".to_string());
    }
    Ok(whole.saturating_mul(10u128.pow(decimals as u32)))
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

    for asset in catalog {
        let funding_udt = asset.udt_type_script.as_ref();
        let local = sum_local_balances_for_asset(channels, funding_udt);
        let remote = sum_remote_balances_for_asset(channels, funding_udt);
        if local == 0 && remote == 0 {
            continue;
        }

        let capacity = local.saturating_add(remote);
        totals.push(AssetChannelTotals {
            asset_id: asset.id.clone(),
            symbol: asset.symbol.clone(),
            local_balance: format!("0x{local:x}"),
            remote_balance: format!("0x{remote:x}"),
            local_balance_display: format_amount_display(local, asset),
            capacity_display: format_amount_display(capacity, asset),
        });
    }

    totals
}

pub async fn fetch_on_chain_balances(
    network: &str,
    lock_script: &CkbScript,
    catalog: &[AssetView],
) -> Result<Vec<AssetBalanceView>, super::rpc::RpcError> {
    let rpc_url = super::ckb_indexer::ckb_rpc_url(network);
    let mut balances = Vec::with_capacity(catalog.len());

    for asset in catalog {
        let raw = if let Some(udt_script) = asset.udt_type_script.as_ref() {
            super::ckb_indexer::fetch_udt_balance(rpc_url, lock_script, udt_script).await?
        } else {
            super::ckb_indexer::fetch_lock_script_capacity(rpc_url, lock_script).await?
        };
        balances.push(balance_view(asset, raw));
    }

    Ok(balances)
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
    fn parse_human_amount_str_handles_decimals() {
        assert_eq!(
            super::parse_human_amount_str("2.25", 8).expect("parse"),
            225_000_000
        );
    }
}
