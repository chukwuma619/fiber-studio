use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::fnn::ckb_address;
use crate::fnn::config_read;
use crate::fnn::data_directory;
use crate::fnn::keychain;
use crate::fnn::manager::NodeRuntimeStatus;
use crate::fnn::provision::{self, ProvisionRequest};
use crate::fnn::relays;
use crate::fnn::rpc;
use crate::fnn::studio::{self, SavedPeer};
use crate::fnn::FNN_VERSION;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSettingsResponse {
    pub network: Option<String>,
    pub data_directory: Option<String>,
    pub config_file_path: Option<String>,
    pub key_file_path: Option<String>,
    pub rpc_listen_addr: Option<String>,
    pub fiber_listening_addr: Option<String>,
    pub ckb_rpc_url: Option<String>,
    pub announced_node_name: Option<String>,
    pub connection_mode: String,
    pub public_relay_label: Option<String>,
    pub public_relay_pubkey: Option<String>,
    pub fnn_version: String,
    pub node_pub_key: Option<String>,
    pub ckb_wallet_address: Option<String>,
    pub wallet_password_stored: bool,
    pub node_status: NodeRuntimeStatus,
    pub relay_status: String,
    pub setup_completed_at: Option<String>,
    pub backup_paths: Vec<BackupPathEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPathEntry {
    pub relative_path: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWalletPasswordPayload {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchNetworkPayload {
    pub network: String,
    pub custom_public_node_pubkey: String,
    pub custom_public_node_multiaddr: String,
    pub copy_key_from_current: bool,
    pub imported_private_key: Option<String>,
}

#[tauri::command]
pub fn is_network_provisioned(network: String) -> Result<bool, String> {
    if network != "mainnet" && network != "testnet" {
        return Err("Network must be mainnet or testnet.".into());
    }

    let data_dir = data_directory::resolve_data_directory_for_network(&network)?;
    Ok(data_directory::network_data_directory_is_provisioned(&data_dir))
}

fn backup_paths() -> Vec<BackupPathEntry> {
    vec![
        BackupPathEntry {
            relative_path: "ckb/key".into(),
            description: "CKB wallet key file (sensitive — back up securely)".into(),
        },
        BackupPathEntry {
            relative_path: "fiber/sk".into(),
            description: "Fiber secret key material".into(),
        },
        BackupPathEntry {
            relative_path: "fiber/store".into(),
            description: "Channel state database".into(),
        },
    ]
}

async fn require_node_stopped(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    let manager = state.fnn.lock().await;
    if matches!(
        manager.status(),
        NodeRuntimeStatus::Running { .. } | NodeRuntimeStatus::Starting
    ) {
        return Err("Stop your node before changing this setting.".into());
    }

    manager
        .data_directory()
        .cloned()
        .ok_or_else(|| "Data directory is not configured.".into())
}

async fn build_node_settings(
    state: &State<'_, AppState>,
    data_directory: Option<PathBuf>,
) -> Result<NodeSettingsResponse, String> {
    let manager = state.fnn.lock().await;
    let data_dir = data_directory
        .or_else(|| manager.data_directory().cloned())
        .filter(|path| !path.as_os_str().is_empty());
    let node_status = manager.status();
    let relay_status = manager.relay_state().status.clone();
    drop(manager);

    let studio_metadata = data_dir
        .as_ref()
        .and_then(|path| studio::read_studio_metadata(path).ok());

    let parsed_config = data_dir
        .as_ref()
        .and_then(|path| config_read::read_node_config(path).ok());

    let network = studio_metadata
        .as_ref()
        .map(|metadata| metadata.network.clone())
        .or_else(|| parsed_config.as_ref().and_then(|config| config.chain.clone()));

    let (node_pub_key, live_version, funding_script) = if matches!(node_status, NodeRuntimeStatus::Running { .. }) {
        match rpc::fetch_node_info().await {
            Ok(info) => (
                Some(info.pubkey),
                Some(info.version),
                Some(info.default_funding_lock_script),
            ),
            Err(_) => (None, None, None),
        }
    } else {
        (None, None, None)
    };

    let ckb_wallet_address = network
        .as_deref()
        .zip(funding_script.as_ref())
        .and_then(|(network, script)| ckb_address::script_to_address(network, script));

    let primary_peer = studio_metadata
        .as_ref()
        .and_then(|metadata| metadata.saved_peers.first());

    let (connection_mode, public_relay_label, _public_relay_pubkey) =
        connection_mode_labels(network.as_deref(), primary_peer);

    let fnn_version = live_version.unwrap_or_else(|| FNN_VERSION.to_string());

    let data_provisioned = data_dir
        .as_ref()
        .map(|path| data_directory::network_data_directory_is_provisioned(path))
        .unwrap_or(false);

    Ok(NodeSettingsResponse {
        network,
        data_directory: data_dir
            .as_ref()
            .map(|path| path.display().to_string())
            .or_else(|| studio_metadata.as_ref().map(|metadata| metadata.data_directory.clone())),
        config_file_path: data_dir
            .as_ref()
            .map(|path| path.join("config.yml").display().to_string()),
        key_file_path: data_dir
            .as_ref()
            .map(|path| path.join("ckb").join("key").display().to_string()),
        rpc_listen_addr: parsed_config
            .as_ref()
            .and_then(|config| config.rpc_listening_addr.clone())
            .or_else(|| Some("127.0.0.1:8227".into())),
        fiber_listening_addr: parsed_config
            .as_ref()
            .and_then(|config| config.fiber_listening_addr.clone()),
        ckb_rpc_url: parsed_config
            .as_ref()
            .and_then(|config| config.ckb_rpc_url.clone()),
        announced_node_name: parsed_config
            .as_ref()
            .and_then(|config| config.announced_node_name.clone()),
        connection_mode,
        public_relay_label,
        public_relay_pubkey: primary_peer.map(|peer| peer.pubkey.clone()),
        fnn_version,
        node_pub_key,
        ckb_wallet_address,
        wallet_password_stored: data_provisioned && keychain::get_wallet_password().is_ok(),
        node_status,
        relay_status,
        setup_completed_at: studio_metadata
            .as_ref()
            .map(|metadata| metadata.setup_completed_at.clone()),
        backup_paths: backup_paths(),
    })
}

fn connection_mode_labels(
    network: Option<&str>,
    primary_peer: Option<&SavedPeer>,
) -> (String, Option<String>, Option<String>) {
    let Some(peer) = primary_peer else {
        return (
            "Not configured".into(),
            None,
            None,
        );
    };

    if let Some(network) = network {
        if let Some(relay) = relays::find_relay_by_pubkey(network, &peer.pubkey) {
            return (
                "Outbound via public relays".into(),
                Some(format!("{} ({})", relay.label, relay.id)),
                Some(peer.pubkey.clone()),
            );
        }
    }

    (
        "Custom public node".into(),
        Some(truncate_pubkey(&peer.pubkey)),
        Some(peer.pubkey.clone()),
    )
}

fn truncate_pubkey(pubkey: &str) -> String {
    if pubkey.len() <= 14 {
        return pubkey.to_string();
    }
    format!("{}…{}", &pubkey[..6], &pubkey[pubkey.len() - 4..])
}

#[tauri::command]
pub async fn get_node_settings(
    state: State<'_, AppState>,
    data_directory: Option<String>,
) -> Result<NodeSettingsResponse, String> {
    let data_dir = data_directory
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from);
    build_node_settings(&state, data_dir).await
}

#[tauri::command]
pub async fn open_config_file(
    app: AppHandle,
    state: State<'_, AppState>,
    data_directory: Option<String>,
) -> Result<(), String> {
    let data_dir = data_directory
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from);
    let settings = build_node_settings(&state, data_dir).await?;
    let Some(path) = settings.config_file_path else {
        return Err("Config file path is not available.".into());
    };
    if !Path::new(&path).is_file() {
        return Err("config.yml was not found in your data directory.".into());
    }
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|error| format!("Failed to open config file: {error}"))
}

