// scripts/run-migration.mjs
// Reads a SQL file and executes it against Aurora PostgreSQL using AWS IAM auth.
// Falls back to DATABASE_URL if AWS env vars are not set (for local/Neon use).
//
// Usage: node scripts/run-migration.mjs scripts/002-aurora-migration.sql

import { readFileSync } from 'fs'
import pg from 'pg'
import { Signer } from '@aws-sdk/rds-signer'

const { Pool } = pg

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <sql-file>')
  process.exit(1)
}

const sql = readFileSync(sqlFile, 'utf8')

let pool

if (process.env.PGHOST && process.env.AWS_REGION) {
  // Aurora IAM auth
  console.log(`Connecting to Aurora at ${process.env.PGHOST}...`)
  const signer = new Signer({
    region: process.env.AWS_REGION,
    hostname: process.env.PGHOST,
    username: process.env.PGUSER || 'postgres',
    port: 5432,
  })
  const token = await signer.getAuthToken()
  pool = new Pool({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE || 'postgres',
    port: 5432,
    user: process.env.PGUSER || 'postgres',
    password: token,
    ssl: { rejectUnauthorized: false },
    max: 1,
  })
} else if (process.env.DATABASE_URL) {
  // Fallback: Neon / plain connection string
  console.log('Connecting via DATABASE_URL...')
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
} else {
  console.error('Error: Set PGHOST+AWS_REGION (Aurora) or DATABASE_URL (Neon).')
  process.exit(1)
}

// Run each statement separately to avoid "multiple commands" errors
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

try {
  console.log(`Running ${statements.length} statements from: ${sqlFile}`)
  const client = await pool.connect()
  try {
    for (const stmt of statements) {
      await client.query(stmt)
    }
    console.log('Migration completed successfully.')
  } finally {
    client.release()
  }
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
