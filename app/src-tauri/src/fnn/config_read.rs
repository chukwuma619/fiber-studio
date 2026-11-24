use std::fs;
use std::path::Path;

use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigReadError {
    #[error("config file not found")]
    NotFound,
    #[error("failed to read config: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse config: {0}")]
    Parse(#[from] serde_yaml::Error),
}

#[derive(Debug, Clone, Deserialize)]
struct FnnConfigFile {
    fiber: FiberSection,
    rpc: RpcSection,
    ckb: CkbSection,
}

#[derive(Debug, Clone, Deserialize)]
struct FiberSection {
    #[serde(default)]
    listening_addr: Option<String>,
    #[serde(default)]
    listening_addrs: Vec<String>,
    #[serde(default)]
    announced_node_name: Option<String>,
    #[serde(default)]
    chain: Option<String>,
    #[serde(default)]
    store_sync_writes: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
struct RpcSection {
    #[serde(default)]
    listening_addr: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct CkbSection {
    #[serde(default)]
    rpc_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedNodeConfig {
    pub fiber_listening_addr: Option<String>,
    pub fiber_listening_addrs: Vec<String>,
    pub announced_node_name: Option<String>,
    pub chain: Option<String>,
    pub rpc_listening_addr: Option<String>,
    pub ckb_rpc_url: Option<String>,
    pub store_sync_writes: bool,
}

pub fn read_node_config(data_dir: &Path) -> Result<ParsedNodeConfig, ConfigReadError> {
    let config_path = data_dir.join("config.yml");
    if !config_path.is_file() {
        return Err(ConfigReadError::NotFound);
    }

    let raw = fs::read_to_string(config_path)?;
    let parsed: FnnConfigFile = serde_yaml::from_str(&raw)?;

    Ok(ParsedNodeConfig {
        fiber_listening_addr: parsed.fiber.listening_addr,
        fiber_listening_addrs: parsed
            .fiber
            .listening_addrs
            .into_iter()
            .map(|addr| addr.trim().to_string())
            .filter(|addr| !addr.is_empty())
            .collect(),
        announced_node_name: parsed.fiber.announced_node_name,
        chain: parsed.fiber.chain,
        rpc_listening_addr: parsed.rpc.listening_addr,
        ckb_rpc_url: parsed.ckb.rpc_url,
        store_sync_writes: parsed.fiber.store_sync_writes.unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir() -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fiber-studio-config-read-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    #[test]
    fn missing_config_is_not_found() {
        let dir = temp_dir();
        assert!(matches!(
            read_node_config(&dir),
            Err(ConfigReadError::NotFound)
        ));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn reads_fiber_and_rpc_fields() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            r#"
fiber:
  listening_addr: "/ip4/0.0.0.0/tcp/8228"
  listening_addrs:
    - " /ip4/1.2.3.4/tcp/1 "
    - " "
    - "/ip6/::/tcp/8228"
  announced_node_name: "fiber-studio"
  chain: testnet
  store_sync_writes: true
rpc:
  listening_addr: "127.0.0.1:8230"
ckb:
  rpc_url: "http://127.0.0.1:8114/"
"#,
        )
        .unwrap();

        let config = read_node_config(&dir).unwrap();
        assert_eq!(
            config.fiber_listening_addr.as_deref(),
            Some("/ip4/0.0.0.0/tcp/8228")
        );
        assert_eq!(
            config.fiber_listening_addrs,
            vec!["/ip4/1.2.3.4/tcp/1", "/ip6/::/tcp/8228"]
        );
        assert_eq!(config.announced_node_name.as_deref(), Some("fiber-studio"));
        assert_eq!(config.chain.as_deref(), Some("testnet"));
        assert!(config.store_sync_writes);
        assert_eq!(config.rpc_listening_addr.as_deref(), Some("127.0.0.1:8230"));
        assert_eq!(
            config.ckb_rpc_url.as_deref(),
            Some("http://127.0.0.1:8114/")
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn defaults_sync_writes_off() {
        let dir = temp_dir();
        fs::write(dir.join("config.yml"), "fiber: {}\nrpc: {}\nckb: {}\n").unwrap();

        let config = read_node_config(&dir).unwrap();
        assert!(!config.store_sync_writes);
        assert!(config.fiber_listening_addrs.is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
