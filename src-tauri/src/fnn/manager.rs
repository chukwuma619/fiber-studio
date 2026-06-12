use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use thiserror::Error;

use super::rpc::{self, NodeInfo};

const MAX_LOG_LINES: usize = 500;
const SIDECAR_NAME: &str = "binaries/fnn";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum NodeRuntimeStatus {
    Stopped,
    Starting,
    Running {
        version: String,
        pubkey: String,
    },
    Error {
        message: String,
    },
}

impl Default for NodeRuntimeStatus {
    fn default() -> Self {
        Self::Stopped
    }
}

#[derive(Debug, Error)]
pub enum ManagerError {
    #[error("data directory is not configured")]
    MissingDataDirectory,
    #[error("fnn is already running")]
    AlreadyRunning,
    #[error("failed to spawn fnn: {0}")]
    Spawn(String),
    #[error("fnn RPC did not become ready: {0}")]
    Rpc(#[from] rpc::RpcError),
    #[error("failed to stop fnn: {0}")]
    Stop(String),
}

pub struct FnnManager {
    status: NodeRuntimeStatus,
    data_directory: Option<PathBuf>,
    logs: Arc<Mutex<VecDeque<String>>>,
    child: Option<tauri_plugin_shell::process::CommandChild>,
}

impl Default for FnnManager {
    fn default() -> Self {
        Self {
            status: NodeRuntimeStatus::Stopped,
            data_directory: None,
            logs: Arc::new(Mutex::new(VecDeque::new())),
            child: None,
        }
    }
}

impl FnnManager {
    pub fn status(&self) -> NodeRuntimeStatus {
        self.status.clone()
    }

    pub fn data_directory(&self) -> Option<&PathBuf> {
        self.data_directory.as_ref()
    }

    pub fn recent_logs(&self, limit: usize) -> Vec<String> {
        let logs = self.logs.lock().expect("log mutex poisoned");
        logs.iter().rev().take(limit).cloned().collect::<Vec<_>>()
    }

    pub fn stop(&mut self) -> Result<(), ManagerError> {
        if let Some(child) = self.child.take() {
            child
                .kill()
                .map_err(|error| ManagerError::Stop(error.to_string()))?;
        }
        self.status = NodeRuntimeStatus::Stopped;
        Ok(())
    }

    pub async fn start(
        &mut self,
        app: &AppHandle,
        data_directory: PathBuf,
        password: &str,
    ) -> Result<NodeInfo, ManagerError> {
        if matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            return Err(ManagerError::AlreadyRunning);
        }

        self.stop().ok();
        self.status = NodeRuntimeStatus::Starting;
        self.data_directory = Some(data_directory.clone());

        let config_path = data_directory.join("config.yml");
        let config_arg = config_path.to_string_lossy().to_string();
        let data_arg = data_directory.to_string_lossy().to_string();

        let mut command = match app.shell().sidecar(SIDECAR_NAME) {
            Ok(command) => command,
            Err(_) => app.shell().command("fnn"),
        };

        command = command
            .args(["-c", &config_arg, "-d", &data_arg])
            .env("FIBER_SECRET_KEY_PASSWORD", password)
            .env("RUST_LOG", "info");

        let (mut rx, child) = command
            .spawn()
            .map_err(|error| ManagerError::Spawn(error.to_string()))?;

        self.child = Some(child);
        self.append_log("Spawning fnn sidecar…".to_string());

        let logs = Arc::clone(&self.logs);
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                        let text = String::from_utf8_lossy(&line).trim().to_string();
                        if text.is_empty() {
                            continue;
                        }
                        let mut buffer = logs.lock().expect("log mutex poisoned");
                        buffer.push_back(text);
                        while buffer.len() > MAX_LOG_LINES {
                            buffer.pop_front();
                        }
                    }
                    CommandEvent::Error(message) => {
                        let mut buffer = logs.lock().expect("log mutex poisoned");
                        buffer.push_back(format!("fnn error: {message}"));
                    }
                    CommandEvent::Terminated(payload) => {
                        let mut buffer = logs.lock().expect("log mutex poisoned");
                        buffer.push_back(format!(
                            "fnn exited with code {:?}",
                            payload.code
                        ));
                        break;
                    }
                    _ => {}
                }
            }
        });

        let node_info = rpc::wait_for_node_info().await?;
        self.status = NodeRuntimeStatus::Running {
            version: node_info.version.clone(),
            pubkey: node_info.pubkey.clone(),
        };
        Ok(node_info)
    }

    fn append_log(&self, line: String) {
        let mut logs = self.logs.lock().expect("log mutex poisoned");
        logs.push_back(line);
        while logs.len() > MAX_LOG_LINES {
            logs.pop_front();
        }
    }

    pub fn set_error(&mut self, message: String) {
        self.status = NodeRuntimeStatus::Error { message };
    }
}
