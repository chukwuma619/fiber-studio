use std::fs;
use std::path::Path;

use thiserror::Error;

const JIT_CLIENT_KEYS: [&str; 3] = ["jit_lsp_pubkey", "jit_max_amount", "jit_max_open_fee"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JitReceiverConfig {
    pub lsp_pubkey: String,
    pub max_amount: u128,
    pub max_open_fee: u128,
}

#[derive(Debug, Error)]
pub enum ConfigWriteError {
    #[error("config file not found")]
    NotFound,
    #[error("config is missing a fiber: section")]
    MissingFiberSection,
    #[error("listening address must be a multiaddr starting with / and without quotes or spaces (got \"{0}\")")]
    InvalidAddr(String),
    #[error("liquidity service pubkey must be 66 hex characters")]
    InvalidJitPubkey,
    #[error("failed to read config: {0}")]
    Io(#[from] std::io::Error),
}

fn config_path(data_dir: &Path) -> Result<std::path::PathBuf, ConfigWriteError> {
    let path = data_dir.join("config.yml");
    if !path.is_file() {
        return Err(ConfigWriteError::NotFound);
    }
    Ok(path)
}

fn ends_with_newline(content: &str) -> bool {
    content.ends_with('\n')
}

fn join_lines(lines: &[String], trailing_newline: bool) -> String {
    let mut out = lines.join("\n");
    if trailing_newline && !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn strip_yaml_comment(line: &str) -> &str {
    let trimmed = line.trim_start();
    trimmed
        .strip_prefix('#')
        .map(str::trim_start)
        .unwrap_or(trimmed)
}

fn yaml_key_matches(line: &str, key: &str) -> bool {
    let without_comment = strip_yaml_comment(line);
    without_comment == format!("{key}:") || without_comment.starts_with(&format!("{key}: "))
}

fn is_top_level_key(line: &str) -> bool {
    if line.starts_with(' ') || line.starts_with('\t') {
        return false;
    }
    let trimmed = line.trim();
    !trimmed.is_empty() && !trimmed.starts_with('#') && trimmed.contains(':')
}

/// Inclusive start index of `fiber:` and exclusive end (next top-level key or EOF).
fn fiber_section_bounds(lines: &[String]) -> Option<(usize, usize)> {
    let start = lines.iter().position(|line| line.trim() == "fiber:")?;
    let end = lines
        .iter()
        .enumerate()
        .skip(start + 1)
        .find(|(_, line)| is_top_level_key(line))
        .map(|(index, _)| index)
        .unwrap_or(lines.len());
    Some((start, end))
}

fn validate_multiaddr(addr: &str) -> Result<(), ConfigWriteError> {
    let unsafe_char = addr.chars().any(|character| {
        character.is_whitespace()
            || character == '"'
            || character == '\\'
            || character == '#'
            || character.is_control()
    });
    if !addr.starts_with('/') || unsafe_char {
        return Err(ConfigWriteError::InvalidAddr(addr.to_string()));
    }
    Ok(())
}

fn atomic_write(path: &Path, contents: &str) -> Result<(), std::io::Error> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("config.yml");
    let tmp = path.with_file_name(format!(".{file_name}.tmp"));
    fs::write(&tmp, contents)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn is_store_sync_writes_line(line: &str) -> bool {
    yaml_key_matches(line, "store_sync_writes")
}

fn is_active_listening_addr_line(line: &str) -> bool {
    // Exact primary key only — must not match `listening_addrs` or a comment.
    let trimmed = line.trim_start();
    if trimmed.starts_with('#') {
        return false;
    }
    trimmed == "listening_addr:" || trimmed.starts_with("listening_addr: ")
}

fn is_listening_addrs_header(line: &str) -> bool {
    yaml_key_matches(line, "listening_addrs")
}

fn is_listening_addrs_item(line: &str) -> bool {
    strip_yaml_comment(line).starts_with("- ")
}

/// Set `fiber.store_sync_writes` while preserving surrounding config comments.
pub fn set_store_sync_writes(data_dir: &Path, enabled: bool) -> Result<(), ConfigWriteError> {
    let path = config_path(data_dir)?;
    let content = fs::read_to_string(&path)?;
    let trailing = ends_with_newline(&content);
    let new_line = format!(
        "  store_sync_writes: {}",
        if enabled { "true" } else { "false" }
    );

    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
    let (section_start, section_end) =
        fiber_section_bounds(&lines).ok_or(ConfigWriteError::MissingFiberSection)?;
    let mut replaced = false;
    let mut out = Vec::with_capacity(lines.len() + 1);

    for (index, line) in lines.drain(..).enumerate() {
        let in_fiber = index > section_start && index < section_end;
        if in_fiber && is_store_sync_writes_line(&line) {
            if !replaced {
                out.push(new_line.clone());
                replaced = true;
            }
            continue;
        }
        out.push(line);
    }

    if !replaced {
        let mut inserted = false;
        let mut in_fiber = false;
        let mut with_insert = Vec::with_capacity(out.len() + 1);
        for line in out {
            if is_top_level_key(&line) {
                in_fiber = line.trim() == "fiber:";
            }
            let is_anchor = in_fiber && !inserted && is_active_listening_addr_line(&line);
            with_insert.push(line);
            if is_anchor {
                with_insert.push(new_line.clone());
                inserted = true;
            }
        }
        out = with_insert;
        if !inserted {
            let mut with_fiber = Vec::with_capacity(out.len() + 1);
            for line in out {
                let is_fiber = line.trim() == "fiber:";
                with_fiber.push(line);
                if is_fiber {
                    with_fiber.push(new_line.clone());
                }
            }
            out = with_fiber;
        }
    }

    atomic_write(&path, &join_lines(&out, trailing))?;
    Ok(())
}

/// Replace `fiber.listening_addrs` with the given multiaddrs (empty clears the key).
pub fn set_listening_addrs(data_dir: &Path, addrs: &[String]) -> Result<(), ConfigWriteError> {
    for addr in addrs {
        validate_multiaddr(addr)?;
    }

    let path = config_path(data_dir)?;
    let content = fs::read_to_string(&path)?;
    let trailing = ends_with_newline(&content);
    let source: Vec<String> = content.lines().map(str::to_string).collect();
    let (section_start, section_end) =
        fiber_section_bounds(&source).ok_or(ConfigWriteError::MissingFiberSection)?;

    let cleaned: Vec<String> = {
        let mut out = Vec::new();
        let mut skipping_items = false;
        let mut pending_blanks = Vec::new();
        for (index, line) in source.iter().enumerate() {
            let in_fiber = index > section_start && index < section_end;
            if in_fiber && is_listening_addrs_header(line) {
                skipping_items = true;
                pending_blanks.clear();
                continue;
            }
            if skipping_items {
                if line.trim().is_empty() {
                    pending_blanks.push(line.clone());
                    continue;
                }
                if is_listening_addrs_item(line) {
                    pending_blanks.clear();
                    continue;
                }
                skipping_items = false;
                out.append(&mut pending_blanks);
            }
            out.push(line.clone());
        }
        out
    };

    let mut block = Vec::new();
    if !addrs.is_empty() {
        block.push("  listening_addrs:".to_string());
        for addr in addrs {
            block.push(format!("    - \"{addr}\""));
        }
    }

    let mut out = Vec::with_capacity(cleaned.len() + block.len());
    let mut inserted = false;
    let mut in_fiber = false;
    for line in cleaned {
        if is_top_level_key(&line) {
            in_fiber = line.trim() == "fiber:";
        }
        let is_anchor = in_fiber && !inserted && is_active_listening_addr_line(&line);
        out.push(line);
        if is_anchor {
            out.extend(block.iter().cloned());
            inserted = true;
        }
    }

    if !inserted && !block.is_empty() {
        let mut with_fiber = Vec::with_capacity(out.len() + block.len());
        for line in out {
            let is_fiber = line.trim() == "fiber:";
            with_fiber.push(line);
            if is_fiber {
                with_fiber.extend(block.iter().cloned());
            }
        }
        out = with_fiber;
    }

    atomic_write(&path, &join_lines(&out, trailing))?;
    Ok(())
}

fn is_active_yaml_key(line: &str, key: &str) -> bool {
    let trimmed = line.trim_start();
    if trimmed.starts_with('#') {
        return false;
    }
    yaml_key_matches(line, key)
}

fn is_jit_client_key(line: &str) -> bool {
    JIT_CLIENT_KEYS
        .iter()
        .any(|key| is_active_yaml_key(line, key))
}

fn normalize_jit_pubkey(raw: &str) -> Result<String, ConfigWriteError> {
    let hex = raw
        .trim()
        .strip_prefix("0x")
        .or_else(|| raw.trim().strip_prefix("0X"))
        .unwrap_or(raw.trim());
    let valid = hex.len() == 66 && hex.chars().all(|character| character.is_ascii_hexdigit());
    if !valid {
        return Err(ConfigWriteError::InvalidJitPubkey);
    }
    Ok(hex.to_ascii_lowercase())
}

/// Write or clear the JIT receiver keys. Server-side JIT keys are left alone.
pub fn set_jit_receiver(
    data_dir: &Path,
    config: Option<&JitReceiverConfig>,
) -> Result<(), ConfigWriteError> {
    let block = match config {
        Some(config) => {
            let pubkey = normalize_jit_pubkey(&config.lsp_pubkey)?;
            vec![
                format!("  jit_lsp_pubkey: \"{pubkey}\""),
                format!("  jit_max_amount: {}", config.max_amount),
                format!("  jit_max_open_fee: {}", config.max_open_fee),
            ]
        }
        None => Vec::new(),
    };

    let path = config_path(data_dir)?;
    let content = fs::read_to_string(&path)?;
    let trailing = ends_with_newline(&content);
    let source: Vec<String> = content.lines().map(str::to_string).collect();
    let (section_start, section_end) =
        fiber_section_bounds(&source).ok_or(ConfigWriteError::MissingFiberSection)?;

    let cleaned: Vec<String> = source
        .into_iter()
        .enumerate()
        .filter(|(index, line)| {
            let in_fiber = *index > section_start && *index < section_end;
            !(in_fiber && is_jit_client_key(line))
        })
        .map(|(_, line)| line)
        .collect();

    let mut out = Vec::with_capacity(cleaned.len() + block.len());
    let mut inserted = false;
    let mut in_fiber = false;
    for line in cleaned {
        if is_top_level_key(&line) {
            in_fiber = line.trim() == "fiber:";
        }
        let is_anchor = in_fiber && !inserted && is_active_listening_addr_line(&line);
        out.push(line);
        if is_anchor {
            out.extend(block.iter().cloned());
            inserted = true;
        }
    }

    if !inserted && !block.is_empty() {
        let mut with_fiber = Vec::with_capacity(out.len() + block.len());
        for line in out {
            let is_fiber = line.trim() == "fiber:";
            with_fiber.push(line);
            if is_fiber {
                with_fiber.extend(block.iter().cloned());
            }
        }
        out = with_fiber;
    }

    atomic_write(&path, &join_lines(&out, trailing))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fiber-studio-config-write-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    #[test]
    fn enables_commented_store_sync_writes() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n  # store_sync_writes: false\n",
        )
        .unwrap();

        set_store_sync_writes(&dir, true).unwrap();
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(raw.contains("store_sync_writes: true"));
        assert!(!raw.contains("# store_sync_writes"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn writes_listening_addrs_after_primary() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n  chain: testnet\n",
        )
        .unwrap();

        set_listening_addrs(&dir, &["/ip6/::/tcp/8228".into()]).unwrap();
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(raw.contains("listening_addrs:"));
        assert!(raw.contains("/ip6/::/tcp/8228"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn store_sync_does_not_insert_under_listening_addrs() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addrs:\n    - \"/ip6/::/tcp/8228\"\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n",
        )
        .unwrap();

        set_store_sync_writes(&dir, true).unwrap();
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        let addr_idx = raw.find("listening_addr:").expect("primary listen");
        let sync_idx = raw.find("store_sync_writes: true").expect("sync writes");
        assert!(
            sync_idx > addr_idx,
            "store_sync_writes should follow primary listening_addr, not listening_addrs\n{raw}"
        );
        assert!(!raw.contains("listening_addrs:\n  store_sync_writes"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn blank_line_inside_listening_addrs_does_not_orphan_items() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n  listening_addrs:\n    - \"/ip6/::/tcp/8228\"\n\n    - \"/ip4/1.2.3.4/tcp/8228\"\n  chain: testnet\nrpc:\n  listening_addr: \"127.0.0.1:8227\"\n",
        )
        .unwrap();

        set_listening_addrs(&dir, &["/ip6/::/tcp/8229".into()]).unwrap();
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(raw.contains("/ip6/::/tcp/8229"));
        assert!(!raw.contains("/ip6/::/tcp/8228"));
        assert!(!raw.contains("/ip4/1.2.3.4/tcp/8228"));
        assert!(raw.contains("chain: testnet"));
        assert!(raw.contains("listening_addr: \"127.0.0.1:8227\""));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_listening_addr_that_would_break_yaml() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n",
        )
        .unwrap();

        let error =
            set_listening_addrs(&dir, &["/ip4/1.2.3.4/tcp/8228\"\n  chain: mainnet".into()])
                .unwrap_err();
        assert!(matches!(error, ConfigWriteError::InvalidAddr(_)));
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(!raw.contains("chain: mainnet"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn writes_and_clears_jit_receiver_keys() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n  # jit_lsp_pubkey: keep-me\n  chain: testnet\nrpc:\n  listening_addr: \"127.0.0.1:8227\"\n",
        )
        .unwrap();

        let pubkey = "02".to_string() + &"ab".repeat(32);
        set_jit_receiver(
            &dir,
            Some(&JitReceiverConfig {
                lsp_pubkey: format!("0X{pubkey}"),
                max_amount: 42,
                max_open_fee: 0,
            }),
        )
        .unwrap();
        let raw = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(raw.contains(&format!("jit_lsp_pubkey: \"{pubkey}\"")));
        assert!(raw.contains("jit_max_amount: 42"));
        assert!(raw.contains("jit_max_open_fee: 0"));
        assert!(raw.contains("# jit_lsp_pubkey: keep-me"));
        assert!(raw.contains("listening_addr: \"127.0.0.1:8227\""));

        set_jit_receiver(&dir, None).unwrap();
        let cleared = fs::read_to_string(dir.join("config.yml")).unwrap();
        assert!(!cleared.contains("jit_max_amount"));
        assert!(!cleared.contains(&format!("jit_lsp_pubkey: \"{pubkey}\"")));
        assert!(cleared.contains("# jit_lsp_pubkey: keep-me"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_a_short_jit_pubkey() {
        let dir = temp_dir();
        fs::write(
            dir.join("config.yml"),
            "fiber:\n  listening_addr: \"/ip4/0.0.0.0/tcp/8228\"\n",
        )
        .unwrap();
        let error = set_jit_receiver(
            &dir,
            Some(&JitReceiverConfig {
                lsp_pubkey: "02aa".into(),
                max_amount: 1,
                max_open_fee: 0,
            }),
        )
        .unwrap_err();
        assert!(matches!(error, ConfigWriteError::InvalidJitPubkey));
        let _ = fs::remove_dir_all(dir);
    }
}
