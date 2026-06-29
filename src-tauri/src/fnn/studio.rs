use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::FNN_VERSION;

pub const STUDIO_METADATA_FILE: &str = "studio.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPeer {
    pub pubkey: String,
    #[serde(default)]
    pub multiaddr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioMetadata {
    pub fnn_version: String,
    pub setup_completed_at: String,
    pub network: String,
    pub data_directory: String,
    #[serde(default)]
    pub saved_peers: Vec<SavedPeer>,
}

impl StudioMetadata {
    pub fn new(network: String, data_directory: String, saved_peers: Vec<SavedPeer>) -> Self {
        let mut metadata = Self {
            fnn_version: FNN_VERSION.to_string(),
            setup_completed_at: chrono::Utc::now().to_rfc3339(),
            network,
            data_directory,
            saved_peers,
        };
        metadata.normalize_saved_peers();
        metadata
    }

    pub fn normalize_saved_peers(&mut self) {
        let mut unique = Vec::new();

        for peer in self.saved_peers.drain(..) {
            let pubkey = peer.pubkey.trim();
            if pubkey.is_empty() {
                continue;
            }

            if let Some(existing) = unique
                .iter_mut()
                .find(|saved: &&mut SavedPeer| pubkeys_equal(&saved.pubkey, pubkey))
            {
                if existing.multiaddr.trim().is_empty() && !peer.multiaddr.trim().is_empty() {
                    existing.multiaddr = peer.multiaddr.trim().to_string();
                }
                continue;
            }

            unique.push(SavedPeer {
                pubkey: pubkey.to_string(),
                multiaddr: peer.multiaddr.trim().to_string(),
            });
        }

        self.saved_peers = unique;
    }

    pub fn saved_peer_pubkeys(&self) -> Vec<&str> {
        self.saved_peers
            .iter()
            .map(|peer| peer.pubkey.as_str())
            .collect()
    }

    pub fn find_saved_peer(&self, pubkey: &str) -> Option<&SavedPeer> {
        self.saved_peers
            .iter()
            .find(|peer| pubkeys_equal(&peer.pubkey, pubkey))
    }

    pub fn find_saved_peer_mut(&mut self, pubkey: &str) -> Option<&mut SavedPeer> {
        self.saved_peers
            .iter_mut()
            .find(|peer| pubkeys_equal(&peer.pubkey, pubkey))
    }

    pub fn has_saved_peer(&self, pubkey: &str) -> bool {
        self.find_saved_peer(pubkey).is_some()
    }
}

fn pubkeys_equal(left: &str, right: &str) -> bool {
    normalize_pubkey(left) == normalize_pubkey(right)
}

fn normalize_pubkey(pubkey: &str) -> String {
    pubkey.trim().trim_start_matches("0x").to_ascii_lowercase()
}

#[derive(Debug, Error)]
pub enum StudioError {
    #[error("failed to read studio metadata: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse studio metadata: {0}")]
    Parse(#[from] serde_json::Error),
}

pub fn write_studio_metadata(
    data_dir: &Path,
    metadata: &StudioMetadata,
) -> Result<(), StudioError> {
    let mut normalized = metadata.clone();
    normalized.normalize_saved_peers();

    let path = data_dir.join(STUDIO_METADATA_FILE);
    let json = serde_json::to_string_pretty(&normalized)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn read_studio_metadata(data_dir: &Path) -> Result<StudioMetadata, StudioError> {
    let path = data_dir.join(STUDIO_METADATA_FILE);
    let raw = fs::read_to_string(path)?;
    let mut metadata: StudioMetadata = serde_json::from_str(&raw)?;
    metadata.normalize_saved_peers();
    Ok(metadata)
}

pub fn persist_relay_multiaddr(
    data_dir: &Path,
    metadata: &StudioMetadata,
    pubkey: &str,
    multiaddr: &str,
) -> Result<(), StudioError> {
    let Some(peer) = metadata.find_saved_peer(pubkey) else {
        return Ok(());
    };

    if peer.multiaddr.trim() == multiaddr.trim() {
        return Ok(());
    }

    let mut updated = metadata.clone();
    if let Some(peer) = updated.find_saved_peer_mut(pubkey) {
        peer.multiaddr = multiaddr.trim().to_string();
    }
    write_studio_metadata(data_dir, &updated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dedupes_saved_peers_by_pubkey() {
        let mut metadata = StudioMetadata {
            fnn_version: FNN_VERSION.to_string(),
            setup_completed_at: "2024-01-01T00:00:00Z".to_string(),
            network: "testnet".to_string(),
            data_directory: "/tmp/test".to_string(),
            saved_peers: vec![
                SavedPeer {
                    pubkey: "02ABC".into(),
                    multiaddr: String::new(),
                },
                SavedPeer {
                    pubkey: "02abc".into(),
                    multiaddr: "/ip4/1.2.3.4/tcp/8228".into(),
                },
            ],
        };

        metadata.normalize_saved_peers();

        assert_eq!(metadata.saved_peers.len(), 1);
        assert_eq!(metadata.saved_peers[0].multiaddr, "/ip4/1.2.3.4/tcp/8228");
    }
}
