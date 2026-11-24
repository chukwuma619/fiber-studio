use std::path::Path;

use serde::Deserialize;
use thiserror::Error;

use super::config_write::{self, JitReceiverConfig};
use super::relays;
use super::studio;

const LIQUIDITY_JSON: &str = include_str!("../../../shared/liquidity.json");

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WalletLiquidity {
    Hub {
        label: String,
        pubkey: String,
        multiaddr: String,
    },
    Lsp {
        label: String,
        pubkey: String,
        multiaddr: String,
        max_amount: u128,
        max_open_fee: u128,
    },
}

#[derive(Debug, Error)]
pub enum LiquidityError {
    #[error("liquidity config is invalid: {0}")]
    Manifest(String),
    #[error("no liquidity provider for network {0}")]
    UnknownNetwork(String),
    #[error("liquidity hub {relay_id} is not an official relay on {network}")]
    UnknownRelay { network: String, relay_id: String },
    #[error("{0}")]
    Config(#[from] config_write::ConfigWriteError),
    #[error("{0}")]
    Studio(#[from] studio::StudioError),
    #[error("liquidity service needs a pubkey, a multiaddr, and a max amount")]
    IncompleteService,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
enum LiquidityEntry {
    Hub {
        #[serde(rename = "relayId")]
        relay_id: String,
        #[serde(default)]
        label: Option<String>,
    },
    Lsp {
        #[serde(default)]
        label: Option<String>,
        pubkey: String,
        #[serde(default)]
        multiaddr: String,
        #[serde(rename = "maxAmountShannons")]
        max_amount_shannons: String,
        #[serde(rename = "maxOpenFeeShannons")]
        max_open_fee_shannons: String,
    },
}

#[derive(Debug, Deserialize)]
struct LiquidityManifest {
    testnet: LiquidityEntry,
    mainnet: LiquidityEntry,
}

fn manifest() -> Result<LiquidityManifest, LiquidityError> {
    serde_json::from_str(LIQUIDITY_JSON)
        .map_err(|error| LiquidityError::Manifest(error.to_string()))
}

fn label_or_default(label: Option<String>) -> String {
    label
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Fiber".to_string())
}

fn parse_amount(raw: &str) -> Result<u128, LiquidityError> {
    raw.trim()
        .parse()
        .map_err(|_| LiquidityError::IncompleteService)
}

pub fn provider_for_network(network: &str) -> Result<WalletLiquidity, LiquidityError> {
    let manifest = manifest()?;
    let entry = match network {
        "testnet" => manifest.testnet,
        "mainnet" => manifest.mainnet,
        other => return Err(LiquidityError::UnknownNetwork(other.to_string())),
    };
    resolve_entry(network, entry)
}

fn resolve_entry(network: &str, entry: LiquidityEntry) -> Result<WalletLiquidity, LiquidityError> {
    match entry {
        LiquidityEntry::Hub { relay_id, label } => {
            let relay = relays::relays_for_network(network)
                .into_iter()
                .find(|relay| relay.id == relay_id)
                .ok_or_else(|| LiquidityError::UnknownRelay {
                    network: network.to_string(),
                    relay_id: relay_id.clone(),
                })?;
            Ok(WalletLiquidity::Hub {
                label: label_or_default(label),
                pubkey: relay.pubkey,
                multiaddr: relay.multiaddr.unwrap_or_default(),
            })
        }
        LiquidityEntry::Lsp {
            label,
            pubkey,
            multiaddr,
            max_amount_shannons,
            max_open_fee_shannons,
        } => {
            let pubkey = pubkey.trim().to_string();
            let multiaddr = multiaddr.trim().to_string();
            let max_amount = parse_amount(&max_amount_shannons)?;
            let max_open_fee = parse_amount(&max_open_fee_shannons)?;
            if pubkey.is_empty() || !multiaddr.starts_with('/') || max_amount == 0 {
                return Err(LiquidityError::IncompleteService);
            }
            Ok(WalletLiquidity::Lsp {
                label: label_or_default(label),
                pubkey,
                multiaddr,
                max_amount,
                max_open_fee,
            })
        }
    }
}

/// Apply wallet liquidity to `config.yml`. The returned string is a node log line.
pub fn apply_to_data_dir(data_dir: &Path) -> Result<String, LiquidityError> {
    let metadata = studio::read_studio_metadata(data_dir)?;
    match provider_for_network(&metadata.network)? {
        WalletLiquidity::Lsp {
            label,
            pubkey,
            multiaddr,
            max_amount,
            max_open_fee,
        } => {
            config_write::set_jit_receiver(
                data_dir,
                Some(&JitReceiverConfig {
                    lsp_pubkey: pubkey.clone(),
                    max_amount,
                    max_open_fee,
                }),
            )?;
            studio::update_studio_metadata(data_dir, |metadata| {
                metadata.ensure_saved_peer(&pubkey, &multiaddr)
            })?;
            Ok(format!("Payments can open a receive channel with {label}."))
        }
        WalletLiquidity::Hub { label, .. } => {
            config_write::set_jit_receiver(data_dir, None)?;
            Ok(format!("Payments use a channel you fund with {label}."))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn shipped_config_uses_the_official_hub() {
        let WalletLiquidity::Hub {
            label,
            pubkey,
            multiaddr,
        } = provider_for_network("testnet").unwrap()
        else {
            panic!("shipped testnet liquidity is a hub");
        };
        assert_eq!(label, "Fiber");
        assert!(relays::is_official_relay_pubkey("testnet", &pubkey));
        assert!(multiaddr.contains("/p2p/"));
        assert!(provider_for_network("devnet").is_err());
    }

    #[test]
    fn lsp_entry_requires_a_dialable_peer_and_a_cap() {
        let missing = resolve_entry(
            "testnet",
            LiquidityEntry::Lsp {
                label: None,
                pubkey: "02aa".into(),
                multiaddr: String::new(),
                max_amount_shannons: "10".into(),
                max_open_fee_shannons: "0".into(),
            },
        );
        assert!(matches!(missing, Err(LiquidityError::IncompleteService)));

        let ready = resolve_entry(
            "testnet",
            LiquidityEntry::Lsp {
                label: Some("Fiber".into()),
                pubkey: "02bb".into(),
                multiaddr: "/dns4/lsp.example/tcp/8119".into(),
                max_amount_shannons: "10".into(),
                max_open_fee_shannons: "0".into(),
            },
        )
        .unwrap();
        assert!(matches!(
            ready,
            WalletLiquidity::Lsp {
                max_amount: 10,
                max_open_fee: 0,
                ..
            }
        ));
    }

    #[test]
    fn hub_mode_clears_receiver_keys_on_an_existing_directory() {
        let dir = std::env::temp_dir().join(format!(
            "fiber-studio-liquidity-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n  jit_lsp_pubkey: \"02cc\"\n  jit_max_amount: 1\n  jit_service_enabled: true\n",
        )
        .unwrap();
        let metadata =
            studio::StudioMetadata::new("testnet".into(), dir.display().to_string(), vec![]);
        studio::write_studio_metadata(&dir, &metadata).unwrap();

        let summary = apply_to_data_dir(&dir).unwrap();
        assert!(summary.contains("you fund"));
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(!raw.contains("jit_lsp_pubkey"));
        assert!(!raw.contains("jit_max_amount"));
        assert!(raw.contains("jit_service_enabled: true"));
        let _ = fs::remove_dir_all(dir);
    }
}
