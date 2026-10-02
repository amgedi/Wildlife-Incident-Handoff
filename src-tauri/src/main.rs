// Wildlife Incident Handoff — Tauri 2 desktop shell.
// The entire UI is the existing React bundle (frontendDist: ../dist);
// there is no local HTTP server: assets load directly from the bundle.
//
// Plugins: single-instance (second launch focuses the existing window),
// dialog + fs (native Windows save/open dialogs for backups and exports).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("failed to start Wildlife Incident Handoff");
}
