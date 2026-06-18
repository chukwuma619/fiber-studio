use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::FNN_VERSION;

pub const STUDIO_METADATA_FILE: &str = "studio.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioMetadata {
    pub fnn_version: String,
    pub setup_completed_at: String,
    pub network: String,
    pub data_directory: String,
    pub custom_public_node_pubkey: String,
    pub custom_public_node_multiaddr: String,
}

impl StudioMetadata {
    pub fn new(
        network: String,
        data_directory: String,
        custom_public_node_pubkey: String,
        custom_public_node_multiaddr: String,
    ) -> Self {
        Self {
            fnn_version: FNN_VERSION.to_string(),
            setup_completed_at: chrono::Utc::now().to_rfc3339(),
            network,
            data_directory,
            custom_public_node_pubkey,
            custom_public_node_multiaddr,
        }
    }
}

#[derive(Debug, Error)]
pub enum StudioError {
    #[error("failed to read studio metadata: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse studio metadata: {0}")]
    Parse(#[from] serde_json::Error),
}

pub fn write_studio_metadata(data_dir: &Path, metadata: &StudioMetadata) -> Result<(), StudioError> {
    let path = data_dir.join(STUDIO_METADATA_FILE);
    let json = serde_json::to_string_pretty(metadata)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn read_studio_metadata(data_dir: &Path) -> Result<StudioMetadata, StudioError> {
    let path = data_dir.join(STUDIO_METADATA_FILE);
    let raw = fs::read_to_string(path)?;
    let metadata = serde_json::from_str(&raw)?;
    Ok(metadata)
}

pub fn persist_relay_multiaddr(
    data_dir: &Path,
    metadata: &StudioMetadata,
    multiaddr: &str,
) -> Result<(), StudioError> {
    if metadata.custom_public_node_multiaddr.trim() == multiaddr.trim() {
        return Ok(());
    }

    let mut updated = metadata.clone();
    updated.custom_public_node_multiaddr = multiaddr.trim().to_string();
    write_studio_metadata(data_dir, &updated)
}
