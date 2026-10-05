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
mod window_geometry;

/// 0.3.0-dev.5 (spec 112): share the visual preference with the native
/// launcher (launcher-theme.json in the shared app config dir). Only the
/// theme id is stored — never incident data.
#[tauri::command]
fn write_launcher_theme(theme: String, motion: String, material: String) -> Result<(), String> {
    let dir = app_data_config_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let payload = serde_json::json!({ "theme": theme, "motion": motion, "material": material });
    std::fs::write(dir.join("launcher-theme.json"), payload.to_string()).map_err(|e| e.to_string())
}

fn app_data_config_dir() -> Result<std::path::PathBuf, String> {
    // Matches the launcher's own lookup: %APPDATA%\org.wildlifeincidenthandoff.app
    let appdata = std::env::var("APPDATA").map_err(|_| "no APPDATA".to_string())?;
    Ok(std::path::PathBuf::from(appdata).join("org.wildlifeincidenthandoff.app"))
}

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
            // 0.3.0-dev.5 Part II: restore the remembered window geometry
            // (size/position/maximized) when it is still visible on some
            // monitor; otherwise fall back to the sane default.
            let monitors: window_geometry::MonitorBounds = app
                .available_monitors()
                .map(|ms| {
                    ms.iter()
                        .map(|m| {
                            let sz = m.size();
                            let ps = m.position();
                            let sf = m.scale_factor();
                            ((ps.x as f64) / sf, (ps.y as f64) / sf, (sz.width as f64) / sf, (sz.height as f64) / sf)
                        })
                        .collect()
                })
                .unwrap_or_default();
            let restored = window_geometry::load_and_validate(&data_dir, &monitors);
            let mut builder = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Wildlife Incident Handoff")
                .inner_size(1180.0, 760.0)
                // Minimum usable workstation size (spec: nothing below it may
                // break navigation, titlebar, dialogs or map controls).
                .min_inner_size(1024.0, 700.0)
                .decorations(false);
            builder = match &restored {
                Some(g) if g.maximized => builder.maximized(true),
                Some(g) => builder.inner_size(g.width, g.height).position(g.x, g.y),
                None => builder.center(),
            };
            let window = match &profile {
                Some(p) => {
                    let dir = data_dir.join(p);
                    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                    builder.data_directory(dir)
                }
                None => builder,
            };
            let win = window.build()?;
            window_geometry::install_tracking(&win, data_dir);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            write_launcher_theme,
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
