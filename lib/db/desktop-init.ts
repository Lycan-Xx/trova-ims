// lib/db/desktop-init.ts
//
// Sets up the local PGlite database used in DESKTOP_MODE.
// PGlite is a full Postgres engine compiled to WASM — it speaks the same
// SQL dialect as Aurora, so every query in app/actions/* works unchanged.
//
// Called once during server startup (lib/db/index.ts routes to this when
// DESKTOP_MODE=true). After that, `desktopQuery()` is the drop-in
// replacement for the cloud `pool.query()`.
//
// A second, independent PGlite database (trova-test.db) is opened the same
// way for Test Mode (see lib/db/test-mode.ts) — same schema, same locking,
// but no sales export/purge scheduling, since test data never leaves the
// machine and isn't subject to the 30-day retention window.

import { PGlite } from '@electric-sql/pglite'
import { mkdirSync, openSync, readFileSync, closeSync, unlinkSync, writeSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { runDesktopSalesExportIfDue, scheduleDesktopSalesExport } from '../desktop-sales-export'

// ── Fixed IDs for the seeded local store + owner ──────────────────────────────
// These match the VALUES in scripts/desktop-schema.sql — kept in one place
// so the auth bypass in lib/auth.ts can import them directly. The test
// database is seeded with the exact same IDs (same schema script), so the
// same session/login continues to resolve normally when Test Mode is
// toggled on — only business data (products, sales, etc.) differs.

export const DESKTOP_LOCAL_STORE_ID = '00000000-0000-0000-0000-000000000001'
export const DESKTOP_LOCAL_USER_ID  = '00000000-0000-0000-0000-000000000002'

// ── DB paths ──────────────────────────────────────────────────────────────────
// In a packaged Tauri app this resolves to the OS app-data directory via
// the TROVA_DATA_DIR env var set by main.rs. In `tauri dev` / plain
// `npm run dev`, it falls back to `.trova-local/` in the project root so
// nothing leaks into the real DB. The test database is a sibling file in
// the same directory.

export function getDbPath(): string {
  const base = process.env.TROVA_DATA_DIR ?? join(process.cwd(), '.trova-local')
  return join(base, 'trova.db')
}

export function getTestDbPath(): string {
  return join(dirname(getDbPath()), 'trova-test.db')
}

// ── Singletons ────────────────────────────────────────────────────────────────
//
// PGlite is a single-connection WASM database — it does not support being
// opened by more than one process simultaneously. If a stale server.js
// process from a previous app session is still running and already has
// the database open, a second process trying to open the same file will
// cause the WASM runtime to abort() with a cryptic "RuntimeError: Aborted()"
// message. A simple lock file gives a much clearer error and prevents
// the WASM crash. The real and test databases each get their own state
// and lock file so they can be opened independently.

type DesktopDbState = {
  db: PGlite | null
  init: Promise<PGlite> | null
  lockFd: number | null
}

function makeDbState(key: '__trovaImsDesktopDbState' | '__trovaImsDesktopTestDbState'): DesktopDbState {
  // Next's production server can evaluate this module in multiple
  // route/action bundles. Keep each singleton on the process global so
  // those copies share one PGlite instance and one lock instead of
  // opening the same database twice.
  const g = globalThis as typeof globalThis & {
    __trovaImsDesktopDbState?: DesktopDbState
    __trovaImsDesktopTestDbState?: DesktopDbState
  }
  return (g[key] ??= { db: null, init: null, lockFd: null })
}

const desktopDbState = makeDbState('__trovaImsDesktopDbState')
const desktopTestDbState = makeDbState('__trovaImsDesktopTestDbState')

function releaseLock(state: DesktopDbState, lockPath: string) {
  // Only the process that still owns the descriptor may remove the lock.
  // This prevents an exit handler from deleting a newer process's lock after
  // an initialization failure has already released and reacquired it.
  if (state.lockFd === null) return
  try { closeSync(state.lockFd) } catch {}
  state.lockFd = null
  try { unlinkSync(lockPath) } catch {}
}

/** Acquires the lock file, applies the schema, and returns an open PGlite
 * instance for `dbPath`. Shared by both the real and test databases —
 * only what happens *after* the database is open (export scheduling, for
 * the real DB only) differs between them. */
async function openPGliteDatabase(state: DesktopDbState, dbPath: string, label: string): Promise<PGlite> {
  const lockPath = dbPath + '.lock'
  console.log(`[desktop-db] Opening ${label} database at ${dbPath}`)

  // Ensure the parent directory exists.
  mkdirSync(dirname(dbPath), { recursive: true })

  // Acquire a simple lock file before opening PGlite. If another server.js
  // process (orphaned from a previous install/session) already holds the
  // lock, fail fast with a clear error instead of letting PGlite's WASM
  // runtime crash with "RuntimeError: Aborted()".
  try {
    // O_CREAT | O_EXCL = create only if not exists — atomic on all platforms.
    state.lockFd = openSync(lockPath, 'wx')
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
      `[desktop-db] Cannot open ${label} database — another Trova IMS process may already ` +
      `be using it${lockDetails}. Close Trova IMS and try again.`
    )
  }

  if (state.lockFd === null) throw new Error(`[desktop-db] Failed to acquire ${label} database lock`)
  writeSync(state.lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))

  // Release the lock file when the Node process exits.
  process.once('exit', () => releaseLock(state, lockPath))

  // PGlite persists PostgreSQL runtime files inside the database directory.
  // A forcibly terminated desktop process can leave postmaster.pid behind;
  // PGlite then aborts before it can open the database. Trova's app-level lock
  // is held at this point, so no other Trova server can be using this DB.
  try { unlinkSync(join(dbPath, 'postmaster.pid')) } catch {}

  const db = new PGlite(dbPath)
  const schemaPath = join(process.cwd(), 'scripts', 'desktop-schema.sql')
  const sql = readFileSync(schemaPath, 'utf-8')
  await db.exec(sql)

  return db
}

