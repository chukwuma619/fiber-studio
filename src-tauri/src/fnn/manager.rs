use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use shared_child::SharedChild;
use tauri::{AppHandle, Manager};
use thiserror::Error;

use crate::state::AppState;

use super::log_store;
use super::logs::normalize_log_line;
use super::rpc::{self, NodeInfo};
use super::spawn;

pub const MAX_LOG_LINES: usize = 500;

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RelayConnectionState {
    pub status: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum NodeRuntimeStatus {
    Stopped,
    Starting,
    Running { version: String, pubkey: String },
    Error { message: String },
}

impl Default for NodeRuntimeStatus {
    fn default() -> Self {
        Self::Stopped
    }
}

#[derive(Debug, Error)]
pub enum ManagerError {
    #[error("fnn is already running")]
    AlreadyRunning,
    #[error("failed to spawn fnn: {0}")]
    Spawn(String),
    #[error("Fiber node did not become ready: {0}")]
    Rpc(#[from] rpc::RpcError),
    #[error("failed to stop fnn: {0}")]
    Stop(String),
}

pub struct FnnManager {
    status: NodeRuntimeStatus,
    data_directory: Option<PathBuf>,
    relay_state: RelayConnectionState,
    logs: Arc<Mutex<VecDeque<String>>>,
    log_file_offset: Arc<Mutex<u64>>,
    log_tail_cancel: Option<Arc<AtomicBool>>,
    child: Option<Arc<SharedChild>>,
}

impl Default for FnnManager {
    fn default() -> Self {
        Self {
            status: NodeRuntimeStatus::Stopped,
            data_directory: None,
            relay_state: RelayConnectionState::default(),
            logs: Arc::new(Mutex::new(VecDeque::new())),
            log_file_offset: Arc::new(Mutex::new(0)),
            log_tail_cancel: None,
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

    pub fn relay_state(&self) -> RelayConnectionState {
        self.relay_state.clone()
    }

    pub fn recent_logs(&self, limit: usize) -> Vec<String> {
        let logs = self.logs.lock().expect("log mutex poisoned");
        let skip = logs.len().saturating_sub(limit);
        logs.iter()
            .skip(skip)
            .map(|line| normalize_log_line(line))
            .filter(|line| !line.is_empty())
            .collect()
    }

    pub fn stop_managed(&mut self) -> Result<(), ManagerError> {
        self.stop_log_tail();

        if let Some(child) = self.child.take() {
            child
                .kill()
                .map_err(|error| ManagerError::Stop(error.to_string()))?;
        }
        self.status = NodeRuntimeStatus::Stopped;
        self.relay_state = RelayConnectionState::default();
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<(), ManagerError> {
        self.stop_log_tail();

        if self.child.is_some() {
            return self.stop_managed();
        }

        if rpc::fetch_node_info().await.is_ok() {
            super::process::kill_process_on_port(rpc::FNN_RPC_PORT).map_err(ManagerError::Stop)?;
            self.append_log("Stopped running fnn process.");
        }

        self.status = NodeRuntimeStatus::Stopped;
        self.relay_state = RelayConnectionState::default();
        Ok(())
    }
    pub async fn sync_health(&mut self, data_directory: Option<PathBuf>) {
        if matches!(self.status, NodeRuntimeStatus::Starting) {
            return;
        }

        if self.child.is_some() {
            match rpc::fetch_node_info().await {
                Ok(info) => {
                    self.status = NodeRuntimeStatus::Running {
                        version: info.version,
                        pubkey: info.pubkey,
                    };
                }
                Err(_) if matches!(self.status, NodeRuntimeStatus::Running { .. }) => {
                    let _ = self.stop_managed();
                }
                Err(_) => {}
            }
            return;
        }

        match rpc::fetch_node_info().await {
            Ok(info) => {
                let was_stopped = !matches!(self.status, NodeRuntimeStatus::Running { .. });
                self.status = NodeRuntimeStatus::Running {
                    version: info.version,
                    pubkey: info.pubkey,
                };
                if let Some(directory) = data_directory {
                    self.data_directory = Some(directory);
                }
                if was_stopped {
                    self.restore_logs_from_disk();
                    self.start_log_tail();
                    self.append_log("Connected to already-running fnn process.");
                }
            }
            Err(_) if matches!(self.status, NodeRuntimeStatus::Running { .. }) => {
                self.status = NodeRuntimeStatus::Stopped;
            }
            Err(_) => {}
        }
    }

    pub fn mark_exited(&mut self, code: Option<i32>) {
        self.child = None;

        if matches!(self.status, NodeRuntimeStatus::Stopped) {
            return;
        }

        self.append_log(&format!("fnn exited with code {code:?}"));

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
        self.sync_health(Some(data_directory.clone())).await;

        if self.child.is_some() && matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            return Err(ManagerError::AlreadyRunning);
        }

        if self.child.is_none() && matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            self.data_directory = Some(data_directory.clone());
            self.restore_logs_from_disk();
            self.start_log_tail();
            return rpc::fetch_node_info().await.map_err(ManagerError::Rpc);
        }

        self.stop_log_tail();
        self.stop_managed().ok();
        self.status = NodeRuntimeStatus::Starting;
        self.data_directory = Some(data_directory.clone());

        let config_path = data_directory.join("config.yml");
        let log_path = log_store::log_file_path(&data_directory);

        self.clear_session_logs();
        self.append_log("Spawning fnn sidecar…");

        let child = spawn::spawn_with_log_file(&config_path, &data_directory, &log_path, password)
            .map_err(ManagerError::Spawn)?;

        let child = Arc::new(child);
        self.child = Some(Arc::clone(&child));
        self.start_log_tail();

        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let exit_code = tauri::async_runtime::spawn_blocking(move || {
                child.wait().ok().and_then(|status| status.code())
            })
            .await
            .ok()
            .flatten();

            if let Some(state) = app_handle.try_state::<AppState>() {
                let mut manager = state.fnn.lock().await;
                manager.mark_exited(exit_code);
            }
        });

        let node_info = rpc::wait_for_node_info().await?;
        self.status = NodeRuntimeStatus::Running {
            version: node_info.version.clone(),
            pubkey: node_info.pubkey.clone(),
        };

        Ok(node_info)
    }

    fn append_log(&self, line: &str) {
        let mut logs = self.logs.lock().expect("log mutex poisoned");
        push_log_line(&mut logs, normalize_log_line(line));
    }

    fn clear_session_logs(&self) {
        if let Some(data_directory) = &self.data_directory {
            let path = log_store::log_file_path(data_directory);
            let _ = log_store::clear_log_file(&path);
        }

        self.logs.lock().expect("log mutex poisoned").clear();
        *self
            .log_file_offset
            .lock()
            .expect("log offset mutex poisoned") = 0;
    }

    fn restore_logs_from_disk(&self) {
        let Some(data_directory) = &self.data_directory else {
            return;
        };

        let path = log_store::log_file_path(data_directory);
        let Ok(lines) = log_store::read_tail_lines(&path, MAX_LOG_LINES) else {
            return;
        };

        {
            let mut buffer = self.logs.lock().expect("log mutex poisoned");
            buffer.clear();
            for line in lines {
                push_log_line(&mut buffer, line);
            }
        }

        if let Ok(offset) = log_store::file_len(&path) {
            *self
                .log_file_offset
                .lock()
                .expect("log offset mutex poisoned") = offset;
        }
    }

    fn start_log_tail(&mut self) {
        let Some(data_directory) = self.data_directory.clone() else {
            return;
        };

        if self.log_tail_cancel.is_some() {
            return;
        }

        let cancel = Arc::new(AtomicBool::new(false));
        self.log_tail_cancel = Some(Arc::clone(&cancel));

        let logs = Arc::clone(&self.logs);
        let offset = Arc::clone(&self.log_file_offset);

        tauri::async_runtime::spawn(async move {
            loop {
                if cancel.load(Ordering::Relaxed) {
                    break;
                }

                tokio::time::sleep(Duration::from_secs(1)).await;

                if cancel.load(Ordering::Relaxed) {
                    break;
                }

                let path = log_store::log_file_path(&data_directory);
                let Ok(new_lines) = log_store::read_new_lines(
                    &path,
                    &mut *offset.lock().expect("log offset mutex poisoned"),
                ) else {
                    continue;
                };

                if new_lines.is_empty() {
                    continue;
                }

                let mut buffer = logs.lock().expect("log mutex poisoned");
                for line in new_lines {
                    push_log_line(&mut buffer, line);
                }
            }
        });
    }

    fn stop_log_tail(&mut self) {
        if let Some(cancel) = self.log_tail_cancel.take() {
            cancel.store(true, Ordering::Relaxed);
        }
    }

    pub fn set_error(&mut self, message: String) {
        self.status = NodeRuntimeStatus::Error { message };
    }
}

fn push_log_line(buffer: &mut VecDeque<String>, line: String) {
    if line.is_empty() {
        return;
    }

    buffer.push_back(line);
    while buffer.len() > MAX_LOG_LINES {
        buffer.pop_front();
    }
}
