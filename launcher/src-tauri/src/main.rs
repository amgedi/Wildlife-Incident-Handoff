// Wildlife Incident Handoff Launcher (0.3.0-dev.5, spec Part XVII/XVIII).
//
// A real native launcher for the local project/development workspace. It
// answers: which build do I open, is the desktop build stale, do I need to
// compile, is there an update, which version/commit am I launching?
//
// Design contract:
// - One canonical build pipeline: auto-compile runs `npm run desktop:release`
//   in the detected workspace root. No second build pipeline is invented.
// - Never silently installs remote binaries. "Check for updates" only reads
//   the git remote and reports; it never pulls over a dirty working tree.
// - No visible terminal window: build output is captured and shown in the UI.
// - Theme is read from the shared visual config (launcher-theme.json) written
//   by the application; Forest Night is the fallback.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

#[derive(Clone)]
struct BuildState {
    running: std::sync::Arc<Mutex<bool>>,
    lines: std::sync::Arc<Mutex<Vec<String>>>,
    stage: std::sync::Arc<Mutex<String>>,
    done: std::sync::Arc<Mutex<Option<bool>>>,
}

fn main() {
    tauri::Builder::default()
        .manage(BuildState {
            running: std::sync::Arc::new(Mutex::new(false)),
            lines: std::sync::Arc::new(Mutex::new(Vec::new())),
            stage: std::sync::Arc::new(Mutex::new(String::new())),
            done: std::sync::Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            get_identity,
            launch_app,
            launch_web,
            build_app,
            get_build_status,
            check_updates,
            get_theme,
            set_theme,
        ])
        .run(tauri::generate_context!())
        .expect("launcher failed to start");
}

/// Locate the project workspace root: the nearest ancestor (starting from the
/// launcher's own directory) that has package.json + src-tauri + src.
fn find_root() -> Option<PathBuf> {
    let start = std::env::current_exe().ok()?.parent().map(|p| p.to_path_buf())?;
    let mut dir: Option<&Path> = Some(start.as_path());
    while let Some(d) = dir {
        if d.join("package.json").is_file() && d.join("src-tauri").is_dir() && d.join("src").is_dir() {
            return Some(d.to_path_buf());
        }
        dir = d.parent();
    }
    None
}

fn read_version(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(root.join("package.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    v.get("version")?.as_str().map(String::from)
}

fn git(root: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() && !s.is_empty() {
        Some(s)
    } else {
        None
    }
}

fn frontend_build_id(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(root.join("src").join("build-identity.ts")).ok()?;
    text.split("FRONTEND_BUILD_ID = \"")
        .nth(1)?
        .split('"')
        .next()
        .map(String::from)
}

/// The current packaged desktop build: prefer release/current/manifest.json,
/// else the newest portable EXE in release/desktop (name-encoded version).
fn desktop_release(root: &Path) -> Option<DesktopInfo> {
    let manifest_path = root.join("release").join("current").join("manifest.json");
    if let Ok(text) = std::fs::read_to_string(&manifest_path) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
            return Some(DesktopInfo {
                version: v.get("version")?.as_str()?.to_string(),
                commit: v.get("commit")?.as_str()?.to_string(),
                frontend_build_id: v.get("frontendBuildId")?.as_str()?.to_string(),
                exe: v.get("portable")?.as_str().map(String::from),
            });
        }
    }
    // Fall back to newest Portable-*.exe in release/desktop.
    let dir = root.join("release").join("desktop");
    let mut best: Option<(std::time::SystemTime, PathBuf, String)> = None;
    let entries = std::fs::read_dir(&dir).ok()?;
    for e in entries.flatten() {
        let p = e.path();
        let name = p.file_name()?.to_string_lossy().to_string();
        if name.starts_with("Wildlife-Incident-Handoff-Portable-") && name.ends_with(".exe") {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?;
            let version = name
                .trim_start_matches("Wildlife-Incident-Handoff-Portable-")
                .trim_end_matches(".exe")
                .to_string();
            if best.as_ref().map(|(t, _, _)| modified > *t).unwrap_or(true) {
                best = Some((modified, p, version));
            }
        }
    }
    let (_, path, version) = best?;
    Some(DesktopInfo {
        version,
        commit: String::new(),
        frontend_build_id: String::new(),
        exe: Some(path.to_string_lossy().to_string()),
    })
}

