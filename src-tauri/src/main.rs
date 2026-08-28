// Trova IMS desktop shell.
//
// Two run modes:
//   - `tauri dev`: Tauri starts `npm run dev` and points the window at
//     http://localhost:3000 directly. This file does nothing extra beyond
//     single-instance handling.
//   - Packaged app: spawns the bundled .next/standalone/server.js, polls
//     its desktop health endpoint, then navigates away from the splash.
//
// Process lifecycle: the spawned Node server is tracked in managed state
// and explicitly killed when the app exits (RunEvent::ExitRequested). The
// single-instance plugin additionally guarantees only one copy of the app
// — and therefore only one server — can ever be running at once. Together
// these prevent orphaned Node processes from a previous session squatting
// on SERVER_PORT and silently answering requests with stale, un-updated
// code the next time the app launches.

use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Manager, Url};

/// Fixed local port for the bundled Next.js server.
///
/// IMPORTANT: this must stay in sync with the `remote.urls` entry in
/// src-tauri/capabilities/default.json — Tauri only grants IPC access
/// (window.isTauri, invoke(), etc.) to origins explicitly listed there.
/// If this port changes, that file needs the matching update or the
/// frontend's Tauri detection silently breaks.
const SERVER_PORT: u16 = 47821;
const STARTUP_ATTEMPTS: u16 = 200;
const STARTUP_POLL_MS: u64 = 150;

struct HealthStatus {
    healthy: bool,
    status_line: String,
    body: String,
}

/// Holds the spawned Node server so it can be killed on app exit instead
/// of being left as an orphaned background process.
struct ServerProcess(Mutex<Option<Child>>);

/// Replace older native app processes before the single-instance plugin runs.
/// This is intentionally scoped to the Trova IMS executable name so an update
/// can recover from an older build without touching unrelated applications.
#[cfg(windows)]
fn terminate_previous_instances() {
    let current_pid = std::process::id();
    let output = match Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq trova-ims.exe", "/FO", "CSV", "/NH"])
        .output()
    {
        Ok(output) => output,
        Err(err) => {
            eprintln!("[trova-ims] Could not inspect previous instances: {err}");
            return;
        }
    };

    let processes = String::from_utf8_lossy(&output.stdout);
    for line in processes.lines() {
        let Some(pid_text) = line.split(',').nth(1) else {
            continue;
        };
        let pid_text = pid_text.trim_matches('"');
        let Ok(pid) = pid_text.parse::<u32>() else {
            continue;
        };
        if pid == current_pid {
            continue;
        }

        eprintln!("[trova-ims] Replacing previous app instance (pid {pid})");
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }

    // Give Windows a moment to release the old WebView and local server port
    // before the new instance initializes its Tauri single-instance mutex.
    thread::sleep(Duration::from_millis(150));
}

#[cfg(not(windows))]
fn terminate_previous_instances() {
    let current_pid = std::process::id().to_string();
    let output = match Command::new("pgrep").args(["-x", "trova-ims"]).output() {
        Ok(output) => output,
        Err(_) => return,
    };

    for pid_text in String::from_utf8_lossy(&output.stdout).lines() {
        let pid_text = pid_text.trim();
        if pid_text.is_empty() || pid_text == current_pid {
            continue;
        }
        let Ok(pid) = pid_text.parse::<u32>() else {
            continue;
        };

        eprintln!("[trova-ims] Replacing previous app instance (pid {pid})");
        let _ = Command::new("kill").args(["-TERM", pid_text]).output();
    }

    thread::sleep(Duration::from_millis(150));
}

