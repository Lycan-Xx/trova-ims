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
`BETTER_AUTH_SECRET` at runtime that the web deployment needs, supplied
however you'd normally supply them to a Node process on that machine.

## Known limitations to resolve in later phases

- **Requires a system Node.js install.** `src-tauri/src/main.rs` spawns
  the bundled `.next/standalone/server.js` via the system `node` binary
  rather than a bundled runtime. A real end-user install shouldn't
  require anything pre-installed — the follow-up is compiling a Node
  runtime binary as a proper Tauri sidecar (`bundle.externalBin`) so the
  app is fully self-contained.
- **No local database.** Making the app actually usable offline means
  swapping Aurora for an embedded local database (PGlite is the current
  plan — same Postgres dialect as Aurora, so the SQL in `app/actions/*`
  doesn't need to fork into two dialects).
- **No runtime env var story yet.** Once there's a local DB, the app
  won't need `DATABASE_URL` supplied externally at all — it'll point at
  a file in the OS app-data directory instead.

## How to build locally

```bash
npm run desktop:dev    # tauri dev — hot-reloads against a local Next dev server
npm run desktop:build  # tauri build — produces installers in src-tauri/target/release/bundle/
```

`desktop:build` needs `DATABASE_URL` and `BETTER_AUTH_SECRET` set in the
environment (any truthy value works for the build itself — see the
comment in the CI workflow for why).