#[tauri::command]
pub async fn open_data_directory(
    app: AppHandle,
    state: State<'_, AppState>,
    data_directory: Option<String>,
) -> Result<(), String> {
    let data_dir = data_directory
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from);
    let settings = build_node_settings(&state, data_dir).await?;
    let Some(path) = settings.data_directory else {
        return Err("Data directory is not configured.".into());
    };
    if !Path::new(&path).is_dir() {
        return Err("Data directory does not exist.".into());
    }
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|error| format!("Failed to open data directory: {error}"))
}

#[tauri::command]
pub async fn update_wallet_password(
    state: State<'_, AppState>,
    payload: UpdateWalletPasswordPayload,
) -> Result<NodeSettingsResponse, String> {
    let data_directory = require_node_stopped(&state).await?;

    if payload.new_password.trim().is_empty() {
        return Err("New password cannot be empty.".into());
    }

    let current = keychain::get_wallet_password()
        .map_err(|error| format!("Failed to read password from keychain: {error}"))?;

    if current != payload.old_password {
        return Err("Current password is incorrect.".into());
    }

    keychain::set_wallet_password(&payload.new_password)
        .map_err(|error| format!("Failed to store new password in keychain: {error}"))?;

    build_node_settings(&state, Some(data_directory)).await
}

