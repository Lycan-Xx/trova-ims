// lib/db/desktop-init.ts
//
// Sets up the local PGlite database used in DESKTOP_MODE.
// PGlite is a full Postgres engine compiled to WASM — it speaks the same
// SQL dialect as Aurora, so every query in app/actions/* works unchanged.
//
// Called once during server startup (lib/db/index.ts routes to this when
// DESKTOP_MODE=true). After that, `desktopQuery()` is the drop-in
// replacement for the cloud `pool.query()`.

import { PGlite } from '@electric-sql/pglite'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

// ── Fixed IDs for the seeded local store + owner ──────────────────────────────
// These match the VALUES in scripts/desktop-schema.sql — kept in one place
// so the auth bypass in lib/auth.ts can import them directly.

export const DESKTOP_LOCAL_STORE_ID = '00000000-0000-0000-0000-000000000001'
export const DESKTOP_LOCAL_USER_ID  = '00000000-0000-0000-0000-000000000002'

// ── DB path ───────────────────────────────────────────────────────────────────
// In a packaged Tauri app this resolves to the OS app-data directory via
// the TROVA_DATA_DIR env var set by main.rs. In `tauri dev` / plain
// `npm run dev`, it falls back to `.trova-local/` in the project root so
// nothing leaks into the real DB.

function getDbPath(): string {
  const base = process.env.TROVA_DATA_DIR ?? join(process.cwd(), '.trova-local')
  return join(base, 'trova.db')
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db: PGlite | null = null

export async function getDesktopDb(): Promise<PGlite> {
  if (_db) return _db

  const dbPath = getDbPath()
  console.log(`[desktop-db] Opening local database at ${dbPath}`)

  // Ensure the parent directory exists — PGlite will fail if it doesn't.
  // In packaged Tauri builds main.rs creates this before spawning the
  // server, but guard here too for `npm run desktop:dev:external` / tests.
  mkdirSync(dirname(dbPath), { recursive: true })

  _db = new PGlite(dbPath)

  // Run schema on every start — all statements are IF NOT EXISTS / ON CONFLICT
  // DO NOTHING, so this is fully idempotent. New installs get a fresh DB;
  // existing installs are untouched.
  const schemaPath = join(process.cwd(), 'scripts', 'desktop-schema.sql')
  const sql = readFileSync(schemaPath, 'utf-8')
  await _db.exec(sql)

  console.log('[desktop-db] Schema applied. Local database is ready.')
  return _db
}

// ── query() drop-in ───────────────────────────────────────────────────────────
// Same signature as `pool.query(text, params?)` from lib/db/index.ts so
// every call site in app/actions/* works without modification.

export async function desktopQuery(
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  const db = await getDesktopDb()
  const result = await db.query(text, params as unknown[])
  return { rows: result.rows as Record<string, unknown>[] }
}
