import { Pool, type ClientBase } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { attachDatabasePool } from '@vercel/functions'
import * as schema from './schema'

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

export const pool = new Pool({
  host: process.env.PGHOST!,
  database: process.env.PGDATABASE || 'postgres',
  port: 5432,
  user: process.env.PGUSER || 'postgres',
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  // Keep connections alive — Aurora drops idle TCP connections after ~5 min
  max: 10,
  idleTimeoutMillis: 30_000,        // remove idle clients from pool after 30s
  connectionTimeoutMillis: 10_000,  // fail fast if Aurora is cold-starting
  // Allow the pool to reconnect after a connection error
  allowExitOnIdle: false,
})

// Log and discard broken connections so the pool can replace them cleanly
pool.on('error', (err) => {
  console.error('[db] Unexpected pool client error — connection will be discarded:', err.message)
})

attachDatabasePool(pool)

export const db = drizzle(pool, { schema })

/** Single-statement queries — retries once on connection errors (handles Aurora idle drops) */
export async function query(text: string, params?: unknown[]) {
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

/** Multi-statement transactions — always release the client in a finally block */
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
