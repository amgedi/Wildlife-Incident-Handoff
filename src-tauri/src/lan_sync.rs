// LAN sync (0.2.0-dev.13) — local-network incident exchange between devices
// running Wildlife Incident Handoff. No internet, no cloud: a tiny HTTP
// server per device (tiny_http) plus a blocking HTTP client (ureq) so the
// webview never has to touch cross-origin LAN addresses (CSP and
// mixed-content rules stay intact).
//
// Protocol (v1, plain JSON):
//   GET  /wih/ping  -> {"ok":true,"app":"wildlife-incident-handoff/1"}
//   GET  /wih/sync  -> snapshot JSON of this device's incidents
//   POST /wih/sync  -> body is the peer's snapshot; stored in an inbox
//
// The frontend pushes a fresh snapshot whenever records change, drains the
// inbox, and merges by id with last-writer-wins on updatedAt.
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::net::UdpSocket;
use std::sync::{Arc, Mutex};
use tauri::State;
use tiny_http::{Header, Method, Response, Server};

const APP_TAG: &str = "wildlife-incident-handoff/1";

#[derive(Default)]
pub struct LanSyncInner {
    /// JSON snapshot this device serves to peers (updated by the frontend).
    pub snapshot: Arc<Mutex<String>>,
    /// Snapshots pushed by peers, waiting for the frontend to drain.
    pub inbox: Arc<Mutex<Vec<String>>>,
    /// Sender used to stop the listener thread.
    pub shutdown: Arc<Mutex<Option<std::sync::mpsc::Sender<()>>>>,
}

pub type LanSyncManaged = Arc<LanSyncInner>;

fn json_header() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap()
}

fn ack() -> String {
    serde_json::to_string(&SyncAck { ok: true, app: APP_TAG.into() }).unwrap_or_default()
}

#[derive(Serialize, Deserialize)]
struct SyncAck {
    ok: bool,
    app: String,
}

#[tauri::command]
pub fn lan_sync_start(state: State<LanSyncManaged>, port: u16) -> Result<String, String> {
    // Stop any running listener first.
    if let Ok(mut guard) = state.shutdown.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    let snapshot = state.snapshot.clone();
    let inbox = state.inbox.clone();
    std::thread::spawn(move || {
        let server = match Server::http(("0.0.0.0", port)) {
            Ok(s) => s,
            Err(_) => return,
        };
        for mut request in server.incoming_requests() {
            if rx.try_recv().is_ok() {
                break;
            }
            let method = request.method().clone();
            let url = request.url().to_string();
            let mut body = String::new();
            if method == Method::Post {
                let _ = request.as_reader().read_to_string(&mut body);
            }
            let path = url.split('?').next().unwrap_or("").to_string();
            let reply = |request: tiny_http::Request, status: u16, payload: String| {
                let _ = request.respond(Response::from_string(payload).with_status_code(status).with_header(json_header()));
            };
            match (method, path.as_str()) {
                (Method::Get, "/wih/ping") => reply(request, 200, ack()),
                (Method::Get, "/wih/sync") => {
                    let snap = snapshot.lock().map(|g| g.clone()).unwrap_or_else(|_| "{}".into());
                    reply(request, 200, snap);
                }
                (Method::Post, "/wih/sync") => {
                    if let Ok(mut q) = inbox.lock() {
                        q.push(body);
                    }
                    reply(request, 200, ack());
                }
                _ => reply(request, 404, "{}".into()),
            }
        }
    });
    if let Ok(mut guard) = state.shutdown.lock() {
        *guard = Some(tx);
    }
    Ok("started".into())
}

#[tauri::command]
pub fn lan_sync_stop(state: State<LanSyncManaged>) -> String {
    if let Ok(mut guard) = state.shutdown.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }
    "stopped".into()
}

#[tauri::command]
pub fn lan_sync_set_snapshot(state: State<LanSyncManaged>, snapshot: String) -> String {
    if let Ok(mut g) = state.snapshot.lock() {
        *g = snapshot;
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_take_inbox(state: State<LanSyncManaged>) -> Vec<String> {
    state.inbox.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

#[tauri::command]
pub fn lan_sync_ping_peer(url: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::get(&format!("{}/wih/ping", base))
        .timeout(std::time::Duration::from_secs(4))
        .call()
        .map_err(|e| e.to_string())?;
    let mut body = String::new();
    res.into_reader().read_to_string(&mut body).map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub fn lan_sync_fetch_peer(url: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::get(&format!("{}/wih/sync", base))
        .timeout(std::time::Duration::from_secs(8))
        .call()
        .map_err(|e| e.to_string())?;
    let mut body = String::new();
    res.into_reader().read_to_string(&mut body).map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub fn lan_sync_push_peer(url: String, body: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::post(&format!("{}/wih/sync", base))
        .timeout(std::time::Duration::from_secs(12))
        .send_string(&body)
        .map_err(|e| e.to_string())?;
    let mut out = String::new();
    res.into_reader().read_to_string(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

#[tauri::command]
pub fn lan_sync_local_address(port: u16) -> String {
    // Best-effort primary LAN address: a UDP "connect" picks the outbound
    // interface without sending packets.
    let ip = UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("10.254.254.254:1")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into());
    format!("http://{}:{}", ip, port)
}
