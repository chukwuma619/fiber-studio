use serde::Serialize;

use super::peer_connect;
use super::rpc::{self, parse_hex_u128, Channel};

pub const SHANNONS_PER_CKB: u128 = 100_000_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeChannel {
    pub channel_id: String,
    pub pubkey: String,
    pub is_public: bool,
    pub state: String,
    pub local_balance: String,
    pub remote_balance: String,
    pub local_percent: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_detail: Option<String>,
}

pub fn ckb_to_shannons_hex(ckb: u64) -> String {
    let shannons = (ckb as u128).saturating_mul(SHANNONS_PER_CKB);
    format!("0x{shannons:x}")
}

pub const CHANNEL_OPEN_MIN_FUNDING_CKB: u64 = 1000;

pub const CHANNEL_RESERVE_CKB: u64 = 99;

pub const CHANNEL_OPEN_FEE_BUFFER_CKB: u64 = 10;

pub fn required_wallet_ckb_for_open(funding_ckb: u64) -> u64 {
    funding_ckb
        .saturating_add(CHANNEL_RESERVE_CKB)
        .saturating_add(CHANNEL_OPEN_FEE_BUFFER_CKB)
}

pub fn shannons_hex_to_ckb(hex: &str) -> Option<u64> {
    parse_hex_u128(hex).map(|shannons| (shannons / SHANNONS_PER_CKB) as u64)
}

/// Effective minimum funding: studio floor (1000 CKB) or the node's protocol minimum, whichever is higher.
pub fn min_funding_ckb_for_open(node_min_funding_shannons_hex: &str) -> u64 {
    let node_min = shannons_hex_to_ckb(node_min_funding_shannons_hex).unwrap_or(0);
    CHANNEL_OPEN_MIN_FUNDING_CKB.max(node_min)
}

pub fn has_active_or_pending_channel_to_peer(channels: &[Channel], pubkey: &str) -> bool {
    channels.iter().any(|channel| {
        peer_connect::pubkeys_equal(&channel.pubkey, pubkey)
            && (rpc::is_channel_ready(&channel.state) || rpc::is_channel_pending(&channel.state))
    })
}

pub fn to_home_channel(channel: Channel) -> HomeChannel {
    let local = parse_hex_u128(&channel.local_balance).unwrap_or(0);
    let remote = parse_hex_u128(&channel.remote_balance).unwrap_or(0);
    let total = local.saturating_add(remote);
    let local_percent = if total == 0 {
        0
    } else {
        ((local * 100) / total).min(100) as u8
    };

    HomeChannel {
        channel_id: channel.channel_id,
        pubkey: channel.pubkey,
        is_public: channel.is_public,
        state: rpc::channel_state_label(&channel.state),
        local_balance: channel.local_balance,
        remote_balance: channel.remote_balance,
        local_percent,
        failure_detail: channel.failure_detail,
    }
}

pub fn sum_local_balances(channels: &[Channel]) -> u128 {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .filter_map(|channel| parse_hex_u128(&channel.local_balance))
        .sum()
}

pub fn sum_remote_balances(channels: &[Channel]) -> u128 {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .filter_map(|channel| parse_hex_u128(&channel.remote_balance))
        .sum()
}

pub fn sum_total_capacity(channels: &[Channel]) -> u128 {
    channels
        .iter()
        .filter(|channel| rpc::is_listable_channel(&channel.state))
        .filter_map(|channel| {
            let local = parse_hex_u128(&channel.local_balance)?;
            let remote = parse_hex_u128(&channel.remote_balance)?;
            Some(local.saturating_add(remote))
        })
        .sum()
}

pub fn count_active_channels(channels: &[Channel]) -> u32 {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .count() as u32
}

pub fn count_pending_channels(channels: &[Channel]) -> u32 {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_pending(&channel.state))
        .count() as u32
}

pub fn map_channels(channels: Vec<Channel>) -> Vec<HomeChannel> {
    let mut mapped: Vec<HomeChannel> = channels.into_iter().map(to_home_channel).collect();
    mapped.sort_by(|left, right| {
        let left_ready = left.state == "ChannelReady";
        let right_ready = right.state == "ChannelReady";
        right_ready
            .cmp(&left_ready)
            .then_with(|| left.pubkey.cmp(&right.pubkey))
    });
    mapped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ckb_to_shannons_hex_converts_499_ckb() {
        assert_eq!(ckb_to_shannons_hex(499), "0xb9e459300");
    }

    #[test]
    fn ckb_to_shannons_hex_converts_500_ckb() {
        assert_eq!(ckb_to_shannons_hex(500), "0xba43b7400");
    }

    #[test]
    fn ckb_to_shannons_hex_converts_1_ckb() {
        assert_eq!(ckb_to_shannons_hex(1), "0x5f5e100");
    }

    #[test]
    fn required_wallet_ckb_for_open_includes_reserve_and_fee_buffer() {
        assert_eq!(required_wallet_ckb_for_open(1000), 1109);
    }

    #[test]
    fn min_funding_ckb_for_open_uses_studio_floor_when_node_min_is_lower() {
        assert_eq!(min_funding_ckb_for_open("0x9502f9000"), 1000);
    }

    #[test]
    fn min_funding_ckb_for_open_uses_node_min_when_higher_than_studio_floor() {
        assert_eq!(min_funding_ckb_for_open("0xe8d4a51000"), 10000);
    }

    #[test]
    fn has_active_or_pending_channel_to_peer_detects_ready_and_opening() {
        let channels = vec![
            Channel {
                channel_id: "0x1".into(),
                is_public: true,
                pubkey: "02AA".into(),
                state: serde_json::json!("ChannelReady"),
                local_balance: "0x1".into(),
                remote_balance: "0x2".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: true,
                failure_detail: None,
            },
            Channel {
                channel_id: "0x2".into(),
                is_public: true,
                pubkey: "02BB".into(),
                state: serde_json::json!("Closed"),
                local_balance: "0x0".into(),
                remote_balance: "0x0".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: false,
                failure_detail: None,
            },
        ];

        assert!(has_active_or_pending_channel_to_peer(&channels, "02aa"));
        assert!(!has_active_or_pending_channel_to_peer(&channels, "02bb"));
    }

    #[test]
    fn count_pending_channels_counts_opening_states() {
        let channels = vec![
            Channel {
                channel_id: "0x1".into(),
                is_public: true,
                pubkey: "02aa".into(),
                state: serde_json::json!("ChannelReady"),
                local_balance: "0x1".into(),
                remote_balance: "0x2".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: true,
                failure_detail: None,
            },
            Channel {
                channel_id: "0x2".into(),
                is_public: true,
                pubkey: "02bb".into(),
                state: serde_json::json!("AwaitingTxSignatures"),
                local_balance: "0x3".into(),
                remote_balance: "0x0".into(),
                offered_tlc_balance: String::new(),
                received_tlc_balance: String::new(),
                enabled: false,
                failure_detail: None,
            },
        ];

        assert_eq!(count_pending_channels(&channels), 1);
    }
}
