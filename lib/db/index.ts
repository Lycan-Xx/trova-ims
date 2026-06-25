import { Pool, type ClientBase } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })

/** Single-statement queries */
export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params)
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
