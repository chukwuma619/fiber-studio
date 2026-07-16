use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::fnn::keychain;
use crate::fnn::manager::ManagerError;
use crate::fnn::migration;
use crate::fnn::provision::{self, ProvisionRequest};
use crate::fnn::rpc::NodeInfo;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSetupPayload {
    pub network: String,
    pub data_directory: String,
    pub key_file_mode: String,
    pub key_file_path: String,
    pub imported_private_key: Option<String>,
    pub password: String,
    pub custom_public_node_pubkey: String,
    pub custom_public_node_multiaddr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSetupResult {
    pub status: String,
    pub version: String,
    pub pubkey: String,
}

#[tauri::command]
pub async fn complete_setup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    payload: CompleteSetupPayload,
) -> Result<CompleteSetupResult, String> {
    if payload.password.trim().is_empty() {
        return Err("Wallet password is required.".into());
    }

    let provision_request = ProvisionRequest {
        network: payload.network,
        data_directory: payload.data_directory.clone(),
        key_file_mode: payload.key_file_mode,
        key_file_path: payload.key_file_path,
        imported_private_key: payload.imported_private_key,
        custom_public_node_pubkey: payload.custom_public_node_pubkey,
        custom_public_node_multiaddr: payload.custom_public_node_multiaddr,
    };

    provision::provision_data_directory(&provision_request)
        .map_err(|error| format!("Failed to prepare data directory: {error}"))?;

    keychain::set_wallet_password(&payload.password)
        .map_err(|error| format!("Failed to store password in keychain: {error}"))?;

    let node_info = start_fnn(
        &app,
        &state,
        PathBuf::from(payload.data_directory),
        &payload.password,
        false,
    )
    .await?;

    Ok(CompleteSetupResult {
        status: "ready".into(),
        version: node_info.version,
        pubkey: node_info.pubkey,
    })
}

pub async fn start_fnn(
    app: &tauri::AppHandle,
    state: &State<'_, AppState>,
    data_directory: PathBuf,
    password: &str,
    allow_migration: bool,
) -> Result<NodeInfo, String> {
    let mut manager = state.fnn.lock().await;

    match manager
        .start(app, data_directory, password, allow_migration)
        .await
    {
        Ok(info) => Ok(info),
        Err(ManagerError::MigrationRequired {
            message,
            has_breaking_change,
        }) => {
            manager.stop().await.ok();
            Err(migration::format_migration_required_error(
                &migration::MigrationDetails {
                    message,
                    has_breaking_change,
                    cancelled: true,
                },
            ))
        }
        Err(ManagerError::Rpc(error)) => {
            let logs = manager.recent_logs(20).join("\n");
            manager.set_error(error.to_string());
            manager.stop().await.ok();
            Err(format!(
                "fnn did not become ready: {error}\n\nRecent logs:\n{logs}"
            ))
        }
        Err(error) => {
            manager.set_error(error.to_string());
            manager.stop().await.ok();
            Err(error.to_string())
        }
    }
}
