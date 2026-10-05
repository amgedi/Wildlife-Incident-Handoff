//! Window geometry memory (0.3.0-dev.5, spec Part II.4).
//!
//! Remembers window width, height, position and maximized state in a small
//! JSON file under the app data directory, restores it on startup, and only
//! restores a position that is still visible on a connected monitor (so a
//! disconnected external screen cannot leave the window stranded off-screen).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::WebviewWindow;

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub struct WindowGeometry {
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub maximized: bool,
}

fn state_path(data_dir: &PathBuf) -> PathBuf {
    data_dir.join("window-geometry.json")
}

/// Monitor bounds in logical pixels: (x, y, width, height).
pub type MonitorBounds = Vec<(f64, f64, f64, f64)>;

/// The restored window must intersect at least one monitor with a usable
/// margin on every edge, and respect the minimum size.
pub fn load_and_validate(data_dir: &PathBuf, monitors: &MonitorBounds) -> Option<WindowGeometry> {
    let text = std::fs::read_to_string(state_path(data_dir)).ok()?;
    let g: WindowGeometry = serde_json::from_str(&text).ok()?;
    if g.width < 1024.0 || g.height < 700.0 {
        return None;
    }
    if !g.maximized {
        let intersects = monitors.iter().any(|(mx, my, mw, mh)| {
            g.x + 120.0 < mx + mw && g.x + g.width - 120.0 > *mx && g.y + 60.0 < my + mh && g.y + g.height - 60.0 > *my
        });
        if !intersects {
            return None;
        }
    }
    Some(g)
}

struct SaveState {
    last: Mutex<Instant>,
    pending: Mutex<Option<WindowGeometry>>,
}

use std::sync::Mutex;
use std::time::Instant;

/// Track resize/move (rate-limited) and close; writes the geometry file.
pub fn install_tracking(window: &WebviewWindow, data_dir: PathBuf) {

    let write_now = |win: &WebviewWindow, dir: &PathBuf| {
        if let Ok(geo) = capture(win) {
            let _ = std::fs::create_dir_all(dir);
            let _ = std::fs::write(state_path(dir), serde_json::to_string(&geo).unwrap_or_default());
        }
    };

    // Debounced saver: a small thread flushes the latest geometry at most
    // ~2×/second while the user drags/resizes, so no per-event disk writes.
    let state = std::sync::Arc::new(SaveState {
        last: Mutex::new(Instant::now()),
        pending: Mutex::new(None),
    });
    let flush_dir = data_dir.clone();
    let state_flush = state.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mut pending = state_flush.pending.lock().unwrap();
        if let Some(g) = pending.take() {
            let _ = std::fs::create_dir_all(&flush_dir);
            let _ = std::fs::write(state_path(&flush_dir), serde_json::to_string(&g).unwrap_or_default());
        }
    });

    let win = window.clone();
    let st = state.clone();
    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
            let mut last = st.last.lock().unwrap();
            if last.elapsed() >= std::time::Duration::from_millis(400) {
                *last = Instant::now();
                if let Ok(geo) = capture(&win) {
                    *st.pending.lock().unwrap() = Some(geo);
                }
            }
        }
        tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
            write_now(&win, &data_dir);
        }
        _ => {}
    });
}

fn capture(window: &WebviewWindow) -> Result<WindowGeometry, String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok(WindowGeometry {
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        maximized: window.is_maximized().unwrap_or(false),
    })
}
