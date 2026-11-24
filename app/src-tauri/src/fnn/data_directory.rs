use std::path::{Path, PathBuf};

const LEGACY_DIR_NAME: &str = "fiber-studio";

pub fn dir_name_for_network(network: &str) -> Result<&'static str, String> {
    match network {
        "mainnet" => Ok("fiber-studio-mainnet"),
        "testnet" => Ok("fiber-studio-testnet"),
        _ => Err("Network must be mainnet or testnet.".into()),
    }
}

pub fn resolve_data_directory_for_network(network: &str) -> Result<PathBuf, String> {
    let dir_name = dir_name_for_network(network)?;

    #[cfg(target_os = "macos")]
    {
        let home = std::env::home_dir().ok_or("Home directory is not available.")?;
        return Ok(home.join("Library").join(dir_name));
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA")
            .map_err(|_| "AppData directory is not available.".to_string())?;
        return Ok(PathBuf::from(app_data).join(dir_name));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::home_dir().ok_or("Home directory is not available.")?;
        Ok(home.join(".local").join("share").join(dir_name))
    }
}

pub fn resolve_legacy_data_directory() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::home_dir().ok_or("Home directory is not available.")?;
        return Ok(home.join("Library").join(LEGACY_DIR_NAME));
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA")
            .map_err(|_| "AppData directory is not available.".to_string())?;
        return Ok(PathBuf::from(app_data).join(LEGACY_DIR_NAME));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::home_dir().ok_or("Home directory is not available.")?;
        Ok(home.join(".local").join("share").join(LEGACY_DIR_NAME))
    }
}

pub fn network_data_directory_is_provisioned(path: &Path) -> bool {
    path.join("studio.json").is_file() || path.join("config.yml").is_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir() -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fiber-studio-data-dir-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    #[test]
    fn names_only_the_two_supported_networks() {
        assert_eq!(
            dir_name_for_network("testnet").unwrap(),
            "fiber-studio-testnet"
        );
        assert_eq!(
            dir_name_for_network("mainnet").unwrap(),
            "fiber-studio-mainnet"
        );
        assert!(dir_name_for_network("devnet").is_err());
    }

    #[test]
    fn resolves_a_network_folder_under_the_platform_data_root() {
        let path = resolve_data_directory_for_network("testnet").unwrap();
        assert!(path.ends_with("fiber-studio-testnet"));
        let legacy = resolve_legacy_data_directory().unwrap();
        assert!(legacy.ends_with(LEGACY_DIR_NAME));
        assert_ne!(path, legacy);
    }

    #[test]
    fn provisioned_means_studio_metadata_or_a_node_config_exists() {
        let dir = temp_dir();
        assert!(!network_data_directory_is_provisioned(&dir));

        fs::write(dir.join("config.yml"), "fiber: {}\n").unwrap();
        assert!(network_data_directory_is_provisioned(&dir));
        fs::remove_file(dir.join("config.yml")).unwrap();
        assert!(!network_data_directory_is_provisioned(&dir));

        fs::write(dir.join("studio.json"), "{}\n").unwrap();
        assert!(network_data_directory_is_provisioned(&dir));
        let _ = fs::remove_dir_all(dir);
    }
}
