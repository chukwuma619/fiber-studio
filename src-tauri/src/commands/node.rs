use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::setup::start_fnn;
use crate::fnn::keychain;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartNodePayload {
    pub data_directory: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStatusResponse {
    pub status: crate::fnn::manager::NodeRuntimeStatus,
    pub data_directory: Option<String>,
    pub recent_logs: Vec<String>,
}

#[tauri::command]
pub async fn get_node_status(state: State<'_, AppState>) -> Result<NodeStatusResponse, String> {
    let mut manager = state.fnn.lock().await;
    manager.sync_health().await;

    Ok(NodeStatusResponse {
        status: manager.status(),
        data_directory: manager
            .data_directory()
            .map(|path| path.display().to_string()),
        recent_logs: manager.recent_logs(20),
    })
}

#[tauri::command]
pub async fn start_node(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    payload: StartNodePayload,
) -> Result<NodeStatusResponse, String> {
    if payload.data_directory.trim().is_empty() {
        return Err("Data directory is required to start fnn.".into());
    }

    let password = keychain::get_wallet_password()
        .map_err(|error| format!("Failed to read password from keychain: {error}"))?;

    let node_info = start_fnn(
        &app,
        &state,
        PathBuf::from(&payload.data_directory),
        &password,
    )
    .await?;

    let manager = state.fnn.lock().await;
    Ok(NodeStatusResponse {
        status: crate::fnn::manager::NodeRuntimeStatus::Running {
            version: node_info.version,
            pubkey: node_info.pubkey,
        },
        data_directory: manager
            .data_directory()
            .map(|path| path.display().to_string()),
        recent_logs: manager.recent_logs(20),
    })
}

#[tauri::command]
pub async fn stop_node(state: State<'_, AppState>) -> Result<NodeStatusResponse, String> {
    let mut manager = state.fnn.lock().await;
    manager
        .stop()
        .map_err(|error| error.to_string())?;

    Ok(NodeStatusResponse {
        status: manager.status(),
        data_directory: manager
            .data_directory()
            .map(|path| path.display().to_string()),
        recent_logs: manager.recent_logs(20),
    })
}
