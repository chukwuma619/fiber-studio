use std::fs;
use std::path::Path;
use std::sync::Mutex;

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
    /// Channel IDs open when this data directory first crossed onto Fiber ≥ 0.10.
    /// Fiber's `list_channels` does not expose `ChannelFeatures` (0 = legacy, 1 = V2),
    /// and 0.10 rejects new non-V2 opens, so this snapshot is the V1 set.
    #[serde(default)]
    pub legacy_channel_ids: Vec<String>,
    #[serde(default)]
    pub legacy_channel_nudge_dismissed: bool,
    /// True once Studio has taken (or intentionally skipped) the V1 channel snapshot.
    #[serde(default)]
    pub legacy_channel_snapshot_done: bool,
    /// Previously a `created_at` cutoff. Not a protocol signal — cleared on sync.
    /// Kept so older `studio.json` files still parse.
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
            legacy_channel_cutoff_ms: None,
        };
        metadata.normalize_saved_peers();
        metadata
    }

    /// `created_at_ms` is Fiber's unix-millisecond `list_channels.created_at`. It is not
    /// used: that RPC does not include `ChannelFeatures`, and a timestamp cutoff labels
    /// Channel V2 channels opened before Studio snapshotted as V1.
    pub fn channel_is_legacy(&self, channel_id: &str, _created_at_ms: u64) -> bool {
        let normalized = normalize_channel_id(channel_id);
        self.legacy_channel_ids
            .iter()
            .any(|id| normalize_channel_id(id) == normalized)
    }

    /// True when Studio can distinguish V1 vs V2 for channels that are not in the snapshot.
    pub fn channel_protocol_known(&self) -> bool {
        self.legacy_channel_snapshot_done
    }

    /// Snapshot open channel ids only while this directory's Studio pin is still below
    /// Fiber 0.10. A pin that is already ≥ 0.10 is sealed without copying current
    /// channels — those may already be V2. Also drops any stored `created_at` cutoff.
    pub fn sync_channel_v2_upgrade(&mut self, current_channel_ids: &[String]) -> bool {
        let mut changed = false;

        if version::version_at_least(FNN_VERSION, CHANNEL_V2_SINCE) && !self.legacy_channel_snapshot_done
        {
            if version::version_less_than(&self.fnn_version, CHANNEL_V2_SINCE) {
                self.legacy_channel_ids = current_channel_ids
                    .iter()
                    .map(|id| normalize_channel_id(id))
                    .filter(|id| !id.is_empty())
                    .collect();
                self.legacy_channel_nudge_dismissed = false;
            }
            self.legacy_channel_snapshot_done = true;
            changed = true;
        }

        if self.legacy_channel_cutoff_ms.is_some() {
            self.legacy_channel_cutoff_ms = None;
            changed = true;
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

static STUDIO_IO: Mutex<()> = Mutex::new(());

fn lock_studio_io() -> std::sync::MutexGuard<'static, ()> {
    STUDIO_IO.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Read-modify-write `studio.json` under one lock so a dismiss cannot drop a snapshot.
pub fn update_studio_metadata(
    data_dir: &Path,
    mutate: impl FnOnce(&mut StudioMetadata) -> bool,
) -> Result<StudioMetadata, StudioError> {
    let _guard = lock_studio_io();
    let mut metadata = read_studio_metadata_unlocked(data_dir)?;
    if mutate(&mut metadata) {
        write_studio_metadata_unlocked(data_dir, &metadata)?;
    }
    Ok(metadata)
}

pub fn write_studio_metadata(
    data_dir: &Path,
    metadata: &StudioMetadata,
) -> Result<(), StudioError> {
    let _guard = lock_studio_io();
    let mut to_write = metadata.clone();
    // Callers pass a struct they read earlier. Keep the legacy snapshot from disk so
    // a peer or CCH save cannot drop a version snapshot written in between.
    if let Ok(current) = read_studio_metadata_unlocked(data_dir) {
        to_write.legacy_channel_ids = current.legacy_channel_ids;
        to_write.legacy_channel_snapshot_done = current.legacy_channel_snapshot_done;
        to_write.legacy_channel_nudge_dismissed = current.legacy_channel_nudge_dismissed;
        to_write.legacy_channel_cutoff_ms = current.legacy_channel_cutoff_ms;
    }
    write_studio_metadata_unlocked(data_dir, &to_write)
}

fn write_studio_metadata_unlocked(
    data_dir: &Path,
    metadata: &StudioMetadata,
) -> Result<(), StudioError> {
    let mut normalized = metadata.clone();
    normalized.normalize_saved_peers();

    let path = data_dir.join(STUDIO_METADATA_FILE);
    let json = serde_json::to_string_pretty(&normalized)?;
    atomic_write(&path, &json)?;
    Ok(())
}

pub fn read_studio_metadata(data_dir: &Path) -> Result<StudioMetadata, StudioError> {
    let _guard = lock_studio_io();
    read_studio_metadata_unlocked(data_dir)
}

fn read_studio_metadata_unlocked(data_dir: &Path) -> Result<StudioMetadata, StudioError> {
    let path = data_dir.join(STUDIO_METADATA_FILE);
    let raw = fs::read_to_string(path)?;
    let mut metadata: StudioMetadata = serde_json::from_str(&raw)?;
    metadata.normalize_saved_peers();
    Ok(metadata)
}

fn atomic_write(path: &Path, contents: &str) -> Result<(), std::io::Error> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(STUDIO_METADATA_FILE);
    let tmp = path.with_file_name(format!(".{file_name}.tmp"));
    fs::write(&tmp, contents)?;
    fs::rename(&tmp, path)?;
    Ok(())
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
        assert!(metadata.legacy_channel_cutoff_ms.is_none());
        assert!(metadata.channel_is_legacy("0xAbC", 0));
        assert!(!metadata.channel_is_legacy("0xnew", 1));
    }

    #[test]
    fn already_on_v2_does_not_guess_open_channels_are_legacy() {
        let mut metadata = base_metadata(FNN_VERSION);
        assert!(metadata.sync_channel_v2_upgrade(&["0xalready-open".into()]));
        assert!(metadata.legacy_channel_snapshot_done);
        assert!(metadata.legacy_channel_ids.is_empty());
        assert!(metadata.channel_protocol_known());
        assert!(!metadata.channel_is_legacy("0xalready-open", 1));
    }

    #[test]
    fn clears_created_at_cutoff_without_dropping_real_ids() {
        let mut metadata = base_metadata(FNN_VERSION);
        metadata.legacy_channel_snapshot_done = true;
        metadata.legacy_channel_cutoff_ms = Some(u64::MAX);
        metadata.legacy_channel_ids = vec!["0xreal".into()];
        assert!(metadata.sync_channel_v2_upgrade(&["0xother".into()]));
        assert!(metadata.legacy_channel_cutoff_ms.is_none());
        assert_eq!(metadata.legacy_channel_ids, vec!["0xreal".to_string()]);
        assert!(metadata.channel_is_legacy("0xreal", 1));
        assert!(!metadata.channel_is_legacy("0xother", 1));
    }

    #[test]
    fn seals_existing_snapshot_without_clobbering_ids() {
        let mut metadata = base_metadata(FNN_VERSION);
        metadata.legacy_channel_ids = vec!["0xkeep".into()];
        metadata.legacy_channel_cutoff_ms = Some(50);
        assert!(metadata.sync_channel_v2_upgrade(&["0xother".into()]));
        assert_eq!(metadata.legacy_channel_ids, vec!["0xkeep".to_string()]);
        assert!(metadata.legacy_channel_snapshot_done);
        assert!(metadata.legacy_channel_cutoff_ms.is_none());
        assert!(!metadata.channel_is_legacy("0xother", 1));
    }

    #[test]
    fn fresh_metadata_marks_snapshot_done() {
        let mut metadata = StudioMetadata::new("testnet".into(), "/tmp".into(), Vec::new());
        assert!(metadata.legacy_channel_snapshot_done);
        assert!(metadata.legacy_channel_ids.is_empty());
        assert!(metadata.legacy_channel_cutoff_ms.is_none());
        assert!(!metadata.sync_channel_v2_upgrade(&["0xshould-not-snapshot".into()]));
        assert!(metadata.legacy_channel_ids.is_empty());
    }
}
