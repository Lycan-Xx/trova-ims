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
import { mkdirSync, openSync, readFileSync, closeSync, unlinkSync, writeSync } from 'node:fs'
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
//
// PGlite is a single-connection WASM database — it does not support being
// opened by more than one process simultaneously. If a stale server.js
// process from a previous app session is still running and already has
// trova.db open, a second process trying to open the same file will cause
// the WASM runtime to abort() with a cryptic "RuntimeError: Aborted()"
// message. A simple lock file gives a much clearer error and prevents
// the WASM crash.

let _db: PGlite | null = null
let _dbInit: Promise<PGlite> | null = null
let _lockFd: number | null = null

function releaseDesktopLock(lockPath: string) {
  if (_lockFd !== null) {
    try { closeSync(_lockFd) } catch {}
    _lockFd = null
  }
  try { unlinkSync(lockPath) } catch {}
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function getDesktopDb(): Promise<PGlite> {
  if (_db) return _db

  // Health polling can issue several requests while the first PGlite
  // instance is still applying the schema. Share one initialization promise
  // so those requests cannot race each other into the WASM runtime.
  if (_dbInit) return _dbInit

  _dbInit = initializeDesktopDb()
  return _dbInit
}

async function initializeDesktopDb(): Promise<PGlite> {
  const dbPath = getDbPath()
  const lockPath = dbPath + '.lock'
  console.log(`[desktop-db] Opening local database at ${dbPath}`)

  // Ensure the parent directory exists.
  mkdirSync(dirname(dbPath), { recursive: true })

  // Acquire a simple lock file before opening PGlite. If another server.js
  // process (orphaned from a previous install/session) already holds the
  // lock, fail fast with a clear error instead of letting PGlite's WASM
  // runtime crash with "RuntimeError: Aborted()".
  try {
    // O_CREAT | O_EXCL = create only if not exists — atomic on all platforms.
    _lockFd = openSync(lockPath, 'wx')
  } catch {
    let ownerPid: number | null = null
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: number }
      if (typeof lock.pid === 'number') ownerPid = lock.pid
    } catch {
      // An empty/old-format lock cannot identify a live owner. It is safe to
      // reclaim it; the new lock is created atomically immediately afterward.
    }

    if (ownerPid === null || !isProcessAlive(ownerPid)) {
      try { unlinkSync(lockPath) } catch {}
      _lockFd = openSync(lockPath, 'wx')
    } else {
      throw new Error(
        `[desktop-db] Cannot open trova.db — another Trova IMS process is already ` +
        `running (PID ${ownerPid}) and holds the database lock (${lockPath}).\n` +
        `Close that Trova IMS process and try again.`
      )
    }
  }

  if (_lockFd === null) throw new Error('[desktop-db] Failed to acquire database lock')
  writeSync(_lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))

  // Release the lock file when the Node process exits.
  process.once('exit', () => releaseDesktopLock(lockPath))

  // PGlite persists PostgreSQL runtime files inside the database directory.
  // A forcibly terminated desktop process can leave postmaster.pid behind;
  // PGlite then aborts before it can open the database. Trova's app-level lock
  // is held at this point, so no other Trova server can be using this DB.
  try { unlinkSync(join(dbPath, 'postmaster.pid')) } catch {}

  let db: PGlite | null = null
  try {
    db = new PGlite(dbPath)

    // Run schema on every start — all statements are IF NOT EXISTS / ON CONFLICT
    // DO NOTHING, so this is fully idempotent. New installs get a fresh DB;
    // existing installs are untouched.
    const schemaPath = join(process.cwd(), 'scripts', 'desktop-schema.sql')
    const sql = readFileSync(schemaPath, 'utf-8')
    await db.exec(sql)
    _db = db
  } catch (error) {
    try { await db?.close() } catch {}
    _db = null
    releaseDesktopLock(lockPath)
    throw error
  }

  console.log('[desktop-db] Schema applied. Local database is ready.')
  return db
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
