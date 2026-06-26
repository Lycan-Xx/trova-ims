#!/usr/bin/env node

/**
 * Better Auth Setup Verification Script
 * 
 * Checks:
 * 1. Environment variables are set
 * 2. Database connection works
 * 3. Database schema is correct
 * 4. Better Auth tables exist
 * 5. App is properly configured
 */

import { query } from '../lib/db/index.js'

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
}

async function log(level, message) {
  const icons = {
    pass: '✓',
    fail: '✗',
    warn: '⚠',
  }
  console.log(`${icons[level]} ${message}`)
}

async function checkEnvironment() {
  console.log('\n═══ Environment Variables ═══\n')

  const required = ['DATABASE_URL', 'BETTER_AUTH_URL', 'NODE_ENV']
  const env = process.env

  for (const key of required) {
    if (env[key]) {
      const val = key === 'DATABASE_URL' ? '***' : env[key]
      await log('pass', `${key}: ${val}`)
      checks.passed++
    } else {
      await log('fail', `${key}: NOT SET`)
      checks.failed++
    }
  }
}

async function checkDatabase() {
  console.log('\n═══ Database Connection ═══\n')

  try {
    const result = await query('SELECT version();')
    await log('pass', `Connected to PostgreSQL`)
    checks.passed++
  } catch (err) {
    await log('fail', `Cannot connect to database: ${err.message}`)
    checks.failed++
    return false
  }

  return true
}

async function checkSchema() {
  console.log('\n═══ Database Schema ═══\n')

  // Check for better_auth_users table
  try {
    const result = await query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'better_auth_user'
      ) as exists;
    `)
    if (result.rows[0]?.exists) {
      await log('pass', 'better_auth_user table exists')
      checks.passed++
    } else {
      await log('warn', 'better_auth_user table not found (will be created on first auth request)')
      checks.warnings++
    }
  } catch (err) {
    await log('warn', `Could not check better_auth_user: ${err.message}`)
    checks.warnings++
  }

  // Check for app users table
  try {
    const result = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'auth_id';
    `)
    if (result.rows.length > 0) {
      await log('pass', 'users.auth_id column exists')
      checks.passed++
    } else {
      await log('fail', 'users.auth_id column NOT FOUND - run: psql ... -f scripts/002-migrate-to-better-auth.sql')
      checks.failed++
    }
  } catch (err) {
    if (err.message.includes('relation "users" does not exist')) {
      await log('warn', 'users table not found (will create on first auth)')
      checks.warnings++
    } else {
      await log('fail', `Error checking users table: ${err.message}`)
      checks.failed++
    }
  }

  // Check for stores table
  try {
    const result = await query('SELECT COUNT(*) as count FROM stores;')
    const count = result.rows[0]?.count || 0
    await log('pass', `stores table exists (${count} stores)`)
    checks.passed++
  } catch (err) {
    await log('warn', 'stores table might not exist yet (will create on first signup)')
    checks.warnings++
  }

  // Check users table
  try {
    const result = await query('SELECT COUNT(*) as count FROM users WHERE is_active = true;')
    const count = result.rows[0]?.count || 0
    await log('pass', `users table exists (${count} active users)`)
    checks.passed++
    
    if (count > 0) {
      const userResult = await query(`
        SELECT email, auth_id, role FROM users WHERE is_active = true LIMIT 3;
      `)
      userResult.rows.forEach((user, i) => {
        const authId = user.auth_id ? `${user.auth_id.substring(0, 10)}...` : 'NULL'
        console.log(`  ${i + 1}. ${user.email} (${user.role}) [${authId}]`)
      })
    }
  } catch (err) {
    await log('warn', 'users table might not exist yet')
    checks.warnings++
  }
}

async function checkConfiguration() {
  console.log('\n═══ Application Configuration ═══\n')

  // Check auth.ts
  try {
    const fs = await import('fs/promises')
    const authFile = await fs.readFile('./lib/auth.ts', 'utf-8')
    
    if (authFile.includes('betterAuth')) {
      await log('pass', 'lib/auth.ts configured for better-auth')
      checks.passed++
    } else {
      await log('fail', 'lib/auth.ts does not import betterAuth')
      checks.failed++
    }

    if (authFile.includes('emailAndPassword')) {
      await log('pass', 'Email/password auth enabled')
      checks.passed++
    } else {
      await log('warn', 'Email/password auth not found')
      checks.warnings++
    }
  } catch (err) {
    await log('fail', `Could not check auth.ts: ${err.message}`)
    checks.failed++
  }

  // Check middleware
  try {
    const fs = await import('fs/promises')
    const middlewareFile = await fs.readFile('./middleware.ts', 'utf-8')
    
    if (middlewareFile.includes('better-auth.session_token')) {
      await log('pass', 'Middleware checks for better-auth session token')
      checks.passed++
    } else {
      await log('warn', 'Middleware might not be checking for better-auth tokens')
      checks.warnings++
    }
  } catch (err) {
    await log('fail', `Could not check middleware: ${err.message}`)
    checks.failed++
  }
}

async function run() {
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║    Better Auth Setup Verification (v1.0)           ║')
  console.log('╚════════════════════════════════════════════════════╝')

  await checkEnvironment()

  if (!process.env.DATABASE_URL) {
    console.log('\n❌ DATABASE_URL not set. Cannot continue.')
    process.exit(1)
  }

  const dbOk = await checkDatabase()
  if (!dbOk) {
    console.log('\n❌ Database connection failed.')
    process.exit(1)
  }

  await checkSchema()
  await checkConfiguration()

  console.log('\n╔════════════════════════════════════════════════════╗')
  console.log(`║  Results: ✓ ${checks.passed}  ✗ ${checks.failed}  ⚠ ${checks.warnings}                          ║`)
  console.log('╚════════════════════════════════════════════════════╝\n')

  if (checks.failed > 0) {
    console.log('⚠️  Some checks failed. See above for details.\n')
    process.exit(1)
  } else if (checks.warnings > 0) {
    console.log('⚠️  Setup looks good, but check warnings above.\n')
  } else {
    console.log('✅ All checks passed! Better Auth is properly configured.\n')
  }
}

run().catch(console.error)
