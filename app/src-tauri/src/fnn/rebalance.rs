use super::assets::{self, AssetView};
use super::channel::{self, SHANNONS_PER_CKB};
use super::outpoint;
use super::peer_connect;
use super::rpc::{self, Channel, CkbScript, HopRequire};

/// Leave at least 1 CKB on each side of a CKB channel so it stays usable.
pub const CKB_REBALANCE_RESERVE: u128 = SHANNONS_PER_CKB;

/// Leave at least one raw unit on each side of a UDT channel.
pub const UDT_REBALANCE_RESERVE: u128 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RebalanceStrategy {
    ExplicitRoute,
}

impl RebalanceStrategy {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ExplicitRoute => "explicit_route",
        }
    }
}

#[derive(Debug, Clone)]
pub struct RebalancePlan<'a> {
    pub source: &'a Channel,
    pub target: &'a Channel,
    pub amount: u128,
    pub asset: AssetView,
    pub max_amount: u128,
}

pub fn find_ready_channel<'a>(
    channels: &'a [Channel],
    channel_id: &str,
) -> Result<&'a Channel, String> {
    let trimmed = channel_id.trim();
    if trimmed.is_empty() {
        return Err("Channel ID is required.".to_string());
    }

    let channel = channels
        .iter()
        .find(|channel| channel.channel_id.eq_ignore_ascii_case(trimmed))
        .ok_or_else(|| "Channel not found. Refresh Channels and try again.".to_string())?;

    if !rpc::is_channel_ready(&channel.state) {
        return Err("Only ready channels can be rebalanced.".to_string());
    }

    Ok(channel)
}

pub fn plan_rebalance<'a>(
    channels: &'a [Channel],
    catalog: &[AssetView],
    source_channel_id: &str,
    target_channel_id: &str,
    amount_raw: u128,
) -> Result<RebalancePlan<'a>, String> {
    if source_channel_id.trim().eq_ignore_ascii_case(target_channel_id.trim()) {
        return Err("Pick two different channels to move liquidity between.".to_string());
    }

    let source = find_ready_channel(channels, source_channel_id)?;
    let target = find_ready_channel(channels, target_channel_id)?;

    if !channel::channel_matches_funding_asset(source, target.funding_udt_type_script.as_ref()) {
        return Err(
            "Both channels must use the same asset. CKB and UDT liquidity cannot be mixed."
                .to_string(),
        );
    }

    let same_asset_ready = count_ready_same_asset_channels(channels, source);
    if same_asset_ready < 2 {
        return Err(
            "Need at least two ready channels in this asset to rebalance through the network."
                .to_string(),
        );
    }

    let asset =
        assets::asset_for_channel_funding(catalog, source.funding_udt_type_script.as_ref());
    let is_ckb = asset.udt_type_script.is_none();

    let source_local = rpc::parse_hex_u128(&source.local_balance).unwrap_or(0);
    let target_remote = rpc::parse_hex_u128(&target.remote_balance).unwrap_or(0);
    let source_spendable = spendable_balance(source_local, is_ckb);
    let target_receivable = receivable_balance(target_remote, is_ckb);
    let max_amount = source_spendable.min(target_receivable);

    if max_amount == 0 {
        return Err(
            "Not enough spare liquidity. The source needs outbound capacity and the target needs inbound capacity, after leaving a small reserve."
                .to_string(),
        );
    }

    if amount_raw == 0 {
        return Err("Enter an amount greater than zero.".to_string());
    }

    if amount_raw > source_spendable {
        return Err(format!(
            "Amount is larger than this channel can send. You can move up to {} after leaving a reserve.",
            assets::format_amount_display(source_spendable, &asset),
        ));
    }

    if amount_raw > target_receivable {
        return Err(format!(
            "Amount is larger than the target channel can receive. You can move up to {} after leaving a reserve.",
            assets::format_amount_display(target_receivable, &asset),
        ));
    }

    Ok(RebalancePlan {
        source,
        target,
        amount: amount_raw,
        asset,
        max_amount,
    })
}

pub fn count_ready_same_asset_channels(channels: &[Channel], reference: &Channel) -> usize {
    channels
        .iter()
        .filter(|channel| rpc::is_channel_ready(&channel.state))
        .filter(|channel| {
            channel::channel_matches_funding_asset(
                channel,
                reference.funding_udt_type_script.as_ref(),
            )
        })
        .count()
}

