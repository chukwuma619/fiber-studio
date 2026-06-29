mod commands;
mod fnn;
mod state;

use tauri::Manager;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            app.manage(AppState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::setup::complete_setup,
            commands::node::get_node_status,
            commands::node::get_node_logs,
            commands::node::start_node,
            commands::node::stop_node,
            commands::dashboard::get_home_dashboard,
            commands::channels::get_channels_page,
            commands::channels::get_wallet_balance,
            commands::channels::open_channel,
            commands::channels::shutdown_channel,
            commands::channels::abandon_channel,
            commands::network::get_network_page,
            commands::network::connect_peer,
            commands::network::set_configured_peer,
            commands::wallet::get_wallet_page,
            commands::wallet::create_invoice,
            commands::wallet::preview_send_payment,
            commands::wallet::parse_invoice_preview,
            commands::wallet::send_payment,
            commands::wallet::preview_keysend_payment,
            commands::wallet::send_keysend_payment,
            commands::wallet::get_payment,
            commands::wallet::cancel_invoice,
            commands::wallet::load_more_wallet_payments,
            commands::wallet::import_invoice,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    tauri::async_runtime::block_on(async {
                        let mut manager = state.fnn.lock().await;
                        let _ = manager.stop_managed();
                    });
                }
            }
        });
}
