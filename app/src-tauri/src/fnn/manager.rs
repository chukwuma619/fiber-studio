use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use shared_child::SharedChild;
use tauri::{AppHandle, Manager};
use thiserror::Error;

use crate::state::AppState;

use super::backup;
use super::log_store;
use super::logs::normalize_log_line;
use super::migration::{self, MigrationDetails};
use super::peer_connect::{DialKind, DialTarget, PeerDial};
use super::rpc::{self, NodeInfo, RpcError};
use super::spawn;

pub const MAX_LOG_LINES: usize = 500;
const AUTOCONNECT_RETRY_AFTER_FAILURE: Duration = Duration::from_secs(30);
const AUTOCONNECT_RECHECK_AFTER_SUCCESS: Duration = Duration::from_secs(60);

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
    #[error("database migration required")]
    MigrationRequired {
        message: String,
        has_breaking_change: bool,
    },
    #[error("failed to back up data directory: {0}")]
    Backup(String),
}

pub struct FnnManager {
    status: NodeRuntimeStatus,
    data_directory: Option<PathBuf>,
    relay_state: RelayConnectionState,
    /// A background autoconnect loop is running for the current node session.
    peer_autoconnect_running: bool,
    /// The first autoconnect pass of this node session has finished.
    peer_autoconnect_settled: bool,
    /// Bumped whenever the node session ends; stale loops compare and exit.
    peer_autoconnect_generation: u64,
    /// Normalized pubkeys the user disconnected; skipped until reconnected or node restart.
    peer_autoconnect_paused: Vec<String>,
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
            peer_autoconnect_running: false,
            peer_autoconnect_settled: false,
            peer_autoconnect_generation: 0,
            peer_autoconnect_paused: Vec::new(),
            logs: Arc::new(Mutex::new(VecDeque::new())),
            log_file_offset: Arc::new(Mutex::new(0)),
            log_tail_cancel: None,
            child: None,
        }
    }
}