/// Locate the bundled Node.js binary when one exists, otherwise use the
/// system installation. Lean packages intentionally rely on the user's
/// existing Node.js installation instead of shipping another copy.
fn find_node(resource_dir: &std::path::Path) -> String {
    let bundled = resource_dir
        .join("node-runtime")
        .join(if cfg!(target_os = "windows") {
            "node.exe"
        } else {
            "bin/node"
        });
    if bundled.exists() {
        return bundled.to_string_lossy().into_owned();
    }

    // Locate Node independently of the inherited PATH. This is used by lean
    // release installers, which intentionally do not contain a Node runtime.
    #[cfg(target_os = "windows")]
    let (search_bin, search_arg) = ("where.exe", "node");
    #[cfg(not(target_os = "windows"))]
    let (search_bin, search_arg) = ("which", "node");

    Command::new(search_bin)
        .arg(search_arg)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout)
                    .ok()
                    .map(|s| s.lines().next().unwrap_or("node").trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "node".to_string())
}

/// Strip the Windows `\\?\` verbatim UNC prefix from a path.
///
/// Tauri's path APIs return verbatim UNC paths on Windows when the install
/// path contains spaces (e.g. `C:\Program Files\Trova IMS`). Node.js does
/// not handle this prefix and fails to open files, so we strip it before
/// passing paths to Node.
fn strip_verbatim_prefix(path: &std::path::Path) -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        let s = path.to_string_lossy();
        if s.starts_with(r"\\?\") {
            return std::path::PathBuf::from(&s[4..]);
        }
    }
    path.to_path_buf()
}

fn local_server_request(path: &str) -> Result<HealthStatus, String> {
    let mut stream = TcpStream::connect(("127.0.0.1", SERVER_PORT))
        .map_err(|err| format!("could not connect to local server: {err}"))?;
    let timeout = Some(Duration::from_secs(2));
    let _ = stream.set_read_timeout(timeout);
    let _ = stream.set_write_timeout(timeout);

    let request = format!(
        "GET {path} HTTP/1.1\r\n\
         Host: 127.0.0.1:{SERVER_PORT}\r\n\
         Accept: application/json\r\n\
         Connection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|err| format!("could not write health request: {err}"))?;

    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|err| format!("could not read health response: {err}"))?;

    let response = String::from_utf8_lossy(&response);
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .unwrap_or_else(|| (response.as_ref(), ""));
    let status_line = headers.lines().next().unwrap_or("").to_string();
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok());

    let expected_version = format!("\"version\":\"{}\"", env!("CARGO_PKG_VERSION"));
    let healthy =
        status == Some(200) && body.contains("\"ok\":true") && body.contains(&expected_version);

    Ok(HealthStatus {
        healthy,
        status_line,
        body: body.trim().to_string(),
    })
}

fn show_startup_error(handle: &tauri::AppHandle, message: &str, log_path: &Path) {
    let message = serde_json::to_string(message)
        .unwrap_or_else(|_| "\"Trova IMS could not start.\"".to_string());
    let log_path = serde_json::to_string(&log_path.display().to_string())
        .unwrap_or_else(|_| "\"server.log\"".to_string());
    let script = format!(
        r#"
        (() => {{
          const message = {message};
          const logPath = {log_path};
          const render = () => {{
            if (window.trovaStartupError) {{
              window.trovaStartupError(message, logPath);
              return;
            }}
            const wrap = document.querySelector('.wrap') || document.body;
            if (!wrap) return;
            wrap.classList?.add('error');
            wrap.innerHTML = '<h1>Trova IMS could not start</h1><p class="message"></p><div class="log"></div>';
            wrap.querySelector('.message').textContent = message;
            wrap.querySelector('.log').textContent = 'Server log: ' + logPath;
          }};
          if (document.readyState === 'loading') {{
            document.addEventListener('DOMContentLoaded', render, {{ once: true }});
          }} else {{
            render();
          }}
        }})();
        "#
    );

    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.eval(script);
    }
}

