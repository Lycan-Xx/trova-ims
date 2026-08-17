import { Pool, type ClientBase } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { attachDatabasePool } from '@vercel/functions'
import * as schema from './schema'
import { desktopQuery } from './desktop-init'

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

let pool: Pool

if (!IS_DESKTOP) {
  if (process.env.DATABASE_URL) {
    // Direct PostgreSQL connection string (local development or standard deployment)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
    })
  } else if (process.env.PGHOST && process.env.AWS_ROLE_ARN && process.env.AWS_REGION) {
    // AWS RDS Signer (Vercel deployment with Aurora)
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

  // Log and discard broken connections so the pool can replace them cleanly
  pool!.on('error', (err) => {
    console.error('[db] Unexpected pool client error — connection will be discarded:', err.message)
  })

  attachDatabasePool(pool!)
}

export { pool }
export const db = IS_DESKTOP ? null : drizzle(pool!, { schema })

// ── Unified query() ───────────────────────────────────────────────────────────
// All app/actions/* files call this — the routing to cloud vs. local is
// entirely contained here so action files need zero changes.

/** Single-statement queries */
export async function query(text: string, params?: unknown[]) {
  if (IS_DESKTOP) {
    return desktopQuery(text, params)
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

/** Multi-statement transactions — not supported in desktop mode (PGlite
 *  uses .exec() for multi-statement; single-statement queries via query()
 *  are sufficient for all current action files) */
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>,
): Promise<T> {
  if (IS_DESKTOP) {
    throw new Error(
      '[desktop-db] withConnection() is not available in DESKTOP_MODE. ' +
      'Use query() for individual statements instead.'
    )
  }
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