#[derive(Serialize, Clone)]
struct DesktopInfo {
    version: String,
    commit: String,
    frontend_build_id: String,
    exe: Option<String>,
}

#[derive(Serialize, Clone)]
struct Identity {
    root: String,
    version: String,
    commit: String,
    frontend_build_id: String,
    git_dirty: bool,
    desktop: Option<DesktopInfo>,
    desktop_stale: bool,
}

#[tauri::command]
fn get_identity() -> Result<Identity, String> {
    let root = find_root().ok_or("Wildlife Incident Handoff workspace not found — place the launcher beside the project folder or inside it.")?;
    let version = read_version(&root).unwrap_or_else(|| "?".into());
    let commit = git(&root, &["rev-parse", "--short", "HEAD"]).unwrap_or_else(|| "?".into());
    let build_id = frontend_build_id(&root).unwrap_or_else(|| "?".into());
    let dirty = git(&root, &["status", "--porcelain"])
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    let desktop = desktop_release(&root);
    let desktop_stale = match &desktop {
        Some(d) => !d.commit.is_empty() && d.commit != commit,
        // Without a manifest the best available signal is the version string.
        Some(_) | None => false,
    };
    Ok(Identity {
        root: root.to_string_lossy().to_string(),
        version,
        commit,
        frontend_build_id: build_id,
        git_dirty: dirty,
        desktop_stale,
        desktop,
    })
}

#[tauri::command]
fn launch_app() -> Result<String, String> {
    let root = find_root().ok_or("workspace not found")?;
    let desktop = desktop_release(&root).ok_or("No packaged desktop build found. Use Build to create one.")?;
    let exe = desktop.exe.ok_or("Desktop build manifest has no executable path.")?;
    let path = PathBuf::from(&exe);
    if !path.is_file() {
        return Err(format!("Desktop executable not found: {}", exe));
    }
    Command::new(&path)
        .spawn()
        .map_err(|e| format!("failed to launch: {}", e))?;
    Ok(exe)
}

