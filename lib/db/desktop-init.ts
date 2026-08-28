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

type DesktopDbState = {
  db: PGlite | null
  init: Promise<PGlite> | null
  lockFd: number | null
}

// Next's production server can evaluate this module in multiple route/action
// bundles. Keep the singleton on the process global so those copies share one
// PGlite instance and one lock instead of opening the same database twice.
const desktopGlobal = globalThis as typeof globalThis & {
  __trovaImsDesktopDbState?: DesktopDbState
}
const desktopDbState = desktopGlobal.__trovaImsDesktopDbState ??= {
  db: null,
  init: null,
  lockFd: null,
}

function releaseDesktopLock(lockPath: string) {
  // Only the process that still owns the descriptor may remove the lock.
  // This prevents an exit handler from deleting a newer process's lock after
  // an initialization failure has already released and reacquired it.
  if (desktopDbState.lockFd === null) return
  try { closeSync(desktopDbState.lockFd) } catch {}
  desktopDbState.lockFd = null
  try { unlinkSync(lockPath) } catch {}
}

export async function getDesktopDb(): Promise<PGlite> {
  if (desktopDbState.db) return desktopDbState.db

  // Health polling can issue several requests while the first PGlite
  // instance is still applying the schema. Share one initialization promise
  // so those requests cannot race each other into the WASM runtime.
  if (desktopDbState.init) return desktopDbState.init

  const init = initializeDesktopDb()
  desktopDbState.init = init
  try {
    return await init
  } finally {
    // A failed initialization must not poison every later request with the
    // same rejected promise. Successful initialization is cached in _db.
    if (desktopDbState.init === init) desktopDbState.init = null
  }
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
    desktopDbState.lockFd = openSync(lockPath, 'wx')
  } catch {
    let lockDetails = ''
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: number; startedAt?: string }
      if (typeof lock.pid === 'number') {
        lockDetails = ` (PID ${lock.pid}${lock.startedAt ? `, started ${lock.startedAt}` : ''})`
      }
    } catch {
      // Keep the generic message when the lock file is incomplete or unreadable.
    }

    throw new Error(
      `[desktop-db] Cannot open trova.db — another Trova IMS process may already ` +
      `be using the database${lockDetails}. Close Trova IMS and try again.`
    )
  }

  if (desktopDbState.lockFd === null) throw new Error('[desktop-db] Failed to acquire database lock')
  writeSync(desktopDbState.lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))

  // Release the lock file when the Node process exits.
  process.once('exit', () => releaseDesktopLock(lockPath))

  // PGlite persists PostgreSQL runtime files inside the database directory.
  // A forcibly terminated desktop process can leave postmaster.pid behind;
  // PGlite then aborts before it can open the database. Trova's app-level lock
  // is held at this point, so no other Trova server can be using this DB.
  try { unlinkSync(join(dbPath, 'postmaster.pid')) } catch {}

  const applySchema = async (instance: PGlite) => {
    const schemaPath = join(process.cwd(), 'scripts', 'desktop-schema.sql')
    const sql = readFileSync(schemaPath, 'utf-8')
    await instance.exec(sql)
  }

  let db: PGlite | null = null
  try {
    db = new PGlite(dbPath)
    await applySchema(db)
    desktopDbState.db = db
  } catch (error) {
    console.error(`[desktop-db] Failed to initialize local database: ${error}`)
    try { await db?.close() } catch {}
    desktopDbState.db = null
    releaseDesktopLock(lockPath)
    throw error
  }

  console.log('[desktop-db] Schema applied. Local database is ready.')
  if (!db) throw new Error('[desktop-db] Database initialization produced no instance')
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