// ── Real (production) database ─────────────────────────────────────────────────

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
  let db: PGlite | null = null
  try {
    db = await openPGliteDatabase(desktopDbState, dbPath, 'local')

    // Export before purging. The local database intentionally retains only
    // about 30 days of sales, so a failed Documents write must never be
    // followed by deletion of the records that still need exporting.
    const exportResult = await runDesktopSalesExportIfDue(
      db,
      dirname(dbPath),
      DESKTOP_LOCAL_STORE_ID,
    )
    if (exportResult.success) {
      await db.query(`DELETE FROM sales WHERE created_at < NOW() - INTERVAL '720 hours'`)
    } else {
      console.error('[desktop-db] Skipping expired-sales purge because the scheduled export failed.')
    }

    desktopDbState.db = db

    scheduleDesktopSalesExport(
      db,
      dirname(dbPath),
      DESKTOP_LOCAL_STORE_ID,
      exportResult.nextDelayMs,
    )
  } catch (error) {
    console.error(`[desktop-db] Failed to initialize local database: ${error}`)
    try { await db?.close() } catch {}
    desktopDbState.db = null
    releaseLock(desktopDbState, dbPath + '.lock')
    throw error
  }

  console.log('[desktop-db] Schema applied. Local database is ready.')
  if (!db) throw new Error('[desktop-db] Database initialization produced no instance')
  return db
}

// ── Test-mode database ───────────────────────────────────────────────────────
// Isolated PGlite instance for Test Mode. Same schema (so the same seeded
// store/user IDs exist and login keeps working), but starts with zero
// products/vendors/sales — nothing is copied over from the real database —
// and is never exported to Documents or purged, since it isn't real store
// data.

export async function getDesktopTestDb(): Promise<PGlite> {
  if (desktopTestDbState.db) return desktopTestDbState.db
  if (desktopTestDbState.init) return desktopTestDbState.init

  const init = initializeDesktopTestDb()
  desktopTestDbState.init = init
  try {
    return await init
  } finally {
    if (desktopTestDbState.init === init) desktopTestDbState.init = null
  }
}

async function initializeDesktopTestDb(): Promise<PGlite> {
  const dbPath = getTestDbPath()
  let db: PGlite | null = null
  try {
    db = await openPGliteDatabase(desktopTestDbState, dbPath, 'test')
    desktopTestDbState.db = db
  } catch (error) {
    console.error(`[desktop-db] Failed to initialize test database: ${error}`)
    try { await db?.close() } catch {}
    desktopTestDbState.db = null
    releaseLock(desktopTestDbState, dbPath + '.lock')
    throw error
  }

  console.log('[desktop-db] Test database ready (schema applied, no export/purge scheduled).')
  if (!db) throw new Error('[desktop-db] Test database initialization produced no instance')
  return db
}

// ── query() drop-ins ──────────────────────────────────────────────────────────
// Same signature as `pool.query(text, params?)` from lib/db/index.ts so
// every call site in app/actions/* works without modification, regardless
// of which database it ends up routed to.

export async function desktopQuery(
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  const db = await getDesktopDb()
  const result = await db.query(text, params as unknown[])
  return { rows: result.rows as Record<string, unknown>[] }
}

export async function desktopTestQuery(
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  const db = await getDesktopTestDb()
  const result = await db.query(text, params as unknown[])
  return { rows: result.rows as Record<string, unknown>[] }
}
