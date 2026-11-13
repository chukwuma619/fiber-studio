use std::fs;
use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigWriteError {
    #[error("config file not found")]
    NotFound,
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

fn yaml_key_matches(line: &str, key: &str) -> bool {
    let trimmed = line.trim_start();
    let without_comment = trimmed
        .strip_prefix('#')
        .map(str::trim_start)
        .unwrap_or(trimmed);
    without_comment == format!("{key}:") || without_comment.starts_with(&format!("{key}: "))
}

fn is_store_sync_writes_line(line: &str) -> bool {
    yaml_key_matches(line, "store_sync_writes")
}

fn is_listening_addr_line(line: &str) -> bool {
    // Exact primary key only — must not match `listening_addrs`.
    let trimmed = line.trim_start();
    let without_comment = trimmed
        .strip_prefix('#')
        .map(str::trim_start)
        .unwrap_or(trimmed);
    without_comment == "listening_addr:"
        || without_comment.starts_with("listening_addr: ")
}

fn is_listening_addrs_header(line: &str) -> bool {
    yaml_key_matches(line, "listening_addrs")
}

fn is_listening_addrs_item(line: &str) -> bool {
    let trimmed = line.trim_start();
    let without_comment = trimmed
        .strip_prefix('#')
        .map(str::trim_start)
        .unwrap_or(trimmed);
    without_comment.starts_with("- ")
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
    let mut replaced = false;
    let mut out = Vec::with_capacity(lines.len() + 1);

    for line in lines.drain(..) {
        if is_store_sync_writes_line(&line) {
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
        let mut with_insert = Vec::with_capacity(out.len() + 1);
        for line in out {
            with_insert.push(line.clone());
            if !inserted && is_listening_addr_line(&line) {
                with_insert.push(new_line.clone());
                inserted = true;
            }
        }
        out = with_insert;
        if !inserted {
            // Fallback: append under the fiber: key.
            let mut with_fiber = Vec::with_capacity(out.len() + 1);
            for line in out {
                with_fiber.push(line.clone());
                if line.trim() == "fiber:" {
                    with_fiber.push(new_line.clone());
                    inserted = true;
                }
            }
            out = with_fiber;
            if !inserted {
                out.push(new_line);
            }
        }
    }

    fs::write(path, join_lines(&out, trailing))?;
    Ok(())
}

/// Replace `fiber.listening_addrs` with the given multiaddrs (empty clears the key).
pub fn set_listening_addrs(data_dir: &Path, addrs: &[String]) -> Result<(), ConfigWriteError> {
    let path = config_path(data_dir)?;
    let content = fs::read_to_string(&path)?;
    let trailing = ends_with_newline(&content);

    let cleaned: Vec<String> = {
        let mut out = Vec::new();
        let mut skipping_items = false;
        for line in content.lines() {
            if is_listening_addrs_header(line) {
                skipping_items = true;
                continue;
            }
            if skipping_items {
                if is_listening_addrs_item(line) || line.trim().is_empty() {
                    // Skip list items (and blank lines inside a commented block).
                    if line.trim().is_empty() {
                        // Keep blank lines only if they look like section spacing after the block.
                        // Stop skipping on blank so later sections stay intact.
                        skipping_items = false;
                        out.push(line.to_string());
                    }
                    continue;
                }
                // Next non-item key ends the block.
                skipping_items = false;
            }
            out.push(line.to_string());
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
    for line in cleaned {
        out.push(line.clone());
        if !inserted && is_listening_addr_line(&line) {
            out.extend(block.iter().cloned());
            inserted = true;
        }
    }

    if !inserted && !block.is_empty() {
        let mut with_fiber = Vec::with_capacity(out.len() + block.len());
        for line in out {
            with_fiber.push(line.clone());
            if line.trim() == "fiber:" {
                with_fiber.extend(block.iter().cloned());
                inserted = true;
            }
        }
        out = with_fiber;
        if !inserted {
            out.extend(block);
        }
    }

    fs::write(path, join_lines(&out, trailing))?;
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
}
