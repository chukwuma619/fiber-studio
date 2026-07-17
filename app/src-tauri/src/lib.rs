mod commands;
mod fnn;
mod state;

use tauri::Manager;

use crate::state::AppState;

#[cfg(desktop)]
fn autostart_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    #[cfg(target_os = "macos")]
    {
        use tauri_plugin_autostart::MacosLauncher;
        tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None)
    }
    #[cfg(not(target_os = "macos"))]
    {
        tauri_plugin_autostart::init(tauri_plugin_autostart::Launcher::default(), None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(autostart_plugin());
    }

    builder
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
            commands::network::add_saved_peer,
            commands::network::remove_saved_peer,
            commands::network::connect_saved_peer,
            commands::network::disconnect_peer,
            commands::network::get_network_graph,
            commands::payments::get_payments_page,
            commands::payments::create_invoice,
            commands::payments::preview_send_payment,
            commands::payments::parse_invoice_preview,
            commands::payments::send_payment,
            commands::payments::preview_keysend_payment,
            commands::payments::send_keysend_payment,
            commands::payments::get_payment,
            commands::payments::cancel_invoice,
            commands::payments::load_more_payments,
            commands::payments::import_invoice,
            commands::settings::get_node_settings,
            commands::settings::open_config_file,
            commands::settings::open_data_directory,
            commands::settings::update_wallet_password,
            commands::settings::switch_network,
            commands::settings::is_network_provisioned,
            commands::settings::migrate_legacy_data_directory,
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
