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
    /// Incoming pairing requests awaiting USER approval (dev.15).
    pub pair_requests: Arc<Mutex<Vec<String>>>,
    /// Device ids allowed to read/write /wih/sync (dev.15).
    pub trusted: Arc<Mutex<Vec<String>>>,
    /// Current pairing code shown on this device (dev.15).
    pub pairing_code: Arc<Mutex<String>>,
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
    let pair_requests = state.pair_requests.clone();
    let trusted = state.trusted.clone();
    let pairing_code = state.pairing_code.clone();
    let mut request_log: Vec<std::time::Instant> = Vec::new();
    std::thread::spawn(move || {
        let server = match Server::http(("0.0.0.0", port)) {
            Ok(s) => s,
            Err(_) => return,
        };
        for mut request in server.incoming_requests() {
            if rx.try_recv().is_ok() {
                break;
            }
            // Rate limit: reject bursts instead of saturating the device (dev.15).
            let now = std::time::Instant::now();
            request_log.retain(|t| now.duration_since(*t).as_secs() < 60);
            if request_log.len() >= 60 {
                let _ = request.respond(Response::from_string("{\"ok\":false,\"error\":\"rate-limited\"}".to_string()).with_status_code(429).with_header(json_header()));
                continue;
            }
            request_log.push(now);
            let method = request.method().clone();
            let url = request.url().to_string();
            let device_header = request
                .headers()
                .iter()
                .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case("x-wih-device"))
                .map(|h| h.value.as_str().to_string())
                .unwrap_or_default();
            let mut body = String::new();
            if method == Method::Post {
                let mut limited = request.as_reader().take((8 * 1024 * 1024 + 1) as u64);
                if limited.read_to_string(&mut body).is_err() || body.len() > 8 * 1024 * 1024 {
                    let _ = request.respond(Response::from_string("{\"ok\":false,\"error\":\"body-too-large\"}".to_string()).with_status_code(413).with_header(json_header()));
                    continue;
                }
            }
            let path = url.split('?').next().unwrap_or("").to_string();
            let reply = |request: tiny_http::Request, status: u16, payload: String| {
                let _ = request.respond(Response::from_string(payload).with_status_code(status).with_header(json_header()));
            };
            let trusted_ok = |device_id: &str| -> bool {
                !device_id.is_empty() && trusted.lock().map(|t| t.iter().any(|id| id == device_id)).unwrap_or(false)
            };
            match (method, path.as_str()) {
                (Method::Get, "/wih/ping") => reply(request, 200, ack()),
                (Method::Post, "/wih/pair") => {
                    // Pairing requests queue for USER approval — never auto-trusted (P10/P53).
                    let expected = pairing_code.lock().map(|g| g.clone()).unwrap_or_default();
                    let code_ok = !expected.is_empty()
                        && serde_json::from_str::<PairRequestBody>(&body)
                            .map(|p| p.code == expected)
                            .unwrap_or(false);
                    if code_ok {
                        if let Ok(mut q) = pair_requests.lock() {
                            q.push(body);
                        }
                        reply(request, 200, ack());
                    } else {
                        reply(request, 403, "{\"ok\":false,\"error\":\"bad-code\"}".into());
                    }
                }
                (Method::Get, "/wih/sync") => {
                    if !trusted_ok(&device_header) {
                        reply(request, 403, "{\"ok\":false,\"error\":\"untrusted-device\"}".into());
                        continue;
                    }
                    let snap = snapshot.lock().map(|g| g.clone()).unwrap_or_else(|_| "{}".into());
                    reply(request, 200, snap);
                }
                (Method::Post, "/wih/sync") => {
                    if !trusted_ok(&device_header) {
                        reply(request, 403, "{\"ok\":false,\"error\":\"untrusted-device\"}".into());
                        continue;
                    }
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

#[derive(Serialize, Deserialize)]
struct PairRequestBody {
    #[serde(default)]
    deviceId: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    code: String,
}

#[tauri::command]
pub fn lan_sync_set_trusted(state: State<LanSyncManaged>, device_ids: Vec<String>) -> String {
    if let Ok(mut t) = state.trusted.lock() {
        *t = device_ids;
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_set_pairing_code(state: State<LanSyncManaged>, code: String) -> String {
    if let Ok(mut c) = state.pairing_code.lock() {
        *c = code;
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_take_pair_requests(state: State<LanSyncManaged>) -> Vec<String> {
    state.pair_requests.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

#[tauri::command]
pub fn lan_sync_pair_peer(url: String, device_id: String, name: String, code: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let payload = serde_json::json!({ "deviceId": device_id, "name": name, "code": code }).to_string();
    let res = ureq::post(&format!("{}/wih/pair", base))
        .timeout(std::time::Duration::from_secs(6))
        .send_string(&payload)
        .map_err(|e| e.to_string())?;
    let mut out = String::new();
    res.into_reader().read_to_string(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
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
pub fn lan_sync_fetch_peer(url: String, device_id: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::get(&format!("{}/wih/sync", base))
        .set("X-WIH-Device", &device_id)
        .timeout(std::time::Duration::from_secs(8))
        .call()
        .map_err(|e| e.to_string())?;
    let mut body = String::new();
    res.into_reader().read_to_string(&mut body).map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub fn lan_sync_push_peer(url: String, device_id: String, body: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::post(&format!("{}/wih/sync", base))
        .set("X-WIH-Device", &device_id)
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
