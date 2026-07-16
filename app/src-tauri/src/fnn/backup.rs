use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

pub fn backup_data_directory(source: &Path) -> Result<PathBuf, String> {
    if !source.exists() {
        return Err(format!(
            "Data directory does not exist: {}",
            source.display()
        ));
    }

    let parent = source
        .parent()
        .ok_or_else(|| "Data directory has no parent path.".to_string())?;
    let dir_name = source
        .file_name()
        .ok_or_else(|| "Data directory has no name.".to_string())?
        .to_string_lossy();

    let timestamp = Local::now().format("%Y%m%d-%H%M%S");
    let backup_name = format!("{dir_name}-backup-{timestamp}");
    let destination = parent.join(backup_name);

    if destination.exists() {
        return Err(format!(
            "Backup destination already exists: {}",
            destination.display()
        ));
    }

    copy_dir_recursive(source, &destination)
        .map_err(|error| format!("Failed to back up data directory: {error}"))?;

    Ok(destination)
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> std::io::Result<()> {
    if !destination.exists() {
        fs::create_dir_all(destination)?;
    }

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let source_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_path, &dest_path)?;
        }
    }

    Ok(())
}
