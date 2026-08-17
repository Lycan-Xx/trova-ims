// Trova IMS desktop shell.
//
// This is the Phase-0 packaging spike: it proves the Tauri build pipeline
// end-to-end (icons, installers, per-OS CI) by running the *existing*
// Next.js app locally instead of loading a static bundle. The app still
// talks to Aurora Postgres over the network at this stage — swapping that
// for an embedded local database (PGlite) so the app works fully offline
// is tracked separately and doesn't change anything in this file.
//
// Two different run modes, both handled here:
//   - `tauri dev`: Tauri itself starts `npm run dev` (beforeDevCommand)
//     and points the window at http://localhost:3000 (devUrl) — see
//     tauri.conf.json. This file does nothing extra in that case; the
//     `tauri::is_dev()` check below just skips the block meant for a
//     packaged app.
//   - `tauri build` / a packaged app: there's no dev server, so this
//     spawns the bundled .next/standalone server itself and navigates
//     the window to it once it's actually accepting connections.
//
// Known Phase-0 limitation: the packaged-app path spawns the system
// `node` binary rather than a bundled one, so an installed build
// currently needs Node.js present on that machine. Bundling a Node
// runtime binary as a proper Tauri sidecar is the follow-up to remove
// that requirement.

use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use tauri::{Manager, Url};

/// Fixed local port for the bundled Next.js server (packaged-app path
/// only — `tauri dev` uses Next's own default port 3000 instead, set via
/// `devUrl` in tauri.conf.json). Chosen to be unlikely to collide with
/// anything else already running on a cashier's machine.
const SERVER_PORT: u16 = 47821;

fn spawn_local_server(resource_dir: &std::path::Path, data_dir: &std::path::Path) -> std::io::Result<std::process::Child> {
    let standalone_dir = resource_dir.join("standalone");
    let server_js = standalone_dir.join("server.js");

    let mut cmd = Command::new("node");
    cmd.arg(&server_js)
        .current_dir(&standalone_dir)
        .env("PORT", SERVER_PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        // Tell the Next.js server it's running inside the Tauri desktop
        // shell — this bypasses Better Auth and routes all DB queries to
        // the local PGlite database file instead of Aurora.
        .env("DESKTOP_MODE", "true")
        // PGlite writes the database file here. Tauri resolves the correct
        // OS-specific app data directory (AppData/Roaming on Windows,
        // ~/.local/share on Linux, ~/Library/Application Support on macOS)
        // and passes it through so the server knows where to open the file.
        .env("TROVA_DATA_DIR", data_dir)
        // Satisfy the Next.js server's startup check without leaking a
        // real secret — in DESKTOP_MODE the auth module never initialises
        // Better Auth so this value is never actually used for signing.
        .env("BETTER_AUTH_SECRET", "desktop-mode-not-used")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    // Prevent a console window from flashing on Windows when the child
    // process starts.
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
            // Nothing to do in dev mode — Tauri already started the
            // Next.js dev server and pointed the window at it.
            if tauri::is_dev() {
                return Ok(());
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve app resource directory");

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");

            // Make sure the data directory exists before the server starts —
            // PGlite will try to create the .db file there immediately.
            std::fs::create_dir_all(&data_dir)
                .expect("failed to create app data directory");

            if let Err(err) = spawn_local_server(&resource_dir, &data_dir) {
                // Don't crash the whole app over this — log it and leave
                // the splash screen up so the failure is at least visible
                // rather than a silent exit.
                eprintln!(
                    "[trova-ims] Failed to start the local server ({err}). \
                     Is Node.js installed on this machine?"
                );
                return Ok(());
            }

            let handle = app.handle().clone();
            thread::spawn(move || {
                // Poll until the local server is actually accepting
                // connections before navigating the window to it — the
                // splash screen stays up until then.
                for _ in 0..200 {
                    if TcpStream::connect(("127.0.0.1", SERVER_PORT)).is_ok() {
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
                    "[trova-ims] Local server did not become ready on port {SERVER_PORT} in time."
                );
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Trova IMS desktop app");
}
