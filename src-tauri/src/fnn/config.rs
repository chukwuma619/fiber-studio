use thiserror::Error;

const MAINNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/mainnet.yml");
const TESTNET_TEMPLATE: &str = include_str!("../../resources/fnn-config/testnet.yml");

pub const MAINNET_CKB_RPC_URL: &str = "https://mainnet.ckbapp.dev/";
const ANNOUNCED_NODE_NAME_LINE: &str = r#"  announced_node_name: "fiber-studio""#;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("unsupported network: {0}")]
    UnsupportedNetwork(String),
}

pub fn build_config_yaml(network: &str) -> Result<String, ConfigError> {
    let template = match network {
        "mainnet" => MAINNET_TEMPLATE,
        "testnet" => TESTNET_TEMPLATE,
        other => return Err(ConfigError::UnsupportedNetwork(other.to_string())),
    };

    let mut yaml = template.replace(
        r#"  # announced_node_name: "my-fiber-node""#,
        ANNOUNCED_NODE_NAME_LINE,
    );

    if network == "mainnet" {
        yaml = yaml.replace(
            r#"  rpc_url: "http://127.0.0.1:8114/""#,
            &format!(r#"  rpc_url: "{MAINNET_CKB_RPC_URL}""#),
        );
    }

    Ok(yaml)
}
