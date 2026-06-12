use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use thiserror::Error;

use crate::state::AppState;

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
    #[error(
        "Fiber RPC port 127.0.0.1:8227 is already in use. Another fnn process may still be running — quit it and try again."
    )]
    PortInUse,
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

    /// Reconcile in-memory status with the managed child process and fnn RPC.
    pub async fn sync_health(&mut self) {
        if matches!(self.status, NodeRuntimeStatus::Starting) {
            return;
        }

        let rpc_ok = rpc::fetch_node_info().await.is_ok();

        if self.child.is_some() {
            if rpc_ok {
                if let Ok(info) = rpc::fetch_node_info().await {
                    self.status = NodeRuntimeStatus::Running {
                        version: info.version,
                        pubkey: info.pubkey,
                    };
                }
            } else if matches!(self.status, NodeRuntimeStatus::Running { .. }) {
                let _ = self.stop();
            }
            return;
        }

        if matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            self.status = NodeRuntimeStatus::Stopped;
        }
    }

    pub fn mark_exited(&mut self, code: Option<i32>) {
        self.child = None;
        self.status = match code {
            Some(0) | None => NodeRuntimeStatus::Stopped,
            Some(exit_code) => NodeRuntimeStatus::Error {
                message: format!("fnn exited with code {exit_code}"),
            },
        };
    }

    pub async fn start(
        &mut self,
        app: &AppHandle,
        data_directory: PathBuf,
        password: &str,
    ) -> Result<NodeInfo, ManagerError> {
        self.sync_health().await;

        if self.child.is_some() && matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            return Err(ManagerError::AlreadyRunning);
        }

        if self.child.is_none() && rpc::fetch_node_info().await.is_ok() {
            return Err(ManagerError::PortInUse);
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
        let app_handle = app.clone();
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
                        {
                            let mut buffer = logs.lock().expect("log mutex poisoned");
                            buffer.push_back(format!(
                                "fnn exited with code {:?}",
                                payload.code
                            ));
                        }

                        if let Some(state) = app_handle.try_state::<AppState>() {
                            let mut manager = state.fnn.lock().await;
                            manager.mark_exited(payload.code);
                        }
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