#[tauri::command]
pub async fn switch_network(
    state: State<'_, AppState>,
    payload: SwitchNetworkPayload,
) -> Result<NodeSettingsResponse, String> {
    let current_data_directory = require_node_stopped(&state).await?;

    if payload.network != "mainnet" && payload.network != "testnet" {
        return Err("Network must be mainnet or testnet.".into());
    }

    let new_data_dir = data_directory::resolve_data_directory_for_network(&payload.network)?;
    if new_data_dir == current_data_directory {
        return Err("You are already using this network's data directory.".into());
    }

    let target_provisioned = data_directory::network_data_directory_is_provisioned(&new_data_dir);

    if !target_provisioned {
        fs::create_dir_all(new_data_dir.join("ckb"))
            .map_err(|error| format!("Failed to create data directory: {error}"))?;

        let imported_key = payload
            .imported_private_key
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty());

        let (key_file_mode, imported_private_key) = if payload.copy_key_from_current {
            let source_key = current_data_directory.join("ckb").join("key");
            let dest_key = new_data_dir.join("ckb").join("key");
            if !source_key.is_file() {
                return Err("CKB key file was not found in the current data directory.".into());
            }
            fs::copy(&source_key, &dest_key)
                .map_err(|error| format!("Failed to copy key file: {error}"))?;
            ("existing".to_string(), None)
        } else if let Some(key) = imported_key {
            ("import".to_string(), Some(key.to_string()))
        } else {
            return Err(
                "CKB private key is required to set up this network's data folder.".into(),
            );
        };

        let pubkey = if payload.custom_public_node_pubkey.trim().is_empty() {
            relays::relays_for_network(&payload.network)
                .into_iter()
                .find(|relay| relay.id == "node1")
                .map(|relay| relay.pubkey)
                .unwrap_or_default()
        } else {
            payload.custom_public_node_pubkey.trim().to_string()
        };

        let provision_request = ProvisionRequest {
            network: payload.network.clone(),
            data_directory: new_data_dir.display().to_string(),
            key_file_mode,
            key_file_path: "ckb/key".into(),
            imported_private_key,
            custom_public_node_pubkey: pubkey,
            custom_public_node_multiaddr: payload.custom_public_node_multiaddr.trim().to_string(),
        };

        provision::provision_data_directory(&provision_request)
            .map_err(|error| format!("Failed to provision new network data directory: {error}"))?;
    }

    build_node_settings(&state, Some(new_data_dir)).await
}

#[tauri::command]
pub async fn migrate_legacy_data_directory(
    network: String,
) -> Result<String, String> {
    if network != "mainnet" && network != "testnet" {
        return Err("Network must be mainnet or testnet.".into());
    }

    let canonical = data_directory::resolve_data_directory_for_network(&network)?;
    if data_directory::network_data_directory_is_provisioned(&canonical) {
        return Ok(canonical.display().to_string());
    }

    let legacy = data_directory::resolve_legacy_data_directory()?;
    if !data_directory::network_data_directory_is_provisioned(&legacy) {
        return Ok(canonical.display().to_string());
    }

    copy_dir_recursive(&legacy, &canonical)
        .map_err(|error| format!("Failed to migrate legacy data directory: {error}"))?;

    if let Ok(mut studio_metadata) = studio::read_studio_metadata(&canonical) {
        studio_metadata.data_directory = canonical.display().to_string();
        studio_metadata.network = network;
        let _ = studio::write_studio_metadata(&canonical, &studio_metadata);
    }

    Ok(canonical.display().to_string())
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> std::io::Result<()> {
    if !destination.exists() {
        fs::create_dir_all(destination)?;
    }

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let source_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_path, &dest_path)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncates_long_pubkey() {
        let value = "02b361ecec510a7dcb4a451f594e4656f1ba0b218d93a3c93910daa0b5690a7d2f";
        let truncated = truncate_pubkey(value);
        assert!(truncated.contains('…'));
        assert!(truncated.len() < value.len());
    }
}
