#!/usr/bin/env node
/**
 * Syncs your Clerk user ID with the database.
 * Usage: node scripts/sync-clerk-user.mjs <your-clerk-user-id>
 * 
 * To find your Clerk user ID:
 * 1. Log into the app and open browser DevTools → Console
 * 2. Run: const session = await fetch('/api/auth/session').then(r => r.json()); console.log(session.user.id);
 * 3. Copy the ID and run this script with it
 */

import pg from 'pg'

const { Pool } = pg

const clerkId = process.argv[2]

if (!clerkId) {
  console.error('Usage: node scripts/sync-clerk-user.mjs <clerk-user-id>')
  console.error('')
  console.error('To find your Clerk ID:')
  console.error('1. Open the app in your browser')
  console.error('2. Open DevTools → Console')
  console.error('3. Paste this:')
  console.error('   fetch(\'/api/auth/session\').then(r => r.json()).then(s => console.log(s.user?.id))')
  console.error('4. Copy the ID and run this script')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

;(async () => {
  try {
    // Check if user exists
    const existing = await pool.query('SELECT id, clerk_id FROM users WHERE clerk_id = $1', [
      clerkId,
    ])

    if (existing.rows.length > 0) {
      console.log('✓ User already exists with this Clerk ID')
      console.log('  User ID:', existing.rows[0].id)
      console.log('  You should now be able to access all pages!')
      process.exit(0)
    }

    // Get first store
    const storeRes = await pool.query('SELECT id FROM stores LIMIT 1')

    if (storeRes.rows.length === 0) {
      // Create store first
      const newStoreRes = await pool.query(
        `INSERT INTO stores (id, name, address, phone, created_at)
         VALUES (gen_random_uuid(), $1, NULL, NULL, NOW())
         RETURNING id`,
        ['My Store'],
      )
      const storeId = newStoreRes.rows[0].id

      // Create user
      await pool.query(
        `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', true, NOW())`,
        [clerkId, storeId, 'Store Owner', 'owner@example.com'],
      )

      console.log('✓ Created new store and user')
      console.log('  Store ID:', storeId)
      console.log('  Clerk ID:', clerkId)
      console.log('  Role: owner')
      console.log('')
      console.log('You should now be able to access all pages!')
    } else {
      const storeId = storeRes.rows[0].id

      // Create user in existing store
      await pool.query(
        `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', true, NOW())`,
        [clerkId, storeId, 'Store Owner', 'owner@example.com'],
      )

      console.log('✓ Created user in existing store')
      console.log('  Store ID:', storeId)
      console.log('  Clerk ID:', clerkId)
      console.log('  Role: owner')
      console.log('')
      console.log('You should now be able to access all pages!')
    }
  } catch (err) {
    console.error('✗ Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
