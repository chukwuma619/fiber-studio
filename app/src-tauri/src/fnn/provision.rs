use std::fs;
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use thiserror::Error;

use super::config;
use super::relays;
use super::studio::{write_studio_metadata, SavedPeer, StudioMetadata};

#[derive(Debug, Error)]
pub enum ProvisionError {
    #[error("data directory is empty")]
    EmptyDataDirectory,
    #[error("imported private key is required")]
    MissingImportedKey,
    #[error("key file not found: {0}")]
    KeyFileNotFound(String),
    #[error("failed to write node files: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to build config: {0}")]
    Config(#[from] config::ConfigError),
    #[error("failed to write studio metadata: {0}")]
    Studio(#[from] super::studio::StudioError),
    #[error("failed to apply liquidity config: {0}")]
    Liquidity(#[from] super::liquidity::LiquidityError),
}

#[derive(Debug, Clone)]
pub struct ProvisionRequest {
    pub network: String,
    pub data_directory: String,
    pub key_file_mode: String,
    pub key_file_path: String,
    pub imported_private_key: Option<String>,
    pub custom_public_node_pubkey: String,
    pub custom_public_node_multiaddr: String,
}

pub fn provision_data_directory(request: &ProvisionRequest) -> Result<(), ProvisionError> {
    if request.data_directory.trim().is_empty() {
        return Err(ProvisionError::EmptyDataDirectory);
    }

    let data_dir = Path::new(&request.data_directory);
    fs::create_dir_all(data_dir.join("ckb"))?;

    match request.key_file_mode.as_str() {
        "import" => {
            let private_key = request
                .imported_private_key
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .ok_or(ProvisionError::MissingImportedKey)?;

            let first_line = private_key.lines().next().unwrap_or(private_key).trim();
            let normalized = if let Some(stripped) = first_line
                .strip_prefix("0x")
                .or_else(|| first_line.strip_prefix("0X"))
            {
                stripped
            } else {
                first_line
            };
            let key_path = data_dir.join("ckb").join("key");
            fs::write(&key_path, format!("{normalized}\n"))?;
            #[cfg(unix)]
            {
                let mut permissions = fs::metadata(&key_path)?.permissions();
                permissions.set_mode(0o600);
                fs::set_permissions(&key_path, permissions)?;
            }
        }
        "existing" => {
            let relative = if request.key_file_path.trim().is_empty() {
                "ckb/key".to_string()
            } else {
                request.key_file_path.clone()
            };
            let key_path = data_dir.join(&relative);
            if !key_path.is_file() {
                return Err(ProvisionError::KeyFileNotFound(
                    key_path.display().to_string(),
                ));
            }
        }
        other => {
            return Err(ProvisionError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("unsupported key file mode: {other}"),
            )));
        }
    }

    let config_yaml = config::build_config_yaml(&request.network)?;
    fs::write(data_dir.join("config.yml"), config_yaml)?;

    let mut saved_peers: Vec<SavedPeer> = relays::relays_for_network(&request.network)
        .into_iter()
        .map(|relay| SavedPeer {
            pubkey: relay.pubkey,
            multiaddr: relay.multiaddr.unwrap_or_default(),
        })
        .collect();
    let custom_pubkey = request.custom_public_node_pubkey.trim();
    if !custom_pubkey.is_empty()
        && !relays::is_official_relay_pubkey(&request.network, custom_pubkey)
    {
        saved_peers.push(SavedPeer {
            pubkey: custom_pubkey.to_string(),
            multiaddr: request.custom_public_node_multiaddr.clone(),
        });
    }
    let metadata = StudioMetadata::new(
        request.network.clone(),
        request.data_directory.clone(),
        saved_peers,
    );
    write_studio_metadata(data_dir, &metadata)?;
    super::liquidity::apply_to_data_dir(data_dir)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::path::Path;

    fn temp_dir() -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fiber-studio-provision-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    fn request(dir: &Path, key: Option<&str>, custom_pubkey: &str) -> ProvisionRequest {
        ProvisionRequest {
            network: "testnet".to_string(),
            data_directory: dir.display().to_string(),
            key_file_mode: "import".to_string(),
            key_file_path: String::new(),
            imported_private_key: key.map(str::to_string),
            custom_public_node_pubkey: custom_pubkey.to_string(),
            custom_public_node_multiaddr: "/ip4/127.0.0.1/tcp/8228".to_string(),
        }
    }

    #[test]
    fn import_strips_the_key_prefix_and_saves_official_relays() {
        let dir = temp_dir();
        let key = "ab".repeat(32);
        provision_data_directory(&request(&dir, Some(&format!("0X{key}\nignored")), "")).unwrap();

        assert_eq!(
            fs::read_to_string(dir.join("ckb").join("key")).unwrap(),
            format!("{key}\n")
        );
        #[cfg(unix)]
        {
            let mode = fs::metadata(dir.join("ckb").join("key"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(mode, 0o600);
        }
        let config = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(config.contains("chain: testnet"));
        let metadata = crate::fnn::studio::read_studio_metadata(&dir).unwrap();
        let lsp = crate::fnn::liquidity::service_pubkey("testnet").expect("testnet lsp");
        assert_eq!(metadata.saved_peers.len(), 3);
        assert!(metadata.saved_peers.iter().any(|peer| peer.pubkey == lsp));
        assert_eq!(
            metadata
                .saved_peers
                .iter()
                .filter(|peer| relays::is_official_relay_pubkey("testnet", &peer.pubkey))
                .count(),
            2
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn adds_a_custom_peer_once_and_skips_an_official_duplicate() {
        let dir = temp_dir();
        let official = relays::relays_for_network("testnet")
            .into_iter()
            .next()
            .unwrap()
            .pubkey;
        provision_data_directory(&request(&dir, Some("cd"), &official)).unwrap();
        let metadata = crate::fnn::studio::read_studio_metadata(&dir).unwrap();
        assert_eq!(metadata.saved_peers.len(), 3);
        let _ = fs::remove_dir_all(&dir);

        let dir = temp_dir();
        let custom = "02".to_string() + &"aa".repeat(32);
        provision_data_directory(&request(&dir, Some("cd"), &custom)).unwrap();
        let metadata = crate::fnn::studio::read_studio_metadata(&dir).unwrap();
        assert_eq!(metadata.saved_peers.len(), 4);
        assert!(metadata
            .saved_peers
            .iter()
            .any(|peer| peer.pubkey == custom));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_an_empty_directory_a_missing_key_and_a_missing_existing_file() {
        let dir = temp_dir();
        let mut empty = request(&dir, Some("aa"), "");
        empty.data_directory = "  ".to_string();
        assert!(matches!(
            provision_data_directory(&empty),
            Err(ProvisionError::EmptyDataDirectory)
        ));

        assert!(matches!(
            provision_data_directory(&request(&dir, None, "")),
            Err(ProvisionError::MissingImportedKey)
        ));

        let mut existing = request(&dir, None, "");
        existing.key_file_mode = "existing".to_string();
        existing.key_file_path = "ckb/key".to_string();
        assert!(matches!(
            provision_data_directory(&existing),
            Err(ProvisionError::KeyFileNotFound(_))
        ));
        let _ = fs::remove_dir_all(dir);
    }
}