fn spawn_local_server(
    resource_dir: &std::path::Path,
    data_dir: &std::path::Path,
    log_path: &std::path::Path,
) -> std::io::Result<Child> {
    let standalone_dir = strip_verbatim_prefix(&resource_dir.join("standalone"));
    let server_js = standalone_dir.join("server.js");
    let data_dir = strip_verbatim_prefix(data_dir);
    let node_bin = find_node(resource_dir);

    eprintln!("[trova-ims] node binary:   {node_bin}");
    eprintln!("[trova-ims] server script: {}", server_js.display());
    eprintln!("[trova-ims] data dir:      {}", data_dir.display());
    eprintln!("[trova-ims] server log:    {}", log_path.display());

    if !server_js.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!(
                "server.js not found at {}. The standalone bundle may be missing from the installer.",
                server_js.display()
            ),
        ));
    }

    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;
    let log_clone = log_file.try_clone()?;

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&server_js)
        .current_dir(&standalone_dir)
        .env("PORT", SERVER_PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("DESKTOP_MODE", "true")
        .env("TROVA_DATA_DIR", &data_dir)
        .env("TROVA_DESKTOP_VERSION", env!("CARGO_PKG_VERSION"))
        .env("BETTER_AUTH_SECRET", "desktop-mode-not-used")
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_clone));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
}

/// Kill the tracked server process, if any. Called on app exit.
fn kill_server(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<ServerProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                eprintln!(
                    "[trova-ims] Shutting down local server (pid {})",
                    child.id()
                );
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    // Windows may terminate the Node child without allowing Node's exit
    // handlers to run. Remove the app-specific lock after the child has
    // exited so the next launch can start normally.
    if let Ok(data_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(data_dir.join("trova.db.lock"));
    }
}

fn main() {
    terminate_previous_instances();

    let mut builder = tauri::Builder::default().manage(ServerProcess(Mutex::new(None)));

    // Keep the plugin as a final race guard. Startup replacement above handles
    // normal upgrades/relaunches; this prevents two new copies from starting
    // simultaneously after both inspect the process list.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
        builder = builder.plugin(tauri_plugin_thermal_printer::init());
    }

    let app = builder
        .setup(|app| {
            if tauri::is_dev() {
                return Ok(());
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource directory");

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");

            std::fs::create_dir_all(&data_dir).expect("failed to create app data directory");

            let log_path = data_dir.join("server.log");

            match spawn_local_server(&resource_dir, &data_dir, &log_path) {
                Err(err) => {
                    eprintln!("[trova-ims] Failed to start local server: {err}");
                    show_startup_error(
                        app.handle(),
                        &format!("The local desktop server could not start: {err}"),
                        &log_path,
                    );
                    return Ok(());
                }
                Ok(child) => {
                    *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
                }
            }

            let handle = app.handle().clone();
            let startup_log_path = log_path.clone();
            thread::spawn(move || {
                let mut last_probe = String::from("health endpoint did not respond");
                for attempt in 0..STARTUP_ATTEMPTS {
                    match local_server_request("/api/desktop/health") {
                        Ok(status) if status.healthy => {
                            eprintln!(
                                "[trova-ims] Server health ready after ~{}ms.",
                                attempt as u64 * STARTUP_POLL_MS
                            );
                            if let Some(window) = handle.get_webview_window("main") {
                                let url = Url::parse(&format!(
                                    "http://127.0.0.1:{SERVER_PORT}/dashboard"
                                ))
                                .expect("invalid local server URL");
                                let _ = window.navigate(url);
                            }
                            return;
                        }
                        Ok(status) => {
                            last_probe = format!("{} {}", status.status_line, status.body);
                        }
                        Err(err) => {
                            last_probe = err;
                        }
                    }
                    thread::sleep(Duration::from_millis(STARTUP_POLL_MS));
                }

                let message =
                    format!("Trova IMS could not finish starting. Last health check: {last_probe}");
                eprintln!(
                    "[trova-ims] Server did not become healthy on port {SERVER_PORT} within 30 s.\n\
                     Check the server log at {} for the exact error.\n\
                     {message}",
                    startup_log_path.display()
                );
                show_startup_error(&handle, &message, &startup_log_path);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Trova IMS");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            kill_server(app_handle);
        }
    });
}
