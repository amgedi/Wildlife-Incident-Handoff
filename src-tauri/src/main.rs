// Wildlife Incident Handoff — Tauri 2 desktop shell.
// The entire UI is the existing React bundle (frontendDist: ../dist);
// there is no local HTTP server: assets load directly from the bundle.
//
// Plugins: single-instance (second launch focuses the existing window),
// dialog + fs (native Windows save/open dialogs for backups and exports).
// LAN sync (0.2.0-dev.13): optional local-network incident exchange.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lan_sync;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch: focus/restore the existing main window.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .manage(std::sync::Arc::new(lan_sync::LanSyncInner::default()))
        .invoke_handler(tauri::generate_handler![
            lan_sync::lan_sync_start,
            lan_sync::lan_sync_stop,
            lan_sync::lan_sync_set_snapshot,
            lan_sync::lan_sync_take_inbox,
            lan_sync::lan_sync_set_trusted,
            lan_sync::lan_sync_set_pairing_code,
            lan_sync::lan_sync_take_pair_requests,
            lan_sync::lan_sync_pair_peer,
            lan_sync::lan_sync_ping_peer,
            lan_sync::lan_sync_fetch_peer,
            lan_sync::lan_sync_push_peer,
            lan_sync::lan_sync_local_address,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Wildlife Incident Handoff");
}