pub fn channel_reserve(balance: u128, is_ckb: bool) -> u128 {
    if is_ckb {
        if balance > CKB_REBALANCE_RESERVE.saturating_mul(2) {
            CKB_REBALANCE_RESERVE
        } else if balance > 0 {
            1
        } else {
            0
        }
    } else if balance > UDT_REBALANCE_RESERVE {
        UDT_REBALANCE_RESERVE
    } else {
        0
    }
}

pub fn spendable_balance(local: u128, is_ckb: bool) -> u128 {
    local.saturating_sub(channel_reserve(local, is_ckb))
}

pub fn receivable_balance(remote: u128, is_ckb: bool) -> u128 {
    remote.saturating_sub(channel_reserve(remote, is_ckb))
}

/// Hop list for `build_router` (source node omitted).
///
/// Same peer, two channels: peer → this node (via the inbound channel).
/// Different peers: source peer → target peer → this node (via the inbound channel).
pub fn circular_hops_info(
    source: &Channel,
    target: &Channel,
    own_pubkey: &str,
) -> Vec<HopRequire> {
    let source_outpoint = hop_outpoint(source.channel_outpoint.as_deref());
    let target_outpoint = hop_outpoint(target.channel_outpoint.as_deref());

    let mut hops = vec![HopRequire {
        pubkey: source.pubkey.clone(),
        channel_outpoint: source_outpoint,
    }];

    if !peer_connect::pubkeys_equal(&source.pubkey, &target.pubkey) {
        hops.push(HopRequire {
            pubkey: target.pubkey.clone(),
            channel_outpoint: None,
        });
    }

    hops.push(HopRequire {
        pubkey: own_pubkey.to_string(),
        channel_outpoint: target_outpoint,
    });

    hops
}

/// Fiber JSON-RPC expects a packed hex outpoint string, not `{ tx_hash, index }`.
fn hop_outpoint(value: Option<&str>) -> Option<String> {
    let trimmed = value.map(str::trim).filter(|value| !value.is_empty())?;
    if outpoint::parse_outpoint(trimmed).is_some() {
        return Some(trimmed.to_string());
    }
    if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        return Some(trimmed.to_string());
    }
    None
}

pub fn fee_exceeds_max(fee_raw: u128, max_fee: Option<u128>) -> bool {
    max_fee.is_some_and(|max| fee_raw > max)
}

