// scripts/run-migration.mjs
// Reads a SQL file and executes it against the Aurora PostgreSQL instance
// using IAM auth via the RDS Signer.
//
// Usage: node scripts/run-migration.mjs scripts/001-setup-schema.sql

import { readFileSync } from 'fs'
import { Signer } from '@aws-sdk/rds-signer'
import pg from 'pg'

const { Pool } = pg

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <sql-file>')
  process.exit(1)
}

const sql = readFileSync(sqlFile, 'utf8')

const signer = new Signer({
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST,
  username: process.env.PGUSER || 'postgres',
  port: 5432,
})

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE || 'postgres',
  port: 5432,
  user: process.env.PGUSER || 'postgres',
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 1,
})

try {
  console.log(`Running migration: ${sqlFile}`)
  await pool.query(sql)
  console.log('Migration completed successfully.')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
