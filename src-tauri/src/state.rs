use tokio::sync::Mutex;

use crate::fnn::manager::FnnManager;

pub struct AppState {
    pub fnn: Mutex<FnnManager>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            fnn: Mutex::new(FnnManager::default()),
        }
    }
}
