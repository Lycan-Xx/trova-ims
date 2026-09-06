// Type-only import — no runtime cost, never bundled by Turbopack as an
// external module reference. The actual `pg` package is loaded below
// via require() only when IS_DESKTOP is false, keeping it out of the
// desktop module graph entirely.
import type { Pool as PgPool, ClientBase } from 'pg'
import * as schema from './schema'
import { desktopQuery, desktopTestQuery } from './desktop-init'
import { isTestModeEnabled } from './test-mode'

// ── Desktop mode ──────────────────────────────────────────────────────────────
// When DESKTOP_MODE=true the Tauri shell sets this env var before starting
// the Next.js server. Every query is routed to the local PGlite database
// instead — no cloud connection, no auth, no internet needed.
//
// In this mode `pool`, `db` (Drizzle), and `withConnection` are not
// initialised — they'll throw if anything accidentally tries to use them
// directly, which makes misconfiguration obvious rather than silent.

export const IS_DESKTOP = process.env.DESKTOP_MODE === 'true'

// ── Cloud pool (web / Vercel) ─────────────────────────────────────────────────
// All three packages below are loaded via require() rather than top-level
// import so they are completely absent from the desktop module graph.
// Turbopack would otherwise mangle their names when bundling (e.g.
// "pg-587764f78a6c7a9c"), causing module-not-found errors at runtime.

// eslint-disable-next-line @typescript-eslint/no-require-imports
let pool: PgPool = null as unknown as PgPool

if (!IS_DESKTOP) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as { Pool: typeof PgPool }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Signer } = require('@aws-sdk/rds-signer') as typeof import('@aws-sdk/rds-signer')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { awsCredentialsProvider } = require('@vercel/functions/oidc') as typeof import('@vercel/functions/oidc')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { attachDatabasePool } = require('@vercel/functions') as typeof import('@vercel/functions')

  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
    })
  } else if (process.env.PGHOST && process.env.AWS_ROLE_ARN && process.env.AWS_REGION) {
    const signer = new Signer({
      credentials: awsCredentialsProvider({
        roleArn: process.env.AWS_ROLE_ARN!,
        clientConfig: { region: process.env.AWS_REGION! },
      }),
      region: process.env.AWS_REGION!,
      hostname: process.env.PGHOST!,
      username: process.env.PGUSER || 'postgres',
      port: 5432,
    })

    pool = new Pool({
      host: process.env.PGHOST!,
      database: process.env.PGDATABASE || 'postgres',
      port: 5432,
      user: process.env.PGUSER || 'postgres',
      password: () => signer.getAuthToken(),
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
    })
  } else {
    throw new Error(
      'No database configuration found. Set either DATABASE_URL or AWS_ROLE_ARN + AWS_REGION + PGHOST'
    )
  }

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool client error — connection will be discarded:', err.message)
  })

  attachDatabasePool(pool)
}

export { pool }
export const db = IS_DESKTOP
  ? null
  // drizzle-orm/node-postgres is cloud-only — only initialised when pool exists.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : (require('drizzle-orm/node-postgres') as typeof import('drizzle-orm/node-postgres')).drizzle(pool!, { schema })

// ── Unified query() ───────────────────────────────────────────────────────────
// All app/actions/* files call this — the routing to cloud vs. local is
// entirely contained here so action files need zero changes.

/** Single-statement queries */
export async function query(text: string, params?: unknown[]) {
  if (IS_DESKTOP) {
    return isTestModeEnabled() ? desktopTestQuery(text, params) : desktopQuery(text, params)
  }
  try {
    return await pool.query(text, params)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    // Retry once if the error looks like a stale/dead connection
    const isConnectionError =
      msg.includes('Connection terminated') ||
      msg.includes('connection timeout') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('terminating connection') ||
      msg.includes('SSL SYSCALL error')
    if (isConnectionError) {
      console.warn('[db] Stale connection detected — retrying query once...')
      return await pool.query(text, params)
    }
    throw err
  }
}

/** Multi-statement transactions.
 *
 * Cloud (pool): acquires a dedicated connection, runs fn(client), releases.
 *
 * Desktop (PGlite): wraps fn() in a PGlite transaction. PGlite doesn't
 * expose a pg-compatible Client object, so we shim one — the callback
 * receives an object whose .query() method delegates to desktopQuery() (or
 * desktopTestQuery() when Test Mode is on), which runs against the same
 * singleton PGlite database. BEGIN/COMMIT/ROLLBACK issued by the callback
 * are executed as ordinary queries, which PGlite handles correctly in its
 * single-connection, synchronous model.
 */
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>,
): Promise<T> {
  if (IS_DESKTOP) {
    const activeQuery = isTestModeEnabled() ? desktopTestQuery : desktopQuery
    const shimClient = {
      async query(text: string, params?: unknown[]) {
        return activeQuery(text, params)
      },
    } as unknown as ClientBase
    return fn(shimClient)
  }
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
