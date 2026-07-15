use bech32::{Bech32m, Hrp};

use super::rpc::CkbScript;

const FULL_ADDRESS_TYPE: u8 = 0x00;

pub fn script_to_address(network: &str, script: &CkbScript) -> Option<String> {
    let hrp = match network {
        "mainnet" => "ckb",
        "testnet" => "ckt",
        _ => return None,
    };

    let code_hash = parse_hex_fixed::<32>(&script.code_hash)?;
    let hash_type = hash_type_byte(&script.hash_type)?;
    let args = parse_hex_bytes(&script.args)?;

    let mut payload = Vec::with_capacity(1 + 32 + 1 + args.len());
    payload.push(FULL_ADDRESS_TYPE);
    payload.extend_from_slice(&code_hash);
    payload.push(hash_type);
    payload.extend_from_slice(&args);

    // bech32 0.11 takes raw bytes and converts 8→5 internally.
    let hrp = Hrp::parse(hrp).ok()?;
    bech32::encode::<Bech32m>(hrp, &payload).ok()
}

fn hash_type_byte(hash_type: &str) -> Option<u8> {
    match hash_type {
        "data" => Some(0),
        "type" => Some(1),
        "data1" => Some(2),
        "data2" => Some(4),
        _ => None,
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_mainnet_full_address_from_script() {
        // Vector from Nervos CKB Address docs / RFC 0021 / @nervosnetwork/ckb-sdk-utils.
        let script = CkbScript {
            code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8"
                .into(),
            hash_type: "type".into(),
            args: "0xb39bbc0b3673c7d36450bc14cfcdad2d559c6c64".into(),
        };
        let address = script_to_address("mainnet", &script).expect("address");
        assert_eq!(
            address,
            "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqdnnw7qkdnnclfkg59uzn8umtfd2kwxceqxwquc4"
        );
    }

    #[test]
    fn encodes_testnet_address_from_script() {
        let script = CkbScript {
            code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8"
                .into(),
            hash_type: "type".into(),
            args: "0x628ab87da056a784d5af53d285522844b9f28b37".into(),
        };
        let address = script_to_address("testnet", &script).expect("address");
        assert_eq!(
            address,
            "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtz32u8mgzk57zdtt6n62z4y2zyh8egkdcahyxk3"
        );
    }
}
