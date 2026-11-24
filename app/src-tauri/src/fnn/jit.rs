use super::channel::SHANNONS_PER_CKB;
use super::rpc::parse_hex_u128;

/// Extra routing room on a dry-run fee cap so pathfinding can price hops before the liquidity node.
pub const PREVIEW_ROUTING_HEADROOM_SHANNONS: u128 = 10 * SHANNONS_PER_CKB;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JitInvoiceQuote {
    pub liquidity_provider: Option<String>,
    /// `None` when the attribute is absent; `Some(0)` is a quoted zero fee.
    pub open_fee_shannons: Option<u128>,
}

pub fn quote_from_attrs(attrs: &[serde_json::Value]) -> JitInvoiceQuote {
    let mut quote = JitInvoiceQuote {
        liquidity_provider: None,
        open_fee_shannons: None,
    };

    for attr in attrs {
        if quote.liquidity_provider.is_none() {
            quote.liquidity_provider =
                attr_string(attr, &["liquidity_provider", "LiquidityProvider"]);
        }
        if quote.open_fee_shannons.is_none() {
            if let Some(value) = attr.get("jit_open_fee").or_else(|| attr.get("JitOpenFee")) {
                quote.open_fee_shannons = parse_u128_value(value);
            }
        }
    }

    quote
}

/// Compressed secp256k1 pubkey, stored as 66 lowercase hex characters.
pub fn normalize_lsp_pubkey(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let hex_str = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);

    if hex_str.len() != 66
        || !hex_str
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(
            "Liquidity node pubkey must be a 33-byte compressed key (66 hex characters)."
                .to_string(),
        );
    }

    let prefix = &hex_str[..2];
    if !prefix.eq_ignore_ascii_case("02") && !prefix.eq_ignore_ascii_case("03") {
        return Err(
            "Liquidity node pubkey must be a compressed key (it starts with 02 or 03).".to_string(),
        );
    }

    Ok(hex_str.to_ascii_lowercase())
}

pub fn shannons_to_ckb_input(shannons: u128) -> String {
    let whole = shannons / SHANNONS_PER_CKB;
    let fraction = shannons % SHANNONS_PER_CKB;
    if fraction == 0 {
        return whole.to_string();
    }
    let fraction_str = format!("{fraction:08}");
    let trimmed = fraction_str.trim_end_matches('0');
    format!("{whole}.{trimmed}")
}

pub fn format_open_fee(shannons: u128) -> String {
    format!("{} CKB", shannons_to_ckb_input(shannons))
}

/// Raises a short cap on dry run so preview can price the path; the real send uses the payer's cap.
pub fn fee_cap_for_payment(
    dry_run: bool,
    requested: Option<u128>,
    open_fee: Option<u128>,
) -> Result<Option<u128>, String> {
    let Some(open_fee) = open_fee.filter(|fee| *fee > 0) else {
        return Ok(requested);
    };

    if dry_run {
        let floor = open_fee.saturating_add(PREVIEW_ROUTING_HEADROOM_SHANNONS);
        return Ok(Some(requested.unwrap_or(0).max(floor)));
    }

    match requested {
        None => Err(
            "This invoice includes a channel open fee. Set a max fee at least that large before sending."
                .to_string(),
        ),
        Some(cap) if cap < open_fee => Err(format!(
            "Max fee is below the invoice open fee ({}).",
            format_open_fee(open_fee)
        )),
        Some(cap) => Ok(Some(cap)),
    }
}

pub fn friendly_new_invoice_error(error: String) -> String {
    if error.contains("JIT channel invoices do not support multi-part") {
        return "Just-in-time invoices cannot use multi-part payments.".to_string();
    }
    error
}

/// True when Fiber failed to attach JIT terms and can still mint an ordinary invoice.
pub fn ordinary_invoice_on_jit_miss(error: &str) -> bool {
    error.contains("JIT liquidity node has not confirmed the open fee")
        || error.contains("Node does not support trampoline routing")
}

fn attr_string(attr: &serde_json::Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(text) = attr.get(*key).and_then(|value| value.as_str()) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn parse_u128_value(value: &serde_json::Value) -> Option<u128> {
    match value {
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                return None;
            }
            if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
                parse_hex_u128(trimmed)
            } else {
                trimmed.parse().ok()
            }
        }
        serde_json::Value::Number(number) => number.as_u128(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_snake_case_jit_attributes() {
        let attrs = vec![
            json!({ "description": "rent" }),
            json!({ "liquidity_provider": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
            json!({ "jit_open_fee": "0x5f5e100" }),
        ];
        let quote = quote_from_attrs(&attrs);
        assert_eq!(
            quote.liquidity_provider.as_deref(),
            Some("02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_eq!(quote.open_fee_shannons, Some(100_000_000));
    }

    #[test]
    fn a_missing_jit_fee_still_allows_an_ordinary_invoice() {
        assert!(ordinary_invoice_on_jit_miss(
            "JIT liquidity node has not confirmed the open fee"
        ));
        assert!(ordinary_invoice_on_jit_miss(
            "Node does not support trampoline routing, please enable trampoline routing feature"
        ));
        assert!(!ordinary_invoice_on_jit_miss("amount must be positive"));
    }

    #[test]
    fn distinguishes_a_zero_quote_from_a_missing_fee() {
        assert_eq!(
            quote_from_attrs(&[json!({ "jit_open_fee": "0x0" })]).open_fee_shannons,
            Some(0)
        );
        assert_eq!(quote_from_attrs(&[]).open_fee_shannons, None);
    }

    #[test]
    fn normalizes_compressed_pubkeys() {
        let hex = "02ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
        assert_eq!(
            normalize_lsp_pubkey(&format!("0x{hex}")).unwrap(),
            hex.to_ascii_lowercase()
        );
        assert!(normalize_lsp_pubkey("04abcd").is_err());
        assert!(normalize_lsp_pubkey(
            "01aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        )
        .is_err());
    }

    #[test]
    fn dry_run_raises_a_short_cap_and_send_rejects_it() {
        let open_fee = 50_000_000;
        let dry = fee_cap_for_payment(true, None, Some(open_fee)).unwrap();
        assert_eq!(dry, Some(open_fee + PREVIEW_ROUTING_HEADROOM_SHANNONS));
        assert!(fee_cap_for_payment(false, None, Some(open_fee)).is_err());
        assert!(fee_cap_for_payment(false, Some(open_fee - 1), Some(open_fee)).is_err());
        assert_eq!(
            fee_cap_for_payment(false, Some(open_fee), Some(open_fee)).unwrap(),
            Some(open_fee)
        );
        assert_eq!(fee_cap_for_payment(false, None, Some(0)).unwrap(), None);
    }
}
