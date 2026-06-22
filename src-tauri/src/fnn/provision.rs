use std::fs;
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use thiserror::Error;

use super::config;
use super::studio::{write_studio_metadata, StudioMetadata};

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
            let key_path = data_dir.join("ckb").join("key");
            fs::write(&key_path, format!("{first_line}\n"))?;
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

    let metadata = StudioMetadata::new(
        request.network.clone(),
        request.data_directory.clone(),
        request.custom_public_node_pubkey.clone(),
        request.custom_public_node_multiaddr.clone(),
    );
    write_studio_metadata(data_dir, &metadata)?;

    Ok(())
}
