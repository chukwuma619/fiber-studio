use thiserror::Error;

const MAINNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/mainnet.yml");
const TESTNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/testnet.yml");

const MAINNET_CKB_RPC_URL: &str = "https://mainnet.ckbapp.dev/";

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("unsupported network: {0}")]
    UnsupportedNetwork(String),
    #[error("failed to parse config template: {0}")]
    Parse(#[from] serde_yaml::Error),
    #[error("config template is missing expected fields")]
    InvalidTemplate,
}

pub fn build_config_yaml(network: &str) -> Result<String, ConfigError> {
    let template = match network {
        "mainnet" => MAINNET_TEMPLATE,
        "testnet" => TESTNET_TEMPLATE,
        other => return Err(ConfigError::UnsupportedNetwork(other.to_string())),
    };

    let mut value: serde_yaml::Value = serde_yaml::from_str(template)?;

    if network == "mainnet" {
        let ckb = value
            .get_mut("ckb")
            .and_then(|entry| entry.as_mapping_mut())
            .ok_or(ConfigError::InvalidTemplate)?;
        ckb.insert(
            serde_yaml::Value::String("rpc_url".into()),
            serde_yaml::Value::String(MAINNET_CKB_RPC_URL.into()),
        );
    }

    if let Some(fiber) = value.get_mut("fiber").and_then(|entry| entry.as_mapping_mut()) {
        fiber.insert(
            serde_yaml::Value::String("announced_node_name".into()),
            serde_yaml::Value::String("fiber-studio".into()),
        );
    }

    Ok(serde_yaml::to_string(&value)?)
}
