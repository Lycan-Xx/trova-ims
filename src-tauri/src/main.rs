// Trova IMS desktop shell.
//
// This is the Phase-0 packaging spike: it proves the Tauri build pipeline
// end-to-end (icons, installers, per-OS CI) by running the *existing*
// Next.js app locally instead of loading a static bundle. The app still
// talks to Aurora Postgres over the network at this stage — swapping that
// for an embedded local database (PGlite) so the app works fully offline
// is tracked separately and doesn't change anything in this file.
//
// Known Phase-0 limitation: this spawns the system `node` binary rather
// than a bundled one, so a machine running the packaged app currently
// needs Node.js installed. Bundling a Node runtime binary as a proper
// Tauri sidecar is the follow-up to remove that requirement.

use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;
use tauri::{Manager, Url};

/// Fixed local port for the bundled Next.js server. Chosen to be
/// unlikely to collide with anything else already running on a
/// cashier's machine.
const SERVER_PORT: u16 = 47821;

fn spawn_local_server(resource_dir: &std::path::Path) -> std::io::Result<Child> {
    let standalone_dir = resource_dir.join("standalone");
    let server_js = standalone_dir.join("server.js");

    let mut cmd = Command::new("node");
    cmd.arg(&server_js)
        .current_dir(&standalone_dir)
        .env("PORT", SERVER_PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
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
            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve app resource directory");

            let _server = spawn_local_server(&resource_dir)
                .expect("failed to start the local Trova IMS server — is Node.js installed?");

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