pub fn udt_script(asset: &AssetView) -> Option<&CkbScript> {
    asset.udt_type_script.as_ref()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fnn::channel::ckb_to_shannons_hex;

    fn packed_outpoint(index: u32) -> String {
        let tx = "aa".repeat(32);
        let bytes = index.to_le_bytes();
        format!(
            "0x{tx}{:02x}{:02x}{:02x}{:02x}",
            bytes[0], bytes[1], bytes[2], bytes[3]
        )
    }

    fn ready_channel(
        channel_id: &str,
        pubkey: &str,
        local_ckb: u64,
        remote_ckb: u64,
        outpoint: Option<&str>,
    ) -> Channel {
        Channel {
            channel_id: channel_id.into(),
            is_public: true,
            pubkey: pubkey.into(),
            state: serde_json::json!("ChannelReady"),
            local_balance: ckb_to_shannons_hex(local_ckb),
            remote_balance: ckb_to_shannons_hex(remote_ckb),
            offered_tlc_balance: String::new(),
            received_tlc_balance: String::new(),
            enabled: true,
            channel_outpoint: outpoint.map(str::to_string),
            latest_commitment_transaction_hash: None,
            failure_detail: None,
            funding_udt_type_script: None,
        }
    }

    fn udt_script_fixture() -> CkbScript {
        CkbScript {
            code_hash: "0xaaa".into(),
            hash_type: "type".into(),
            args: "0xbbb".into(),
        }
    }

    #[test]
    fn reserve_leaves_one_ckb_when_channel_is_large() {
        assert_eq!(channel_reserve(500 * SHANNONS_PER_CKB, true), SHANNONS_PER_CKB);
        assert_eq!(spendable_balance(500 * SHANNONS_PER_CKB, true), 499 * SHANNONS_PER_CKB);
    }

    #[test]
    fn plan_rejects_same_channel() {
        let channels = vec![
            ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1))),
            ready_channel("0x2", "02bb", 100, 400, Some(&packed_outpoint(2))),
        ];
        let err = plan_rebalance(&channels, &[], "0x1", "0x1", SHANNONS_PER_CKB).unwrap_err();
        assert!(err.contains("two different channels"));
    }

    #[test]
    fn plan_rejects_pending_channel() {
        let mut pending = ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1)));
        pending.state = serde_json::json!("NegotiatingFunding");
        let channels = vec![
            pending,
            ready_channel("0x2", "02bb", 100, 400, Some(&packed_outpoint(2))),
        ];
        let err = plan_rebalance(&channels, &[], "0x1", "0x2", SHANNONS_PER_CKB).unwrap_err();
        assert!(err.contains("ready"));
    }

    #[test]
    fn plan_rejects_mixed_assets() {
        let mut udt_channel = ready_channel("0x2", "02bb", 100, 400, Some(&packed_outpoint(2)));
        udt_channel.funding_udt_type_script = Some(udt_script_fixture());
        let channels = vec![
            ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1))),
            udt_channel,
        ];
        let err = plan_rebalance(&channels, &[], "0x1", "0x2", SHANNONS_PER_CKB).unwrap_err();
        assert!(err.contains("same asset"));
    }

    #[test]
    fn plan_rejects_amount_above_source_spendable() {
        let channels = vec![
            ready_channel("0x1", "02aa", 50, 450, Some(&packed_outpoint(1))),
            ready_channel("0x2", "02bb", 50, 450, Some(&packed_outpoint(2))),
        ];
        let err = plan_rebalance(&channels, &[], "0x1", "0x2", 50 * SHANNONS_PER_CKB).unwrap_err();
        assert!(err.contains("can send"));
    }

    #[test]
    fn plan_accepts_amount_within_both_sides() {
        let channels = vec![
            ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1))),
            ready_channel("0x2", "02bb", 100, 400, Some(&packed_outpoint(2))),
        ];
        let plan = plan_rebalance(&channels, &[], "0x1", "0x2", 50 * SHANNONS_PER_CKB).unwrap();
        assert_eq!(plan.amount, 50 * SHANNONS_PER_CKB);
        assert_eq!(plan.max_amount, 399 * SHANNONS_PER_CKB);
        assert_eq!(plan.asset.symbol, "CKB");
    }

    #[test]
    fn hops_for_different_peers_are_source_target_self() {
        let source = ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1)));
        let target = ready_channel("0x2", "02bb", 100, 400, Some(&packed_outpoint(2)));
        let hops = circular_hops_info(&source, &target, "02cc");
        assert_eq!(hops.len(), 3);
        assert_eq!(hops[0].pubkey, "02aa");
        assert_eq!(
            hops[0].channel_outpoint.as_deref(),
            Some(packed_outpoint(1).as_str())
        );
        assert_eq!(hops[1].pubkey, "02bb");
        assert_eq!(hops[1].channel_outpoint, None);
        assert_eq!(hops[2].pubkey, "02cc");
        assert_eq!(
            hops[2].channel_outpoint.as_deref(),
            Some(packed_outpoint(2).as_str())
        );
    }

    #[test]
    fn fee_exceeds_max_compares_optional_cap() {
        assert!(!fee_exceeds_max(10, None));
        assert!(!fee_exceeds_max(10, Some(10)));
        assert!(fee_exceeds_max(11, Some(10)));
    }

    #[test]
    fn hops_for_same_peer_skip_the_middle_hop() {
        let source = ready_channel("0x1", "02aa", 400, 100, Some(&packed_outpoint(1)));
        let target = ready_channel("0x2", "02aa", 100, 400, Some(&packed_outpoint(2)));
        let hops = circular_hops_info(&source, &target, "02cc");
        assert_eq!(hops.len(), 2);
        assert_eq!(hops[0].pubkey, "02aa");
        assert_eq!(hops[1].pubkey, "02cc");
        assert_eq!(
            hops[1].channel_outpoint.as_deref(),
            Some(packed_outpoint(2).as_str())
        );
    }
}
