use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::version;
use super::FNN_VERSION;

pub const STUDIO_METADATA_FILE: &str = "studio.json";
pub const CHANNEL_V2_SINCE: &str = "0.10.0";

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
    #[serde(default)]
    pub cch_rpc_url: String,
    /// Channel IDs that existed when this node first moved onto Fiber ≥ 0.10.
    /// Those channels use the legacy (V1) protocol and should be closed when practical.
    #[serde(default)]
    pub legacy_channel_ids: Vec<String>,
    #[serde(default)]
    pub legacy_channel_nudge_dismissed: bool,
    /// True once Studio has taken (or intentionally skipped) the V1 channel snapshot.
    #[serde(default)]
    pub legacy_channel_snapshot_done: bool,
    /// Channels with `created_at` before this unix-ms cutoff are treated as V1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legacy_channel_cutoff_ms: Option<u64>,
}

impl StudioMetadata {
    pub fn new(network: String, data_directory: String, saved_peers: Vec<SavedPeer>) -> Self {
        let mut metadata = Self {
            fnn_version: FNN_VERSION.to_string(),
            setup_completed_at: chrono::Utc::now().to_rfc3339(),
            network,
            data_directory,
            saved_peers,
            cch_rpc_url: String::new(),
            legacy_channel_ids: Vec::new(),
            legacy_channel_nudge_dismissed: false,
            // Fresh installs start on Channel V2 — no prior V1 channels to snapshot.
            legacy_channel_snapshot_done: version::version_at_least(FNN_VERSION, CHANNEL_V2_SINCE),
            legacy_channel_cutoff_ms: if version::version_at_least(FNN_VERSION, CHANNEL_V2_SINCE) {
                Some(now_unix_ms())
            } else {
                None
            },
        };
        metadata.normalize_saved_peers();
        metadata
    }

    /// Prefer passing RPC `created_at` so late-discovered V1 channels still classify
    /// correctly after the ID snapshot. Pass `0` when the timestamp is unknown.
    pub fn channel_is_legacy(&self, channel_id: &str, created_at_ms: u64) -> bool {
        let normalized = normalize_channel_id(channel_id);
        if self
            .legacy_channel_ids
            .iter()
            .any(|id| normalize_channel_id(id) == normalized)
        {
            return true;
        }
        match self.legacy_channel_cutoff_ms {
            Some(cutoff) if created_at_ms > 0 && created_at_ms < cutoff => true,
            _ => false,
        }
    }

    /// True when Studio can distinguish V1 vs V2 for non-listed channels.
    pub fn channel_protocol_known(&self) -> bool {
        self.legacy_channel_snapshot_done
            || self.legacy_channel_cutoff_ms.is_some()
            || !self.legacy_channel_ids.is_empty()
    }

    /// On first boot under Fiber ≥ 0.10, snapshot open channel IDs as legacy V1.
    /// Also catches upgrades that bumped `fnn_version` without taking the snapshot.
    pub fn sync_channel_v2_upgrade(&mut self, current_channel_ids: &[String]) -> bool {
        let mut changed = false;

        if version::version_at_least(FNN_VERSION, CHANNEL_V2_SINCE) && !self.legacy_channel_snapshot_done
        {
            if !self.legacy_channel_ids.is_empty() {
                // Snapshot already existed from an older Studio build — just seal the flag.
                self.legacy_channel_snapshot_done = true;
                if self.legacy_channel_cutoff_ms.is_none() {
                    self.legacy_channel_cutoff_ms = Some(now_unix_ms());
                }
                changed = true;
            } else {
                // Crossing from < 0.10, or catch-up after a missed snapshot.
                let crossing = version::version_less_than(&self.fnn_version, CHANNEL_V2_SINCE);
                self.legacy_channel_ids = current_channel_ids
                    .iter()
                    .map(|id| normalize_channel_id(id))
                    .filter(|id| !id.is_empty())
                    .collect();
                self.legacy_channel_cutoff_ms = Some(now_unix_ms());
                if crossing || !self.legacy_channel_ids.is_empty() {
                    self.legacy_channel_nudge_dismissed = false;
                }
                self.legacy_channel_snapshot_done = true;
                changed = true;
            }
        }

        if self.fnn_version != FNN_VERSION {
            self.fnn_version = FNN_VERSION.to_string();
            changed = true;
        }

        changed
    }

