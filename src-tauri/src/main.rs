// Wildlife Incident Handoff — Tauri 2 desktop shell.
// The entire UI is the existing React bundle (frontendDist: ../dist);
// there is no local HTTP server: assets load directly from the bundle.
//
// Plugins: single-instance (second launch focuses the existing window),
// dialog + fs (native Windows save/open dialogs for backups and exports).
// LAN sync (0.2.0-dev.13): optional local-network incident exchange.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lan_crypto;
mod lan_sync;

fn main() {
    // Multi-profile support (0.2.0-dev.19): launching with WIH_PROFILE=<name>
    // gives that instance its own app-data directory (identity, trust store,
    // WebView2 data). Used for two-instance sync QA and for running several
    // real profiles side by side. The single-instance plugin is skipped for
    // named profiles so two instances can actually run.
    let profile = std::env::var("WIH_PROFILE").ok().filter(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    let builder = tauri::Builder::default();
    let builder = if profile.is_some() {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch: focus/restore the existing main window.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
    };
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .manage(std::sync::Arc::new(lan_sync::LanSyncInner::default()))
        .setup(move |app| {
            use tauri::Manager;
            // The main window is created here (not in tauri.conf.json) so a
            // named profile can redirect the WebView2 user-data directory.
            let data_dir = app.path().app_data_dir()?;
            let window = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Wildlife Incident Handoff")
                .inner_size(1180.0, 760.0)
                .min_inner_size(420.0, 560.0)
                .center()
                .decorations(false);
            let window = match &profile {
                Some(p) => {
                    let dir = data_dir.join(p);
                    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                    window.data_directory(dir)
                }
                None => window,
            };
            window.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            lan_sync::lan_sync_start,
            lan_sync::lan_sync_stop,
            lan_sync::lan_sync_set_snapshot,
            lan_sync::lan_sync_take_inbox,
            lan_sync::lan_sync_identity,
            lan_sync::lan_sync_ensure_identity,
            lan_sync::lan_sync_new_pairing_code,
            lan_sync::lan_sync_close_pairing,
            lan_sync::lan_sync_take_pair_requests,
            lan_sync::lan_sync_approve_pair,
            lan_sync::lan_sync_deny_pair,
            lan_sync::lan_sync_trusted,
            lan_sync::lan_sync_revoke,
            lan_sync::lan_sync_pair_peer,
            lan_sync::lan_sync_exchange,
            lan_sync::lan_sync_ping_peer,
            lan_sync::lan_sync_local_address,
            lan_sync::lan_sync_fingerprint_valid,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Wildlife Incident Handoff");
}
