use tokio::sync::Mutex;

use crate::fnn::graph_index::GraphIndex;
use crate::fnn::manager::FnnManager;

pub struct AppState {
    pub fnn: Mutex<FnnManager>,
    pub graph_index: Mutex<Option<GraphIndex>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            fnn: Mutex::new(FnnManager::default()),
            graph_index: Mutex::new(None),
        }
    }
}
