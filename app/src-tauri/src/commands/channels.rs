use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::assets::{self, AssetView};
use crate::fnn::channel::{
    self, count_active_channels, count_pending_channels, has_active_or_pending_channel_to_peer,
    min_funding_ckb_for_open, required_wallet_ckb_for_open, sum_local_balances, sum_remote_balances,
    sum_total_capacity, HomeChannel,
};
use crate::fnn::features;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::peer_connect;
use crate::fnn::relays;
use crate::fnn::rpc::{self, CkbScript};
use crate::fnn::studio;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelsSavedPeerEntry {
    pub pubkey: String,
    pub multiaddr: Option<String>,
    pub connected: bool,
    pub channel_count: u32,
    pub has_active_or_pending_channel: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelsPageResponse {
    pub available: bool,
    pub channels: Vec<HomeChannel>,
    pub active_channel_count: u32,
    pub pending_channel_count: u32,
    pub total_capacity: String,
    pub total_local_balance: String,
    pub total_remote_balance: String,
    pub on_chain_wallet_ckb: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_chain_wallet_error: Option<String>,
    pub network: Option<String>,
    pub default_funding_lock_script: Option<CkbScript>,
    pub saved_peers: Vec<ChannelsSavedPeerEntry>,
    pub relay_status: String,
    pub min_funding_ckb: u64,
    pub assets: Vec<AssetView>,
    pub on_chain_balances: Vec<assets::AssetBalanceView>,
    pub channel_totals: Vec<assets::AssetChannelTotals>,
    pub legacy_channel_count: u32,
    pub show_legacy_channel_nudge: bool,
    pub supports_channel_v2: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelPayload {
    pub pubkey: String,
    pub funding_amount: f64,
    #[serde(default)]
    pub udt_type_script: Option<CkbScript>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelResult {
    pub channel_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShutdownChannelPayload {
    pub channel_id: String,
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbandonChannelPayload {
    pub channel_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletBalanceResponse {
    pub available_ckb: u64,
    pub shannons: String,
    pub assets: Vec<AssetView>,
    pub balances: Vec<assets::AssetBalanceView>,
}

pub(crate) async fn fetch_wallet_balance_for_network(
    network: &str,
) -> Result<WalletBalanceResponse, String> {
    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let catalog = assets::build_asset_catalog(&node_info);
    let snapshot = assets::fetch_wallet_on_chain_snapshot(
        network,
        &node_info.default_funding_lock_script,
        &catalog,
    )
    .await
    .map_err(|error| format!("Failed to read on-chain wallet balance: {error}"))?;
    let assets = catalog;
    let balances = snapshot.balances;

    let shannons = balances
        .iter()
        .find(|balance| balance.asset_id == assets::CKB_ASSET_ID)
        .and_then(|balance| rpc::parse_hex_u128(&balance.raw_amount))
        .unwrap_or(0);
    let available_ckb = (shannons / channel::SHANNONS_PER_CKB as u128) as u64;

    Ok(WalletBalanceResponse {
        available_ckb,
        shannons: format!("0x{shannons:x}"),
        assets,
        balances,
    })
}

#[tauri::command]
pub async fn get_wallet_balance(
    state: State<'_, AppState>,
) -> Result<WalletBalanceResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before checking wallet balance.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    fetch_wallet_balance_for_network(&studio_metadata.network).await
}

fn channels_page_unavailable() -> ChannelsPageResponse {
    ChannelsPageResponse {
        available: false,
        channels: Vec::new(),
        active_channel_count: 0,
        pending_channel_count: 0,
        total_capacity: "0".to_string(),
        total_local_balance: "0".to_string(),
        total_remote_balance: "0".to_string(),
        on_chain_wallet_ckb: None,
        on_chain_wallet_error: None,
        network: None,
        default_funding_lock_script: None,
        saved_peers: Vec::new(),
        relay_status: "not_configured".to_string(),
        min_funding_ckb: channel::CHANNEL_OPEN_MIN_FUNDING_CKB,
        assets: Vec::new(),
        on_chain_balances: Vec::new(),
        channel_totals: Vec::new(),
        legacy_channel_count: 0,
        show_legacy_channel_nudge: false,
        supports_channel_v2: false,
    }
}

fn map_open_channel_error(error: String) -> String {
    let lower = error.to_ascii_lowercase();
    // Fiber: "Peer …'s feature not found, waiting for peer to send Init message"
    if lower.contains("waiting for peer to send init")
        || (lower.contains("feature not found") && lower.contains("init"))
    {
        return "Peer is connected but has not finished the Fiber handshake yet. Wait a moment and try opening the channel again.".into();
    }
    // Fiber: "Cannot open channel with peer …: CHANNEL_V2 is required"
    // Fiber: "Cannot accept Legacy channel: CHANNEL_V2 is required"
    // Fiber: "Peer … features … are not compatible with our features …"
    if lower.contains("channel_v2")
        || lower.contains("channel v2")
        || lower.contains("cannot accept legacy")
        || lower.contains("not compatible with our features")
        || (lower.contains("feature") && lower.contains("channel"))
        || lower.contains("does not support")
        || (lower.contains("legacy") && lower.contains("open"))
    {
        return "This peer is on an older Fiber version. Fiber 0.10+ can only open new channels with peers that support Channel V2. Ask them to upgrade, or open with another peer.".into();
    }
    error
}

fn peer_is_connected(peers: &[rpc::PeerInfo], pubkey: &str) -> bool {
    peers
        .iter()
        .any(|peer| peer_connect::pubkeys_equal(&peer.pubkey, pubkey))
}

fn count_channels_to_peer(channels: &[rpc::Channel], pubkey: &str) -> u32 {
    channels
        .iter()
        .filter(|channel| peer_connect::pubkeys_equal(&channel.pubkey, pubkey))
        .count() as u32
}

fn build_channels_saved_peer_entry(
    saved_peer: &studio::SavedPeer,
    peers: &[rpc::PeerInfo],
    channels: &[rpc::Channel],
) -> ChannelsSavedPeerEntry {
    let connected = peer_is_connected(peers, &saved_peer.pubkey);
    let channel_count = count_channels_to_peer(channels, &saved_peer.pubkey);
    let has_active_or_pending_channel =
        has_active_or_pending_channel_to_peer(channels, &saved_peer.pubkey);
    let multiaddr = saved_peer.multiaddr.trim();
    ChannelsSavedPeerEntry {
        pubkey: saved_peer.pubkey.clone(),
        multiaddr: if multiaddr.is_empty() {
            None
        } else {
            Some(multiaddr.to_string())
        },
        connected,
        channel_count,
        has_active_or_pending_channel,
    }
}

#[tauri::command]
pub async fn get_channels_page(
    state: State<'_, AppState>,
) -> Result<ChannelsPageResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(channels_page_unavailable());
    }

    let data_directory = manager.data_directory().cloned();
    let manager_relay_status = manager.relay_state().status;
    drop(manager);

    let mut studio_metadata = data_directory
        .as_ref()
        .and_then(|path| studio::read_studio_metadata(path).ok());

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let channels = rpc::fetch_list_channels()
        .await
        .map_err(|error| error.to_string())?;
    let peers = rpc::fetch_list_peers()
        .await
        .map_err(|error| error.to_string())?;

    if let (Some(path), Some(metadata)) = (data_directory.as_ref(), studio_metadata.as_mut()) {
        let open_ids: Vec<String> = channels
            .iter()
            .filter(|channel| {
                rpc::is_channel_ready(&channel.state) || rpc::is_channel_pending(&channel.state)
            })
            .map(|channel| channel.channel_id.clone())
            .collect();
        if metadata.sync_channel_v2_upgrade(&open_ids) {
            let _ = studio::write_studio_metadata(path, metadata);
        }
    }

    let catalog = assets::build_asset_catalog(&node_info);
    let channel_totals = assets::build_channel_totals(&catalog, &channels);
    let supports_channel_v2 = features::supports_channel_v2(&node_info.features);

    let active_channel_count = count_active_channels(&channels);
    let pending_channel_count = count_pending_channels(&channels);
    let total_capacity = sum_total_capacity(&channels);
    let total_local_balance = sum_local_balances(&channels);
    let total_remote_balance = sum_remote_balances(&channels);
    let min_funding_ckb =
        min_funding_ckb_for_open(&node_info.open_channel_auto_accept_min_ckb_funding_amount);

    let legacy_channel_count = studio_metadata
        .as_ref()
        .map(|metadata| {
            channels
                .iter()
                .filter(|channel| {
                    (rpc::is_channel_ready(&channel.state) || rpc::is_channel_pending(&channel.state))
                        && metadata.channel_is_legacy(&channel.channel_id, channel.created_at)
                })
                .count() as u32
        })
        .unwrap_or(0);
    let show_legacy_channel_nudge = legacy_channel_count > 0
        && studio_metadata
            .as_ref()
            .is_some_and(|metadata| !metadata.legacy_channel_nudge_dismissed);

    let saved_peers = studio_metadata
        .as_ref()
        .map(|metadata| metadata.saved_peers.as_slice())
        .unwrap_or(&[]);

    let network_str = studio_metadata
        .as_ref()
        .map(|metadata| metadata.network.as_str());

    let relay_status = peer_connect::relay_status_for_peers(
        network_str,
        &peers,
        saved_peers,
        &manager_relay_status,
    );

    let mut saved_peer_entries: Vec<ChannelsSavedPeerEntry> = Vec::new();
    if let Some(network) = network_str {
        for relay in relays::relays_for_network(network) {
            if relay.pubkey.trim().is_empty() {
                continue;
            }
            let saved_multiaddr = saved_peers
                .iter()
                .find(|saved| peer_connect::pubkeys_equal(&saved.pubkey, &relay.pubkey))
                .map(|saved| saved.multiaddr.trim().to_string())
                .unwrap_or_default();
            let multiaddr = relay
                .multiaddr
                .as_deref()
                .map(str::trim)
                .filter(|addr| !addr.is_empty())
                .map(str::to_string)
                .unwrap_or(saved_multiaddr);
            let relay_as_saved = studio::SavedPeer {
                pubkey: relay.pubkey,
                multiaddr,
            };
            saved_peer_entries.push(build_channels_saved_peer_entry(
                &relay_as_saved,
                &peers,
                &channels,
            ));
        }
    }
    for peer in saved_peers {
        if saved_peer_entries
            .iter()
            .any(|entry| peer_connect::pubkeys_equal(&entry.pubkey, &peer.pubkey))
        {
            continue;
        }
        saved_peer_entries.push(build_channels_saved_peer_entry(peer, &peers, &channels));
    }

    let (on_chain_wallet_ckb, on_chain_wallet_error, on_chain_balances, assets) =
        match studio_metadata.as_ref().map(|metadata| metadata.network.as_str()) {
            Some(network) => match fetch_wallet_balance_for_network(network).await {
                Ok(balance) => (
                    Some(balance.available_ckb),
                    None,
                    balance.balances,
                    balance.assets,
                ),
                Err(error) => (None, Some(error), Vec::new(), catalog.clone()),
            },
            None => (
                None,
                Some("Network is not configured.".to_string()),
                Vec::new(),
                catalog.clone(),
            ),
        };

    Ok(ChannelsPageResponse {
        available: true,
        channels: channel::map_channels(
            channels,
            &catalog,
            |channel| {
                studio_metadata.as_ref().is_some_and(|metadata| {
                    metadata.channel_is_legacy(&channel.channel_id, channel.created_at)
                })
            },
            studio_metadata
                .as_ref()
                .is_some_and(|metadata| metadata.channel_protocol_known()),
        ),
        active_channel_count,
        pending_channel_count,
        total_capacity: total_capacity.to_string(),
        total_local_balance: total_local_balance.to_string(),
        total_remote_balance: total_remote_balance.to_string(),
        on_chain_wallet_ckb,
        on_chain_wallet_error,
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        default_funding_lock_script: Some(node_info.default_funding_lock_script),
        saved_peers: saved_peer_entries,
        relay_status,
        min_funding_ckb,
        assets,
        on_chain_balances,
        channel_totals,
        legacy_channel_count,
        show_legacy_channel_nudge,
        supports_channel_v2,
    })
}

#[tauri::command]
pub async fn open_channel(
    state: State<'_, AppState>,
    payload: OpenChannelPayload,
) -> Result<OpenChannelResult, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before opening a channel.".to_string());
    }

    let data_directory = manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".to_string())?;
    drop(manager);

    let studio_metadata = studio::read_studio_metadata(&data_directory)
        .map_err(|error| format!("Failed to read studio metadata: {error}"))?;

    let pubkey = payload.pubkey.trim();
    if pubkey.is_empty() {
        return Err("Peer pubkey is required.".to_string());
    }

    let is_official_relay = relays::is_official_relay_pubkey(&studio_metadata.network, pubkey);
    if !studio_metadata.has_saved_peer(pubkey) && !is_official_relay {
        return Err("Channel opens are limited to official relays and saved peers.".to_string());
    }

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let catalog = assets::build_asset_catalog(&node_info);
    let min_funding_ckb =
        min_funding_ckb_for_open(&node_info.open_channel_auto_accept_min_ckb_funding_amount);

    let asset = if let Some(script) = payload.udt_type_script.as_ref() {
        assets::find_asset_for_udt_script(&catalog, script)
            .cloned()
            .ok_or_else(|| {
                "Selected UDT is not in this node's whitelist. Add it to config.yml and restart the node.".to_string()
            })?
    } else {
        assets::ckb_asset()
    };

    let funding_raw = if asset.udt_type_script.is_some() {
        assets::parse_human_amount(payload.funding_amount, asset.decimals)?
    } else {
        let funding_ckb = payload.funding_amount.round() as u64;
        if funding_ckb < min_funding_ckb {
            return Err(format!(
                "Channel capacity must be at least {min_funding_ckb} CKB.",
            ));
        }
        funding_ckb as u128 * channel::SHANNONS_PER_CKB
    };

    if asset.udt_type_script.is_some() && funding_raw == 0 {
        return Err("Funding amount must be greater than zero.".to_string());
    }

    let saved_multiaddr = studio_metadata
        .find_saved_peer(pubkey)
        .map(|peer| peer.multiaddr.trim())
        .filter(|addr| !addr.is_empty())
        .map(str::to_string)
        .or_else(|| {
            relays::find_relay_by_pubkey(&studio_metadata.network, pubkey)
                .and_then(|relay| relay.multiaddr)
        })
        .unwrap_or_default();

    let connect_status = peer_connect::ensure_peer_connected(pubkey, &saved_multiaddr)
        .await
        .map_err(|error| error.to_string())?;

    if connect_status == peer_connect::RelayConnectStatus::Failed {
        return Err(
            "Could not connect to peer. The relay is not in your peer list — try restarting the node, switching to another public relay in setup, or check your network.".to_string(),
        );
    }

    let wallet_balance = fetch_wallet_balance_for_network(&studio_metadata.network).await?;

    if asset.udt_type_script.is_some() {
        let udt_balance = wallet_balance
            .balances
            .iter()
            .find(|balance| balance.asset_id == asset.id)
            .and_then(|balance| rpc::parse_hex_u128(&balance.raw_amount))
            .unwrap_or(0);
        if udt_balance < funding_raw {
            return Err(format!(
                "Insufficient on-chain {symbol}. Need {need} but wallet has {have}.",
                symbol = asset.symbol,
                need = assets::format_amount_display(funding_raw, &asset),
                have = assets::format_amount_display(udt_balance, &asset),
            ));
        }
    } else {
        let funding_ckb = (funding_raw / channel::SHANNONS_PER_CKB) as u64;
        let required_ckb = required_wallet_ckb_for_open(funding_ckb);
        if wallet_balance.available_ckb < required_ckb {
            return Err(format!(
                "Insufficient on-chain CKB. Need at least {required_ckb} CKB ({} funding + {} reserve + {} fee buffer) but wallet has {} CKB.",
                funding_ckb,
                channel::CHANNEL_RESERVE_CKB,
                channel::CHANNEL_OPEN_FEE_BUFFER_CKB,
                wallet_balance.available_ckb,
            ));
        }
    }

    if wallet_balance.available_ckb < channel::CHANNEL_RESERVE_CKB + channel::CHANNEL_OPEN_FEE_BUFFER_CKB {
        return Err(format!(
            "Insufficient on-chain CKB for channel reserve and fees. Need at least {} CKB but wallet has {} CKB.",
            channel::CHANNEL_RESERVE_CKB + channel::CHANNEL_OPEN_FEE_BUFFER_CKB,
            wallet_balance.available_ckb,
        ));
    }

    if !features::supports_channel_v2(&node_info.features) {
        return Err(
            "This node does not advertise Channel V2. Upgrade fnn to 0.10+ before opening new channels."
                .into(),
        );
    }

    let mut warnings = Vec::new();
    // Fiber itself decides from the peer's Init features after connect; the graph is a
    // preflight hint only (list_peers does not expose session features).
    match rpc::find_graph_node(pubkey).await {
        Ok(Some(peer_node)) => {
            if !features::graph_node_supports_channel_v2(
                &peer_node.features,
                peer_node.version.as_deref(),
            ) {
                return Err(
                    "This peer is on an older Fiber version. Fiber 0.10+ can only open new channels with peers that support Channel V2. Ask them to upgrade, or open with another peer."
                        .into(),
                );
            }
        }
        Ok(None) => {
            warnings.push(
                "Could not verify Channel V2 support for this peer (not found in the network graph yet). Private or newly announced peers may still work; Fiber will reject the open if the peer lacks Channel V2."
                    .into(),
            );
        }
        Err(error) => {
            warnings.push(format!(
                "Could not check the network graph for peer Channel V2 support ({error}). Proceeding; Fiber will reject the open if the peer lacks Channel V2."
            ));
        }
    }

    let funding_amount = format!("0x{funding_raw:x}");
    let udt_script = asset.udt_type_script.as_ref();
    let channel_id = rpc::open_channel(pubkey, &funding_amount, true, udt_script)
        .await
        .map_err(|error| map_open_channel_error(error.to_string()))?;

    Ok(OpenChannelResult {
        channel_id,
        warnings,
    })
}

#[tauri::command]
pub async fn shutdown_channel(
    state: State<'_, AppState>,
    payload: ShutdownChannelPayload,
) -> Result<(), String> {
    let channel_id = payload.channel_id.trim();
    if channel_id.is_empty() {
        return Err("Channel ID is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before closing a channel.".to_string());
    }
    drop(manager);

    let close_script = if payload.force {
        None
    } else {
        let node_info = rpc::fetch_node_info()
            .await
            .map_err(|error| error.to_string())?;
        Some(node_info.default_funding_lock_script)
    };

    rpc::shutdown_channel(channel_id, close_script.as_ref(), payload.force)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn abandon_channel(
    state: State<'_, AppState>,
    payload: AbandonChannelPayload,
) -> Result<(), String> {
    let channel_id = payload.channel_id.trim();
    if channel_id.is_empty() {
        return Err("Channel ID is required.".to_string());
    }

    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Err("Node is not running. Start your node before abandoning a channel.".to_string());
    }
    drop(manager);

    rpc::abandon_channel(channel_id)
        .await
        .map_err(|error| error.to_string())
}
