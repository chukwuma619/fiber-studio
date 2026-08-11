use crate::fnn::channel::SHANNONS_PER_CKB;

#[cfg(test)]
const CKB_DECIMALS: u8 = 8;

#[cfg(test)]
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

/// Parse a human-entered decimal amount into the smallest unit using exact
/// integer arithmetic (no floating point).
///
/// Trailing zeroes beyond `decimals` are accepted when they do not change the
/// represented value. Non-zero digits beyond `decimals` are rejected.
pub fn parse_decimal_amount_str(value: &str, decimals: u8) -> Result<u128, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Amount is required.".to_string());
    }

    if trimmed.chars().any(|c| !(c.is_ascii_digit() || c == '.')) {
        return Err("Invalid amount.".to_string());
    }

    let (whole_str, frac_str) = match trimmed.split_once('.') {
        Some((whole, frac)) => {
            if whole.is_empty() || frac.contains('.') {
                return Err("Invalid amount.".to_string());
            }
            (whole, frac)
        }
        None => (trimmed, ""),
    };

    let whole = whole_str
        .parse::<u128>()
        .map_err(|_| "Invalid amount.".to_string())?;

    let frac_significant = frac_str.trim_end_matches('0');
    if frac_significant.len() > decimals as usize {
        return Err(format!(
            "Amount supports at most {decimals} decimal places."
        ));
    }

    let frac_value = if decimals == 0 {
        0u128
    } else {
        let frac_padded = format!("{frac_significant:0<width$}", width = decimals as usize);
        frac_padded
            .parse::<u128>()
            .map_err(|_| "Invalid amount.".to_string())?
    };

    let scale = 10u128.pow(decimals as u32);
    let raw = whole
        .checked_mul(scale)
        .and_then(|value| value.checked_add(frac_value))
        .ok_or_else(|| "Amount is too large.".to_string())?;

    if raw == 0 {
        return Err("Amount must be greater than zero.".to_string());
    }

    Ok(raw)
}

#[cfg(test)]
pub fn ckb_to_shannons_str(amount_ckb: &str) -> Result<u128, String> {
    parse_decimal_amount_str(amount_ckb, CKB_DECIMALS)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ckb_to_shannons_str_accepts_exactly_8_decimals() {
        assert_eq!(
            ckb_to_shannons_str("0.01111111").unwrap(),
            1_111_111
        );
        assert_eq!(ckb_to_shannons_str("1.00000001").unwrap(), 100_000_001);
        assert_eq!(ckb_to_shannons_str("2.25").unwrap(), 225_000_000);
    }

    #[test]
    fn ckb_to_shannons_str_rejects_excess_nonzero_precision() {
        let err = ckb_to_shannons_str("0.01111111111111111111111111111111111111111")
            .unwrap_err();
        assert_eq!(err, "Amount supports at most 8 decimal places.");

        let err = ckb_to_shannons_str("0.011111111").unwrap_err();
        assert_eq!(err, "Amount supports at most 8 decimal places.");
    }

    #[test]
    fn ckb_to_shannons_str_accepts_trailing_zeroes_beyond_8_decimals() {
        assert_eq!(
            ckb_to_shannons_str("0.01111111000").unwrap(),
            1_111_111
        );
        assert_eq!(ckb_to_shannons_str("1.000000000").unwrap(), 100_000_000);
        assert_eq!(ckb_to_shannons_str("2.2500000000").unwrap(), 225_000_000);
    }

    #[test]
    fn ckb_to_shannons_str_rejects_values_below_one_shannon() {
        // 9 decimal places with a non-zero ninth digit cannot be represented.
        let err = ckb_to_shannons_str("0.000000001").unwrap_err();
        assert_eq!(err, "Amount supports at most 8 decimal places.");

        assert_eq!(ckb_to_shannons_str("0.00000001").unwrap(), 1);
        assert!(ckb_to_shannons_str("0").is_err());
        assert!(ckb_to_shannons_str("0.00000000").is_err());
    }

    #[test]
    fn ckb_to_shannons_str_rejects_invalid_inputs() {
        assert!(ckb_to_shannons_str("").is_err());
        assert!(ckb_to_shannons_str("-1").is_err());
        assert!(ckb_to_shannons_str("1e-2").is_err());
        assert!(ckb_to_shannons_str("1.2.3").is_err());
        assert!(ckb_to_shannons_str(".5").is_err());
    }

    #[test]
    fn optional_ckb_to_shannons_treats_none_as_node_default() {
        assert_eq!(optional_ckb_to_shannons(None).unwrap(), None);
    }

    #[test]
    fn optional_ckb_to_shannons_rejects_zero_instead_of_omitting() {
        let err = optional_ckb_to_shannons(Some(0.0)).unwrap_err();
        assert_eq!(err, "Max fee must be greater than zero.");
        let err = optional_ckb_to_shannons(Some(-1.0)).unwrap_err();
        assert_eq!(err, "Max fee must be greater than zero.");
    }

    #[test]
    fn optional_ckb_to_shannons_accepts_explicit_positive_and_sub_cent() {
        assert_eq!(
            optional_ckb_to_shannons(Some(1.25)).unwrap(),
            Some(125_000_000)
        );
        // 0.00000001 CKB = 1 shannon
        assert_eq!(optional_ckb_to_shannons(Some(0.00000001)).unwrap(), Some(1));
        // ~0.003665 CKB remains visibly non-zero and convertible
        assert_eq!(
            optional_ckb_to_shannons(Some(0.00366504)).unwrap(),
            Some(366_504)
        );
    }
}