/// Runs for the whole node session: dials missing relays / saved peers, then
/// rechecks on a timer. Exits as soon as the session (generation) changes.
pub(crate) fn launch_peer_autoconnect(app: &AppHandle, data_directory: PathBuf, generation: u64) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let Some(all_connected) =
                run_autoconnect_pass(&app, &data_directory, generation).await
            else {
                return;
            };
            tokio::time::sleep(if all_connected {
                AUTOCONNECT_RECHECK_AFTER_SUCCESS
            } else {
                AUTOCONNECT_RETRY_AFTER_FAILURE
            })
            .await;
        }
    });
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

    /// Claims the autoconnect loop for this node session if none is running.
    /// Returns the data directory and the generation the loop must keep matching.
    pub fn take_peer_autoconnect(&mut self) -> Option<(PathBuf, u64)> {
        if self.peer_autoconnect_running {
            return None;
        }
        if !matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            return None;
        }
        let directory = self.data_directory.clone()?;
        self.peer_autoconnect_running = true;
        self.peer_autoconnect_generation = self.peer_autoconnect_generation.wrapping_add(1);
        Some((directory, self.peer_autoconnect_generation))
    }

    fn is_autoconnect_current(&self, generation: u64, data_directory: &std::path::Path) -> bool {
        self.peer_autoconnect_generation == generation
            && same_running_directory(self, data_directory)
    }

    /// Stop auto-dialing a peer the user disconnected on purpose.
    pub fn pause_peer_autoconnect(&mut self, pubkey: &str) {
        let normalized = super::peer_connect::normalize_pubkey(pubkey);
        if !normalized.is_empty() && !self.peer_autoconnect_paused.contains(&normalized) {
            self.peer_autoconnect_paused.push(normalized);
        }
    }

    /// Resume auto-dialing a peer after the user connects or saves it again.
    pub fn resume_peer_autoconnect(&mut self, pubkey: &str) {
        let normalized = super::peer_connect::normalize_pubkey(pubkey);
        self.peer_autoconnect_paused.retain(|paused| paused != &normalized);
    }

    fn mark_peers_connecting(&mut self, targets: &[DialTarget]) {
        self.relay_state.status = "connecting".to_string();
        let relay_count = targets
            .iter()
            .filter(|target| target.kind == DialKind::Relay)
            .count();
        let saved_count = targets.len() - relay_count;
        let mut parts = Vec::new();
        if relay_count > 0 {
            let noun = if relay_count == 1 { "relay" } else { "relays" };
            parts.push(format!("{relay_count} official {noun}"));
        }
        if saved_count > 0 {
            let noun = if saved_count == 1 { "peer" } else { "peers" };
            parts.push(format!("{saved_count} saved {noun}"));
        }
        self.append_log(&format!("Connecting to {}…", parts.join(" and ")));
    }

    fn log_peer_dial(&mut self, dial: &PeerDial) {
        let short = short_pubkey(&dial.pubkey);
        let label = match dial.kind {
            DialKind::Relay => "Official relay",
            DialKind::SavedPeer => "Saved peer",
        };
        if dial.status.is_up() {
            self.append_log(&format!("{label} {short} connected"));
        } else {
            self.append_log(&format!("{label} {short} did not connect"));
        }
    }

    /// True after the first relay / saved-peer pass for this running session has finished.
    pub fn peer_autoconnect_settled(&self) -> bool {
        self.peer_autoconnect_settled
    }

    fn finish_autoconnect_pass(&mut self, all_connected: bool) {
        self.peer_autoconnect_settled = true;
        if all_connected {
            if self.relay_state.status == "connecting" || self.relay_state.status == "failed" {
                self.relay_state.status.clear();
            }
        } else if self.relay_state.status == "connecting" {
            self.relay_state.status = "failed".to_string();
        }
    }

    fn reset_peer_autoconnect(&mut self) {
        self.peer_autoconnect_running = false;
        self.peer_autoconnect_settled = false;
        self.peer_autoconnect_generation = self.peer_autoconnect_generation.wrapping_add(1);
        self.peer_autoconnect_paused.clear();
        self.relay_state = RelayConnectionState::default();
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

    /// Full export text: prefers the on-disk session log, else in-memory buffer.
    pub fn export_log_text(&self) -> Option<String> {
        if let Some(data_directory) = &self.data_directory {
            let path = log_store::log_file_path(data_directory);
            if let Ok(content) = std::fs::read_to_string(&path) {
                let normalized = content
                    .lines()
                    .map(normalize_log_line)
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                if !normalized.is_empty() {
                    return Some(normalized);
                }
            }
        }

        let logs = self.recent_logs(MAX_LOG_LINES);
        if logs.is_empty() {
            None
        } else {
            Some(logs.join("\n"))
        }
    }

    pub fn stop_managed(&mut self) -> Result<(), ManagerError> {
        self.stop_log_tail();

        if let Some(child) = self.child.take() {
            child
                .kill()
                .map_err(|error| ManagerError::Stop(error.to_string()))?;
        }
        self.status = NodeRuntimeStatus::Stopped;
        self.reset_peer_autoconnect();
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
        self.reset_peer_autoconnect();
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
                self.reset_peer_autoconnect();
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
        self.reset_peer_autoconnect();
    }

    pub async fn start(
        &mut self,
        app: &AppHandle,
        data_directory: PathBuf,
        password: &str,
        allow_migration: bool,
    ) -> Result<NodeInfo, ManagerError> {
        self.sync_health(Some(data_directory.clone())).await;

        if self.child.is_some() && matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            return Err(ManagerError::AlreadyRunning);
        }

        if self.child.is_none() && matches!(self.status, NodeRuntimeStatus::Running { .. }) {
            self.data_directory = Some(data_directory.clone());
            self.restore_logs_from_disk();
            self.start_log_tail();
            let node_info = rpc::fetch_node_info().await.map_err(ManagerError::Rpc)?;
            self.queue_peer_autoconnect(app);
            return Ok(node_info);
        }

        self.stop_log_tail();
        self.stop_managed().ok();
        self.status = NodeRuntimeStatus::Starting;
        self.data_directory = Some(data_directory.clone());

        if allow_migration {
            let backup_path = backup::backup_data_directory(&data_directory)
                .map_err(ManagerError::Backup)?;
            self.append_log(&format!(
                "Backed up data directory to {}",
                backup_path.display()
            ));
        }

        let config_path = data_directory.join("config.yml");
        let log_path = log_store::log_file_path(&data_directory);

        self.clear_session_logs();
        self.append_log("Spawning fnn sidecar…");

        let child = spawn::spawn_with_log_file(
            &config_path,
            &data_directory,
            &log_path,
            password,
            allow_migration,
        )
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

        let node_info = self.wait_for_ready().await?;
        self.status = NodeRuntimeStatus::Running {
            version: node_info.version.clone(),
            pubkey: node_info.pubkey.clone(),
        };
        self.queue_peer_autoconnect(app);

        Ok(node_info)
    }

    fn queue_peer_autoconnect(&mut self, app: &AppHandle) {
        let Some((directory, generation)) = self.take_peer_autoconnect() else {
            return;
        };
        launch_peer_autoconnect(app, directory, generation);
    }

    async fn wait_for_ready(&mut self) -> Result<NodeInfo, ManagerError> {
        let started = Instant::now();
        let timeout = Duration::from_secs(120);
        let poll = Duration::from_millis(500);

        loop {
            if let Some(details) = self.migration_details_from_logs() {
                if details.cancelled || self.child.is_none() {
                    self.stop_managed().ok();
                    self.status = NodeRuntimeStatus::Stopped;
                    return Err(ManagerError::MigrationRequired {
                        message: details.message,
                        has_breaking_change: details.has_breaking_change,
                    });
                }
            }

            match rpc::fetch_node_info().await {
                Ok(info) => return Ok(info),
                Err(RpcError::Timeout(_)) if started.elapsed() >= timeout => {
                    if let Some(details) = self.migration_details_from_logs() {
                        self.stop_managed().ok();
                        self.status = NodeRuntimeStatus::Stopped;
                        return Err(ManagerError::MigrationRequired {
                            message: details.message,
                            has_breaking_change: details.has_breaking_change,
                        });
                    }
                    return Err(ManagerError::Rpc(RpcError::Timeout(timeout.as_secs())));
                }
                Err(_) if started.elapsed() >= timeout => {
                    if let Some(details) = self.migration_details_from_logs() {
                        self.stop_managed().ok();
                        self.status = NodeRuntimeStatus::Stopped;
                        return Err(ManagerError::MigrationRequired {
                            message: details.message,
                            has_breaking_change: details.has_breaking_change,
                        });
                    }
                    return Err(ManagerError::Rpc(RpcError::Timeout(timeout.as_secs())));
                }
                Err(_) => {
                    tokio::time::sleep(poll).await;
                }
            }
        }
    }

    fn migration_details_from_logs(&self) -> Option<MigrationDetails> {
        let mut logs = self.recent_logs(MAX_LOG_LINES);
        if let Some(data_directory) = &self.data_directory {
            let path = log_store::log_file_path(data_directory);
            if let Ok(file_lines) = log_store::read_tail_lines(&path, MAX_LOG_LINES) {
                logs.extend(file_lines);
            }
        }
        migration::parse_migration_from_logs(&logs)
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

/// One autoconnect pass. Returns `None` when the node session changed and the loop must stop,
/// otherwise whether every target is connected.
async fn run_autoconnect_pass(
    app: &AppHandle,
    data_directory: &std::path::Path,
    generation: u64,
) -> Option<bool> {
    let paused = {
        let state = app.try_state::<AppState>()?;
        let manager = state.fnn.lock().await;
        if !manager.is_autoconnect_current(generation, data_directory) {
            return None;
        }
        manager.peer_autoconnect_paused.clone()
    };

    let targets = super::peer_connect::startup_peers_to_dial(data_directory, &paused).await;

    let targets = {
        let state = app.try_state::<AppState>()?;
        let mut manager = state.fnn.lock().await;
        if !manager.is_autoconnect_current(generation, data_directory) {
            return None;
        }
        match targets {
            Ok(targets) if targets.is_empty() => {
                manager.finish_autoconnect_pass(true);
                return Some(true);
            }
            Ok(targets) => {
                manager.mark_peers_connecting(&targets);
                targets
            }
            Err(error) => {
                manager.append_log(&format!("Could not check peers to auto-connect: {error}"));
                manager.finish_autoconnect_pass(false);
                return Some(false);
            }
        }
    };

    let expected = targets.len();
    let dials = super::peer_connect::dial_startup_peers(data_directory, targets).await;
    let all_connected = dials.len() == expected && dials.iter().all(|dial| dial.status.is_up());

    let state = app.try_state::<AppState>()?;
    let mut manager = state.fnn.lock().await;
    if !manager.is_autoconnect_current(generation, data_directory) {
        return None;
    }
    for dial in &dials {
        manager.log_peer_dial(dial);
    }
    manager.finish_autoconnect_pass(all_connected);
    Some(all_connected)
}

fn same_running_directory(manager: &FnnManager, data_directory: &std::path::Path) -> bool {
    manager
        .data_directory()
        .is_some_and(|path| path == data_directory)
        && matches!(manager.status(), NodeRuntimeStatus::Running { .. })
}

fn short_pubkey(pubkey: &str) -> String {
    let pubkey = pubkey.trim();
    if pubkey.len() <= 16 {
        return pubkey.to_string();
    }
    format!("{}…{}", &pubkey[..8], &pubkey[pubkey.len() - 4..])
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
