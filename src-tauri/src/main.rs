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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(std::sync::Arc::new(lan_sync::LanSyncInner::default()))
        .manage(PendingUpdate::default())
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
            check_app_update,
            install_app_update,
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

// ---------- RC2: signed in-app updates (Tauri updater plugin) ----------
// Release channel comes from the shared launcher prefs (default: tester for
// RC versions). Endpoints point at GitHub release update manifests. The
// downloaded artifact's minisign signature is ALWAYS verified by the plugin;
// signature verification is never disabled.

use tauri_plugin_updater::UpdaterExt;

#[derive(Default)]
struct PendingUpdate(std::sync::Mutex<Option<tauri_plugin_updater::Update>>);

fn release_channel() -> String {
    let appdata = std::env::var("APPDATA").ok();
    let v = appdata
        .map(|d| std::path::PathBuf::from(d).join("org.wildlifeincidenthandoff.app").join("launcher-prefs.json"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("channel").and_then(|c| c.as_str()).map(String::from));
    v.unwrap_or_else(|| "tester".into())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    status: String, // up-to-date | available | offline | unavailable | error
    channel: String,
    current_version: String,
    latest_version: Option<String>,
    notes: Option<String>,
}

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<AppUpdateInfo, String> {
    use tauri::Manager;
    let channel = release_channel();
    let endpoint = if channel == "stable" {
        "https://github.com/amgedi/Wildlife-Incident-Handoff/releases/latest/download/latest.json"
    } else {
        "https://github.com/amgedi/Wildlife-Incident-Handoff/releases/latest/download/tester.json"
    };
    let current = app.package_info().version.to_string();
    let endpoints: Vec<url::Url> = vec![endpoint.parse().map_err(|e| format!("endpoint: {e}"))?];
    let updater = app
        .updater_builder()
        .endpoints(endpoints)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    let update = updater.check().await;
    match update {
        Ok(Some(u)) => {
            let info = AppUpdateInfo {
                status: "available".into(),
                channel,
                current_version: current,
                latest_version: Some(u.version.clone()),
                notes: u.body.clone(),
            };
            let state = app.state::<PendingUpdate>();
            *state.0.lock().unwrap() = Some(u);
            Ok(info)
        }
        Ok(None) => Ok(AppUpdateInfo {
            status: "up-to-date".into(),
            channel,
            current_version: current,
            latest_version: None,
            notes: None,
        }),
        Err(e) => {
            let msg = e.to_string().to_lowercase();
            let status = if msg.contains("network") || msg.contains("connection") || msg.contains("timed out") || msg.contains("dns") {
                "offline"
            } else {
                "error"
            };
            Ok(AppUpdateInfo {
                status: status.into(),
                channel,
                current_version: current,
                latest_version: None,
                notes: Some(e.to_string()),
            })
        }
    }
}

/// Download + verify + stage the update, then relaunch to install.
/// The plugin verifies the minisign signature during download — this cannot
/// be bypassed from here.
#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let update = {
        let taken = {
            let state = app.state::<PendingUpdate>();
            let mut guard = state.0.lock().unwrap();
            guard.take()
        };
        taken
    };
    let Some(update) = update else { return Err("No pending update — check first.".into()) };
    let downloaded = update
        .download(
            |chunk, _total| {
                let _ = chunk;
            },
            || {},
        )
        .await
        .map_err(|e| format!("download failed: {e}"))?;
    update.install(&downloaded).map_err(|e| format!("install failed: {e}"))?;
    app.restart();
}

