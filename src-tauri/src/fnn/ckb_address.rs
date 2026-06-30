use bech32::{Bech32m, Hrp};
use blake2::{Blake2b512, Digest};

use super::rpc::CkbScript;

const FULL_ADDRESS_TYPE: u8 = 0x00;

pub fn script_to_address(network: &str, script: &CkbScript) -> Option<String> {
    let hrp = match network {
        "mainnet" => "ckb",
        "testnet" => "ckt",
        _ => return None,
    };

    let serialized = serialize_script(script)?;
    let script_hash = blake2b_256(&serialized);
    let mut payload = Vec::with_capacity(33);
    payload.push(FULL_ADDRESS_TYPE);
    payload.extend_from_slice(&script_hash);

    let hrp = Hrp::parse(hrp).ok()?;
    bech32::encode::<Bech32m>(hrp, &payload_to_five_bit(&payload))
        .ok()
}

fn serialize_script(script: &CkbScript) -> Option<Vec<u8>> {
    let code_hash = parse_hex_fixed::<32>(&script.code_hash)?;
    let hash_type = hash_type_byte(&script.hash_type)?;
    let args = parse_hex_bytes(&script.args)?;

    let args_len = args.len();
    let data_size = 32 + 1 + 4 + args_len;
    let header_size = 4 + 3 * 4;
    let mut out = Vec::with_capacity(header_size + data_size);

    out.extend_from_slice(&3u32.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&32u32.to_le_bytes());
    out.extend_from_slice(&33u32.to_le_bytes());
    out.extend_from_slice(&code_hash);
    out.push(hash_type);
    out.extend_from_slice(&(args_len as u32).to_le_bytes());
    out.extend_from_slice(&args);
    Some(out)
}

fn hash_type_byte(hash_type: &str) -> Option<u8> {
    match hash_type {
        "data" => Some(0),
        "type" => Some(1),
        "data1" => Some(2),
        "data2" => Some(3),
        _ => None,
    }
}

fn blake2b_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Blake2b512::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result[..32]);
    out
}

fn parse_hex_fixed<const N: usize>(value: &str) -> Option<[u8; N]> {
    let trimmed = value.trim().trim_start_matches("0x");
    if trimmed.len() != N * 2 {
        return None;
    }
    let mut out = [0u8; N];
    for (index, chunk) in trimmed.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).ok()?;
        out[index] = u8::from_str_radix(pair, 16).ok()?;
    }
    Some(out)
}

fn parse_hex_bytes(value: &str) -> Option<Vec<u8>> {
    let trimmed = value.trim().trim_start_matches("0x");
    if trimmed.is_empty() {
        return Some(Vec::new());
    }
    if !trimmed.len().is_multiple_of(2) {
        return None;
    }
    let mut bytes = Vec::with_capacity(trimmed.len() / 2);
    for chunk in trimmed.as_bytes().chunks(2) {
        let pair = std::str::from_utf8(chunk).ok()?;
        bytes.push(u8::from_str_radix(pair, 16).ok()?);
    }
    Some(bytes)
}

fn payload_to_five_bit(data: &[u8]) -> Vec<u8> {
    convert_bits(data, 8, 5, true).unwrap_or_default()
}

fn convert_bits(
    data: &[u8],
    from_bits: u32,
    to_bits: u32,
    pad: bool,
) -> Option<Vec<u8>> {
    let mut acc = 0u32;
    let mut bits = 0u32;
    let mut ret = Vec::new();
    let maxv = (1u32 << to_bits) - 1;

    for value in data {
        let v = *value as u32;
        if (v >> from_bits) != 0 {
            return None;
        }
        acc = (acc << from_bits) | v;
        bits += from_bits;
        while bits >= to_bits {
            bits -= to_bits;
            ret.push(((acc >> bits) & maxv) as u8);
        }
    }

    if pad {
        if bits > 0 {
            ret.push(((acc << (to_bits - bits)) & maxv) as u8);
        }
    } else if bits >= from_bits || ((acc << (to_bits - bits)) & maxv) != 0 {
        return None;
    }

    Some(ret)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_testnet_address_from_script() {
        let script = CkbScript {
            code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8".into(),
            hash_type: "type".into(),
            args: "0x628ab87da056a784d5af53d285522844b9f28b37".into(),
        };
        let address = script_to_address("testnet", &script).expect("address");
        assert!(address.starts_with("ckt1"));
    }
}
