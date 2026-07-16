use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use shared_child::SharedChild;

/// Runtime sidecar name (last segment of `bundle.externalBin`, placed next to the app binary).
const SIDECAR_NAME: &str = "fnn";

pub fn sidecar_path() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|error| error.to_string())?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "current executable has no parent directory".to_string())?;

    let base_dir = if exe_dir.ends_with("deps") {
        exe_dir.parent().unwrap_or(exe_dir)
    } else {
        exe_dir
    };

    let mut command_path = base_dir.join(SIDECAR_NAME);

    #[cfg(windows)]
    {
        let already_exe = command_path.extension().is_some_and(|ext| ext == "exe");
        if !already_exe {
            command_path.as_mut_os_string().push(".exe");
        }
    }

    #[cfg(not(windows))]
    {
        if command_path.extension().is_some_and(|ext| ext == "exe") {
            command_path.set_extension("");
        }
    }

    if !command_path.exists() {
        return Err(format!(
            "fnn sidecar not found at {}. Run `bun run fetch-fnn`, then restart Fiber Studio.",
            command_path.display()
        ));
    }

    Ok(command_path)
}

pub fn spawn_with_log_file(
    config_path: &Path,
    data_directory: &Path,
    log_path: &Path,
    password: &str,
    allow_migration: bool,
) -> Result<SharedChild, String> {
    let sidecar = sidecar_path()?;
    let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(log_path)
        .map_err(|error| format!("failed to open log file {}: {error}", log_path.display()))?;
    let stderr_file = log_file
        .try_clone()
        .map_err(|error| format!("failed to duplicate log file handle: {error}"))?;

    let mut command = Command::new(sidecar);
    command
        .args([
            "-c",
            &config_path.to_string_lossy(),
            "-d",
            &data_directory.to_string_lossy(),
        ])
        .env("FIBER_SECRET_KEY_PASSWORD", password)
        .env("RUST_LOG", "info")
        .env("NO_COLOR", "1")
        .env("CLICOLOR", "0")
        .stdin(if allow_migration {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(stderr_file));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to spawn fnn: {error}"))?;

    if allow_migration {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(b"y\n")
                .map_err(|error| format!("failed to confirm fnn migration: {error}"))?;
            stdin
                .flush()
                .map_err(|error| format!("failed to flush fnn migration confirmation: {error}"))?;
        }
    }

    Ok(SharedChild::new(child).map_err(|error| format!("failed to wrap fnn process: {error}"))?)
}
