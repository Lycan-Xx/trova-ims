# Trova IMS — Desktop Shell (Tauri)

## What this is

A native Windows/macOS/Linux app built with Tauri, wrapping the existing
Next.js app. It runs fully offline: the packaged app spawns the app's
own server as a local process, backed by a local PGlite database
(`lib/db/desktop-init.ts`) instead of Aurora, with no sign-in required
(`DESKTOP_MODE=true` bypasses Better Auth entirely — see `lib/auth.ts`
and `middleware.ts`). Per-OS installers are built by
`.github/workflows/tauri-build.yml` (manual trigger, from the Actions
tab) or `.github/workflows/release.yml` (automatic, on tagged releases).

## Testing locally during development

### Option A — server already running (recommended for day-to-day work)

This is the fastest path if you've already got `npm run dev` running
for normal web development.

```bash
# Terminal 1 — already have this open, or run it now:
npm run dev

# Terminal 2 — once Terminal 1 says "Ready on http://localhost:3000":
npm run desktop:dev:external
```

`desktop:dev:external` opens the Tauri window pointing at your live
`localhost:3000` without starting a second dev server. Hot-reload,
HMR, React fast-refresh — everything works exactly as in the browser.
The native window is just a wrapper around what you already have.

### Option B — Tauri manages both

```bash
npm run desktop:dev
```

Tauri runs `npm run dev` itself as a child process and then opens the
window once the server is ready. Both processes stop when you close
the window or press Ctrl+C.

### What to expect in both cases

- A native window appears with the full Trova UI, including your local
  DB and auth — identical to the browser tab, but running as a desktop
  app
- Right-click → Inspect / Ctrl+Shift+I opens DevTools (enabled
  automatically in dev/debug builds)
- The Rust side hot-reloads too — changes to `src/main.rs` recompile
  and restart the shell automatically

## Building a packaged installer

```bash
# Needs DATABASE_URL + BETTER_AUTH_SECRET in the environment
# (any truthy values work — see the comment in the CI workflow)
npm run desktop:build
```

Or trigger it from GitHub Actions tab → **Build Desktop App (Tauri)**
→ **Run workflow**. Installers appear in the workflow run's Artifacts
section once the job finishes (~10–20 min first run, faster on cache).

## Known limitations

- **Requires system Node.js** in the packaged-app path (the release
  build spawns `node server.js` via the OS binary). Bundling a Node
  runtime as a proper Tauri sidecar would remove this dependency —
  not yet done.

## Troubleshooting a stuck / broken launch

If the app shows a Tauri error page ("This page couldn't load") or the
console log shows `EADDRINUSE: address already in use 127.0.0.1:47821`,
an orphaned server process from a previous install is still running
and holding the port. As of the process-lifecycle fix, the app kills
its own server on exit and won't let a second instance launch a
competing one — but if you're troubleshooting a build from before that
fix landed, clear any leftovers manually:

**Windows** — Task Manager → find any `node.exe` processes → End Task.
Or in PowerShell: `Get-Process node | Stop-Process -Force`

**macOS/Linux** — `pkill -f "standalone/server.js"`

Then relaunch. The server log at `<app data dir>/server.log` has the
exact error if the server still won't start — see the "Testing
locally" paths above for where that directory is per OS.
