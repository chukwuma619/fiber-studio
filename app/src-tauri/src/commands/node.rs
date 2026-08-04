use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::commands::setup::start_fnn;
use crate::fnn::keychain;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartNodePayload {
    pub data_directory: String,
    #[serde(default)]
    pub allow_migration: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStatusResponse {
    pub status: crate::fnn::manager::NodeRuntimeStatus,
    pub data_directory: Option<String>,
    pub recent_logs: Vec<String>,
}

#[tauri::command]
pub async fn get_node_status(
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
    data_directory: Option<String>,
) -> Result<NodeStatusResponse, String> {
    let mut manager = state.fnn.lock().await;
    let data_dir = data_directory
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from);
    manager.sync_health(data_dir).await;

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
        payload.allow_migration,
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
pub async fn get_node_logs(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    let manager = state.fnn.lock().await;
    let limit = limit
        .unwrap_or(crate::fnn::manager::MAX_LOG_LINES)
        .min(crate::fnn::manager::MAX_LOG_LINES);
    Ok(manager.recent_logs(limit))
}

/// Opens a save dialog and writes the current node log session to disk.
/// Returns the saved path, or `None` if the user cancelled.
#[tauri::command]
pub async fn export_node_logs(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let content = {
        let manager = state.fnn.lock().await;
        manager
            .export_log_text()
            .ok_or_else(|| "No logs available to export.".to_string())?
    };

    let default_name = format!(
        "fiber-studio-fnn-{}.log",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );

    let dialog_app = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_file_name(&default_name)
            .add_filter("Log files", &["log", "txt"])
            .blocking_save_file()
    })
    .await
    .map_err(|error| format!("Failed to open save dialog: {error}"))?;

    let Some(file_path) = picked else {
        return Ok(None);
    };

    let path = file_path
        .into_path()
        .map_err(|error| format!("Invalid save path: {error}"))?;

    std::fs::write(&path, format!("{content}\n"))
        .map_err(|error| format!("Failed to write log file: {error}"))?;

    Ok(Some(path.display().to_string()))
}

#[tauri::command]
pub async fn stop_node(state: State<'_, AppState>) -> Result<NodeStatusResponse, String> {
    let mut manager = state.fnn.lock().await;
    manager.stop().await.map_err(|error| error.to_string())?;

    Ok(NodeStatusResponse {
        status: manager.status(),
        data_directory: manager
            .data_directory()
            .map(|path| path.display().to_string()),
        recent_logs: manager.recent_logs(20),
    })
}
