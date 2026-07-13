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
