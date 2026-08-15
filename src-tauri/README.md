# Trova IMS — Desktop Shell (Tauri)

## What this is right now (Phase 0)

This proves the packaging pipeline end-to-end: Tauri launches the app's
existing Next.js server as a local process and displays it in a native
window, with per-OS installers built by
`.github/workflows/tauri-build.yml` (manual trigger, from the Actions tab).

It is **not yet offline**. The packaged app still runs the same server
code that talks to Amazon Aurora over the network — nothing about the
database layer has changed. Launching a build from this workflow today
produces an app that needs the same `DATABASE_URL`/AWS credentials and
`BETTER_AUTH_SECRET` at runtime that the web deployment needs.

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

## Known limitations (Phase 0)

- **Requires system Node.js** in the packaged-app path (the release
  build spawns `node server.js` via the OS binary). Bundling a Node
  runtime as a proper Tauri sidecar removes this dependency — Phase 1.
- **No local database** — the app still reaches Aurora over the
  network. Offline support comes with PGlite in a later phase.
- **No runtime env var story** — once there's a local DB, `DATABASE_URL`
  won't be needed at all from outside the app.
