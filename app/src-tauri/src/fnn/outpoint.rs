use serde::{Deserialize, Serialize};

/// Parsed CKB outpoint. Fiber JSON-RPC still wants the packed hex string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CkbOutPoint {
    pub tx_hash: String,
    pub index: String,
}

/// Parse a Fiber/Studio channel outpoint into a CKB JSON `OutPoint`.
///
/// Accepts:
/// - packed hex (`0x` + 32-byte tx hash + optional 4-byte little-endian index)
/// - JSON object `{"tx_hash":"0x…","index":"0x0"}`
pub fn parse_outpoint(value: &str) -> Option<CkbOutPoint> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with('{') {
        return serde_json::from_str::<CkbOutPoint>(trimmed).ok().and_then(normalize);
    }

    parse_packed_hex(trimmed)
}

fn parse_packed_hex(value: &str) -> Option<CkbOutPoint> {
    let hex = value.strip_prefix("0x").or_else(|| value.strip_prefix("0X"))?;
    if hex.len() < 64 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }

    let tx_hash = format!("0x{}", hex[..64].to_ascii_lowercase());
    let index = if hex.len() >= 72 {
        let bytes = decode_hex_u32_le(&hex[64..72])?;
        format!("0x{:x}", bytes)
    } else if hex.len() == 64 {
        "0x0".to_string()
    } else {
        return None;
    };

    Some(CkbOutPoint { tx_hash, index })
}

fn decode_hex_u32_le(hex: &str) -> Option<u32> {
    if hex.len() != 8 {
        return None;
    }
    let mut bytes = [0u8; 4];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        let text = std::str::from_utf8(chunk).ok()?;
        bytes[i] = u8::from_str_radix(text, 16).ok()?;
    }
    Some(u32::from_le_bytes(bytes))
}

fn normalize(outpoint: CkbOutPoint) -> Option<CkbOutPoint> {
    let tx = outpoint.tx_hash.trim();
    let index = outpoint.index.trim();
    if tx.is_empty() || index.is_empty() {
        return None;
    }
    Some(CkbOutPoint {
        tx_hash: tx.to_string(),
        index: index.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_packed_hex_with_le_index() {
        let tx = "aa".repeat(32);
        // index 1 → LE bytes 01 00 00 00
        let packed = format!("0x{tx}01000000");
        let parsed = parse_outpoint(&packed).expect("outpoint");
        assert_eq!(parsed.tx_hash, format!("0x{tx}"));
        assert_eq!(parsed.index, "0x1");
    }

    #[test]
    fn parses_tx_hash_only_as_index_zero() {
        let tx = "bb".repeat(32);
        let parsed = parse_outpoint(&format!("0x{tx}")).expect("outpoint");
        assert_eq!(parsed.tx_hash, format!("0x{tx}"));
        assert_eq!(parsed.index, "0x0");
    }

    #[test]
    fn parses_json_object() {
        let parsed = parse_outpoint(
            r#"{"tx_hash":"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","index":"0x2"}"#,
        )
        .expect("outpoint");
        assert_eq!(
            parsed.tx_hash,
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        );
        assert_eq!(parsed.index, "0x2");
    }

    #[test]
    fn rejects_unparseable_labels() {
        assert_eq!(parse_outpoint("out-a"), None);
        assert_eq!(parse_outpoint(""), None);
        assert_eq!(parse_outpoint("not-hex"), None);
    }
}
