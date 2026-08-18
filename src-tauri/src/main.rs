// Trova IMS desktop shell.
//
// Two run modes:
//   - `tauri dev`: Tauri starts `npm run dev` and points the window at
//     http://localhost:3000 directly. This file does nothing extra.
//   - Packaged app: spawns the bundled .next/standalone server, polls
//     until it accepts connections, then navigates away from the splash.
//
// Phase-0 limitation: requires a system Node.js install. Bundling a
// Node runtime as a proper Tauri sidecar is tracked for a later phase.

use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use tauri::{Manager, Url};

/// Fixed local port for the bundled Next.js server (packaged-app path
/// only — dev mode uses port 3000 via devUrl in tauri.conf.json).
const SERVER_PORT: u16 = 47821;

/// Locate the system `node` binary by path rather than relying on bare
/// name resolution.
///
/// Windows GUI apps launched at boot don't always inherit the same PATH
/// that the interactive shell has, so `Command::new("node")` can fail
/// even when Node is installed and visible in PowerShell. Querying
/// `where.exe` / `which` uses the system search path rather than the
/// inherited process PATH, so it finds Node regardless of how the app
/// was started. Falls back to the bare name on failure so the OS error
/// message is still readable.
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
                    // `where.exe` may return multiple lines — take first only.
                    s.lines().next().unwrap_or("node").trim().to_string()
                })
            } else {
                None
            }
        })
        .unwrap_or_else(|| "node".to_string())
}

fn spawn_local_server(
    resource_dir: &std::path::Path,
    data_dir: &std::path::Path,
) -> std::io::Result<std::process::Child> {
    let standalone_dir = resource_dir.join("standalone");
    let server_js = standalone_dir.join("server.js");
    let node_bin = find_node();

    eprintln!("[trova-ims] node binary:   {node_bin}");
    eprintln!("[trova-ims] server script: {}", server_js.display());
    eprintln!("[trova-ims] data dir:      {}", data_dir.display());

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&server_js)
        .current_dir(&standalone_dir)
        .env("PORT", SERVER_PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        // Offline mode — bypasses Better Auth, routes queries to PGlite.
        .env("DESKTOP_MODE", "true")
        // PGlite creates trova.db under this directory.
        .env("TROVA_DATA_DIR", data_dir)
        // Satisfies the startup env check; never used at runtime in DESKTOP_MODE.
        .env("BETTER_AUTH_SECRET", "desktop-mode-not-used")
        // Forward PATH so Node's own child-process spawns can find system tools.
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        // Keep stdout/stderr piped (not null) so failures are visible in
        // the OS console / event log rather than silently disappearing.
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Suppress the extra console window on Windows.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Dev mode: Tauri already started next dev and pointed the window
            // at localhost:3000. Nothing to do here.
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

            match spawn_local_server(&resource_dir, &data_dir) {
                Err(err) => {
                    eprintln!(
                        "[trova-ims] Failed to start local server: {err}\n\
                         Is Node.js installed and on the system PATH?"
                    );
                    return Ok(());
                }
                Ok(_child) => {
                    // Child is intentionally not stored — it outlives setup()
                    // and will be cleaned up when the Tauri process exits.
                }
            }

            let handle = app.handle().clone();
            thread::spawn(move || {
                // Poll up to 30 s (200 × 150 ms) for the server to become ready.
                for attempt in 0..200 {
                    if TcpStream::connect(("127.0.0.1", SERVER_PORT)).is_ok() {
                        eprintln!(
                            "[trova-ims] Server ready after ~{}ms — navigating window.",
                            attempt * 150
                        );
                        if let Some(window) = handle.get_webview_window("main") {
                            let url =
                                Url::parse(&format!("http://127.0.0.1:{SERVER_PORT}"))
                                    .expect("invalid local server URL");
                            let _ = window.navigate(url);
                        }
                        return;
                    }
                    thread::sleep(Duration::from_millis(150));
                }
                eprintln!(
                    "[trova-ims] Server did not become ready on port {SERVER_PORT} within 30 s.\n\
                     Check that Node.js is installed and that no other process is using that port."
                );
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Trova IMS");
}
