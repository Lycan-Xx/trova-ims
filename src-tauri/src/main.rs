// Trova IMS desktop shell.
//
// Two run modes:
//   - `tauri dev`: Tauri starts `npm run dev` and points the window at
//     http://localhost:3000 directly. This file does nothing extra beyond
//     single-instance handling.
//   - Packaged app: spawns the bundled .next/standalone/server.js, polls
//     until it accepts connections, then navigates away from the splash.
//
// Process lifecycle: the spawned Node server is tracked in managed state
// and explicitly killed when the app exits (RunEvent::ExitRequested). The
// single-instance plugin additionally guarantees only one copy of the app
// — and therefore only one server — can ever be running at once. Together
// these prevent orphaned Node processes from a previous session squatting
// on SERVER_PORT and silently answering requests with stale, un-updated
// code the next time the app launches.

use std::fs::OpenOptions;
use std::net::TcpStream;
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

/// Holds the spawned Node server so it can be killed on app exit instead
/// of being left as an orphaned background process.
struct ServerProcess(Mutex<Option<Child>>);

/// Locate the system `node` binary.
///
/// Windows packaged apps don't reliably inherit the interactive shell's
/// PATH. `where.exe` / `which` query the system search path independently
/// of the inherited process PATH, so they find Node even when a bare
/// `Command::new("node")` would fail.
fn find_node() -> String {
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
                String::from_utf8(o.stdout).ok().map(|s| {
                    s.lines().next().unwrap_or("node").trim().to_string()
                })
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

fn spawn_local_server(
    resource_dir: &std::path::Path,
    data_dir: &std::path::Path,
    log_path: &std::path::Path,
) -> std::io::Result<Child> {
    let standalone_dir = strip_verbatim_prefix(&resource_dir.join("standalone"));
    let server_js      = standalone_dir.join("server.js");
    let data_dir        = strip_verbatim_prefix(data_dir);
    let node_bin        = find_node();

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

    let log_file  = OpenOptions::new().create(true).append(true).open(log_path)?;
    let log_clone = log_file.try_clone()?;

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&server_js)
        .current_dir(&standalone_dir)
        .env("PORT",               SERVER_PORT.to_string())
        .env("HOSTNAME",           "127.0.0.1")
        .env("DESKTOP_MODE",       "true")
        .env("TROVA_DATA_DIR",     &data_dir)
        .env("BETTER_AUTH_SECRET", "desktop-mode-not-used")
        .env("PATH",               std::env::var("PATH").unwrap_or_default())
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
                eprintln!("[trova-ims] Shutting down local server (pid {})", child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn main() {
    let mut builder = tauri::Builder::default().manage(ServerProcess(Mutex::new(None)));

    // Must be registered first — see Tauri's single-instance docs. On a
    // second launch attempt, the closure below runs in the *original*
    // instance instead of a new process being spawned, so we just focus
    // the existing window rather than starting a second competing server.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
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

            std::fs::create_dir_all(&data_dir)
                .expect("failed to create app data directory");

            let log_path = data_dir.join("server.log");

            match spawn_local_server(&resource_dir, &data_dir, &log_path) {
                Err(err) => {
                    eprintln!("[trova-ims] Failed to start local server: {err}");
                    return Ok(());
                }
                Ok(child) => {
                    *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
                }
            }

            let handle = app.handle().clone();
            thread::spawn(move || {
                for attempt in 0..200 {
                    if TcpStream::connect(("127.0.0.1", SERVER_PORT)).is_ok() {
                        eprintln!("[trova-ims] Server ready after ~{}ms.", attempt * 150);
                        if let Some(window) = handle.get_webview_window("main") {
                            let url = Url::parse(&format!("http://127.0.0.1:{SERVER_PORT}"))
                                .expect("invalid local server URL");
                            let _ = window.navigate(url);
                        }
                        return;
                    }
                    thread::sleep(Duration::from_millis(150));
                }
                eprintln!(
                    "[trova-ims] Server did not become ready on port {SERVER_PORT} within 30 s.\n\
                     Check the server log at the app data directory for the exact error.\n\
                     Is Node.js installed?"
                );
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
