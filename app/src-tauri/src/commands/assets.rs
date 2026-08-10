use serde::Serialize;
use tauri::{AppHandle, State};

use crate::fnn::assets::{self, AssetBalanceView, AssetChannelTotals, AssetView};
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::rpc::{self, CkbScript};
use crate::fnn::studio;
use crate::state::AppState;

use super::channels::fetch_wallet_balance_for_network;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetsPageResponse {
    pub available: bool,
    pub network: Option<String>,
    pub assets: Vec<AssetView>,
    pub on_chain_balances: Vec<AssetBalanceView>,
    pub channel_totals: Vec<AssetChannelTotals>,
    pub on_chain_wallet_error: Option<String>,
    pub lock_script: Option<CkbScript>,
}

fn assets_page_unavailable() -> AssetsPageResponse {
    AssetsPageResponse {
        available: false,
        network: None,
        assets: Vec::new(),
        on_chain_balances: Vec::new(),
        channel_totals: Vec::new(),
        on_chain_wallet_error: None,
        lock_script: None,
    }
}

#[tauri::command]
pub async fn get_assets_page(
    _app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AssetsPageResponse, String> {
    let manager = state.fnn.lock().await;

    if !matches!(manager.status(), NodeRuntimeStatus::Running { .. }) {
        return Ok(assets_page_unavailable());
    }

    let data_directory = manager.data_directory().cloned();
    drop(manager);

    let studio_metadata = data_directory
        .as_ref()
        .and_then(|path| studio::read_studio_metadata(path).ok());

    let node_info = rpc::fetch_node_info()
        .await
        .map_err(|error| error.to_string())?;
    let channels = rpc::fetch_list_channels()
        .await
        .map_err(|error| error.to_string())?;

    let catalog = assets::build_asset_catalog(&node_info);
    let channel_totals = assets::build_channel_totals(&catalog, &channels);

    let (on_chain_wallet_error, on_chain_balances, assets) = match studio_metadata
        .as_ref()
        .map(|metadata| metadata.network.as_str())
    {
        Some(network) => match fetch_wallet_balance_for_network(network).await {
            Ok(balance) => (None, balance.balances, balance.assets),
            Err(error) => (Some(error), Vec::new(), catalog.clone()),
        },
        None => (
            Some("Network is not configured.".to_string()),
            Vec::new(),
            catalog.clone(),
        ),
    };

    Ok(AssetsPageResponse {
        available: true,
        network: studio_metadata.as_ref().map(|metadata| metadata.network.clone()),
        assets,
        on_chain_balances,
        channel_totals,
        on_chain_wallet_error,
        lock_script: Some(node_info.default_funding_lock_script),
    })
}