#[tauri::command]
fn launch_web() -> Result<String, String> {
    let root = find_root().ok_or("workspace not found")?;
    // Web preview: vite dev server in a hidden console window; browser opens separately.
    Command::new("cmd")
        .args(["/C", "start", "", "http://localhost:5173/"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .ok();
    Command::new("cmd")
        .args(["/C", "npm", "run", "dev"])
        .current_dir(&root)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("failed to start web preview: {}", e))?;
    Ok("http://localhost:5173/".into())
}

#[tauri::command]
fn build_app(state: State<'_, BuildState>) -> Result<(), String> {
    let root = find_root().ok_or("workspace not found")?;
    {
        let mut running = state.running.lock().unwrap();
        if *running {
            return Err("A build is already running.".into());
        }
        *running = true;
        *state.done.lock().unwrap() = None;
        state.lines.lock().unwrap().clear();
        *state.stage.lock().unwrap() = "Preparing frontend".into();
    }
    let state = state.inner().clone();
    std::thread::spawn(move || {
        let out = Command::new("cmd")
            .args(["/C", "npm", "run", "desktop:release"])
            .current_dir(&root)
            .creation_flags(0x08000000)
            .output();
        let mut lines = state.lines.lock().unwrap();
        let ok = match out {
            Ok(o) => {
                let text = String::from_utf8_lossy(&o.stdout).to_string();
                for l in text.lines() {
                    if l.starts_with("=== ") {
                        *state.stage.lock().unwrap() = l.trim_matches('=').trim().to_string();
                    }
                    lines.push(l.to_string());
                }
                if !o.stderr.is_empty() {
                    for l in String::from_utf8_lossy(&o.stderr).lines() {
                        lines.push(l.to_string());
                    }
                }
                o.status.success()
            }
            Err(e) => {
                lines.push(format!("build failed to start: {}", e));
                false
            }
        };
        *state.stage.lock().unwrap() = if ok { "Ready.".into() } else { "Build failed".into() };
        *state.done.lock().unwrap() = Some(ok);
        *state.running.lock().unwrap() = false;
    });
    Ok(())
}

#[derive(Serialize, Clone)]
struct BuildStatus {
    running: bool,
    stage: String,
    lines: Vec<String>,
    done: Option<bool>,
}

#[tauri::command]
fn get_build_status(state: State<BuildState>) -> BuildStatus {
    BuildStatus {
        running: *state.running.lock().unwrap(),
        stage: state.stage.lock().unwrap().clone(),
        lines: state.lines.lock().unwrap().iter().rev().take(12).rev().cloned().collect(),
        done: *state.done.lock().unwrap(),
    }
}

#[derive(Serialize, Clone)]
struct UpdateInfo {
    fetch_ok: bool,
    behind: u32,
    dirty_tree: bool,
    detail: String,
}

/// Read-only update check: never pulls, never overwrites local work (spec 99/100).
#[tauri::command]
fn check_updates() -> UpdateInfo {
    let root = match find_root() {
        Some(r) => r,
        None => {
            return UpdateInfo {
                fetch_ok: false,
                behind: 0,
                dirty_tree: false,
                detail: "Workspace not found.".into(),
            }
        }
    };
    let dirty = git(&root, &["status", "--porcelain"]).map(|s| !s.is_empty()).unwrap_or(false);
    let fetched = git(&root, &["fetch", "origin", "--quiet"]).is_some();
    if !fetched {
        return UpdateInfo {
            fetch_ok: false,
            behind: 0,
            dirty_tree: dirty,
            detail: "Could not reach the git remote (offline, or no remote configured).".into(),
        };
    }
    let behind = git(&root, &["rev-list", "--count", "HEAD..origin/main"])
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    let detail = if dirty {
        "Local changes present — nothing was touched. Commit or stash before pulling updates.".into()
    } else if behind > 0 {
        format!("{} update(s) available on origin/main. Pull from your terminal — the launcher never overwrites your working tree.", behind)
    } else {
        "Up to date with origin/main.".into()
    };
    UpdateInfo { fetch_ok: true, behind, dirty_tree: dirty, detail }
}

const THEME_FILE: &str = "launcher-theme.json";

fn theme_path() -> Option<PathBuf> {
    let base = dirs_config()?;
    Some(base.join(THEME_FILE))
}

fn dirs_config() -> Option<PathBuf> {
    // Shared with the main app's data dir (org.wildlifeincidenthandoff.app).
    let appdata = std::env::var("APPDATA").ok()?;
    Some(PathBuf::from(appdata).join("org.wildlifeincidenthandoff.app"))
}

#[derive(Serialize, Clone)]
#[derive(Deserialize)]
struct VisualPref {
    theme: String,
    motion: String,
    material: String,
}

impl Default for VisualPref {
    fn default() -> Self {
        // Spec 111: Forest Night fallback.
        VisualPref { theme: "forest-night".into(), motion: "full".into(), material: "frosted".into() }
    }
}

#[tauri::command]
fn get_theme() -> VisualPref {
    if let Some(p) = theme_path() {
        if let Ok(text) = std::fs::read_to_string(p) {
            if let Ok(v) = serde_json::from_str::<VisualPref>(&text) {
                return v;
            }
        }
    }
    VisualPref::default()
}

#[tauri::command]
fn set_theme(theme: String) -> Result<(), String> {
    let p = theme_path().ok_or("no config dir")?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut pref = VisualPref::default();
    if let Ok(text) = std::fs::read_to_string(&p) {
        if let Ok(v) = serde_json::from_str::<VisualPref>(&text) {
            pref = v;
        }
    }
    pref.theme = theme;
    std::fs::write(&p, serde_json::to_string(&pref).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
