use serde::Serialize;

use super::rpc::{self, parse_hex_u128, Channel};

const SHANNONS_PER_CKB: u128 = 100_000_000;

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
}

pub fn ckb_to_shannons_hex(ckb: u64) -> String {
    let shannons = (ckb as u128).saturating_mul(SHANNONS_PER_CKB);
    format!("0x{shannons:x}")
}

pub fn shannons_hex_to_ckb(shannons_hex: &str) -> Option<u64> {
    let shannons = rpc::parse_hex_u128(shannons_hex)?;
    let ckb = shannons / SHANNONS_PER_CKB;
    if ckb > u64::MAX as u128 {
        return None;
    }
    Some(ckb as u64)
}

pub const RECOMMENDED_CHANNEL_FUNDING_CKB: u64 = 500;

pub fn recommended_funding_ckb(peer_min_ckb: Option<u64>) -> u64 {
    match peer_min_ckb {
        Some(min) => min.max(RECOMMENDED_CHANNEL_FUNDING_CKB),
        None => RECOMMENDED_CHANNEL_FUNDING_CKB,
    }
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
    }
}

pub fn sum_local_balances(channels: &[Channel]) -> u128 {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .filter_map(|channel| parse_hex_u128(&channel.local_balance))
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
    fn shannons_hex_to_ckb_converts_400_ckb() {
        assert_eq!(shannons_hex_to_ckb("0x9502f9000"), Some(400));
    }

    #[test]
    fn recommended_funding_ckb_uses_peer_minimum_when_higher() {
        assert_eq!(recommended_funding_ckb(Some(400)), 500);
        assert_eq!(recommended_funding_ckb(Some(600)), 600);
        assert_eq!(recommended_funding_ckb(None), 500);
    }
}