    pub fn cch_rpc_url_trimmed(&self) -> Option<&str> {
        let trimmed = self.cch_rpc_url.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
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

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn pubkeys_equal(left: &str, right: &str) -> bool {
    normalize_pubkey(left) == normalize_pubkey(right)
}

fn normalize_pubkey(pubkey: &str) -> String {
    pubkey.trim().trim_start_matches("0x").to_ascii_lowercase()
}

fn normalize_channel_id(channel_id: &str) -> String {
    channel_id.trim().to_ascii_lowercase()
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

    fn base_metadata(fnn_version: &str) -> StudioMetadata {
        StudioMetadata {
            fnn_version: fnn_version.into(),
            setup_completed_at: "2024-01-01T00:00:00Z".into(),
            network: "testnet".into(),
            data_directory: "/tmp/test".into(),
            saved_peers: Vec::new(),
            cch_rpc_url: String::new(),
            legacy_channel_ids: Vec::new(),
            legacy_channel_nudge_dismissed: false,
            legacy_channel_snapshot_done: false,
            legacy_channel_cutoff_ms: None,
        }
    }

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
            cch_rpc_url: String::new(),
            legacy_channel_ids: Vec::new(),
            legacy_channel_nudge_dismissed: false,
            legacy_channel_snapshot_done: true,
            legacy_channel_cutoff_ms: Some(1),
        };

        metadata.normalize_saved_peers();

        assert_eq!(metadata.saved_peers.len(), 1);
        assert_eq!(metadata.saved_peers[0].multiaddr, "/ip4/1.2.3.4/tcp/8228");
    }

    #[test]
    fn snapshots_legacy_channels_when_crossing_v2() {
        let mut metadata = base_metadata("0.9.1");
        metadata.legacy_channel_nudge_dismissed = true;

        assert!(metadata.sync_channel_v2_upgrade(&["0xABC".into(), "0xdef".into()]));
        assert_eq!(metadata.fnn_version, FNN_VERSION);
        assert_eq!(
            metadata.legacy_channel_ids,
            vec!["0xabc".to_string(), "0xdef".to_string()]
        );
        assert!(!metadata.legacy_channel_nudge_dismissed);
        assert!(metadata.legacy_channel_snapshot_done);
        assert!(metadata.legacy_channel_cutoff_ms.is_some());
        assert!(metadata.channel_is_legacy("0xAbC", 0));
    }

    #[test]
    fn catch_up_snapshots_when_version_already_v2_but_flag_missing() {
        let mut metadata = base_metadata(FNN_VERSION);
        assert!(metadata.sync_channel_v2_upgrade(&["0xold".into()]));
        assert!(metadata.legacy_channel_snapshot_done);
        assert_eq!(metadata.legacy_channel_ids, vec!["0xold".to_string()]);
        assert!(metadata.channel_is_legacy("0xnew", metadata.legacy_channel_cutoff_ms.unwrap() - 1));
        assert!(!metadata.channel_is_legacy("0xnew", metadata.legacy_channel_cutoff_ms.unwrap() + 1));
    }

    #[test]
    fn seals_existing_snapshot_without_clobbering_ids() {
        let mut metadata = base_metadata(FNN_VERSION);
        metadata.legacy_channel_ids = vec!["0xkeep".into()];
        assert!(metadata.sync_channel_v2_upgrade(&["0xother".into()]));
        assert_eq!(metadata.legacy_channel_ids, vec!["0xkeep".to_string()]);
        assert!(metadata.legacy_channel_snapshot_done);
    }

    #[test]
    fn fresh_metadata_marks_snapshot_done() {
        let mut metadata = StudioMetadata::new("testnet".into(), "/tmp".into(), Vec::new());
        assert!(metadata.legacy_channel_snapshot_done);
        assert!(metadata.legacy_channel_ids.is_empty());
        assert!(!metadata.sync_channel_v2_upgrade(&["0xshould-not-snapshot".into()]));
        assert!(metadata.legacy_channel_ids.is_empty());
    }
}
