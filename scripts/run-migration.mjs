// scripts/run-migration.mjs
// Reads a SQL file and executes it against the Neon PostgreSQL database
// using the DATABASE_URL environment variable.
//
// Usage: node scripts/run-migration.mjs scripts/001-setup-schema.sql

import { readFileSync } from 'fs'
import pg from 'pg'

const { Pool } = pg

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <sql-file>')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.')
  process.exit(1)
}

const sql = readFileSync(sqlFile, 'utf8')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
