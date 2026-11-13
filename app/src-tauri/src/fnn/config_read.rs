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
