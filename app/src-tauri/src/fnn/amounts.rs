use crate::fnn::channel::SHANNONS_PER_CKB;

pub fn format_ckb_amount(shannons: u128) -> String {
    let whole = shannons / SHANNONS_PER_CKB;
    let fraction = shannons % SHANNONS_PER_CKB;
    let fraction_str = format!("{fraction:08}");
    let trimmed = fraction_str.trim_end_matches('0');
    if trimmed.is_empty() {
        return whole.to_string();
    }
    let decimals: String = trimmed.chars().take(2).collect();
    let decimals = if decimals.len() < 2 {
        format!("{decimals}{}", "0".repeat(2 - decimals.len()))
    } else {
        decimals
    };
    format!("{whole}.{decimals}")
}

pub fn ckb_from_shannons_hex(hex: &str) -> String {
    let shannons = crate::fnn::rpc::parse_hex_u128(hex).unwrap_or(0);
    format_ckb_amount(shannons)
}

pub fn ckb_to_shannons(amount_ckb: f64) -> Result<u128, String> {
    if !amount_ckb.is_finite() || amount_ckb <= 0.0 {
        return Err("Amount must be greater than zero.".to_string());
    }
    let shannons = (amount_ckb * SHANNONS_PER_CKB as f64).round() as u128;
    if shannons == 0 {
        return Err("Amount is too small.".to_string());
    }
    Ok(shannons)
}

pub fn optional_ckb_to_shannons(amount_ckb: Option<f64>) -> Result<Option<u128>, String> {
    match amount_ckb {
        Some(value) if value > 0.0 => Ok(Some(ckb_to_shannons(value)?)),
        Some(_) => Err("Max fee must be greater than zero.".to_string()),
        None => Ok(None),
    }
}
