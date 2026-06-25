#!/usr/bin/env node

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

const clerkId = process.argv[2];
const email = process.argv[3];
const name = process.argv[4] || 'User';

if (!clerkId || !email) {
  console.error('Usage: node scripts/quick-sync-user.mjs <clerkId> <email> [name]');
  console.error('Example: node scripts/quick-sync-user.mjs user_2kZZpKKL91 test@example.com "Test User"');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    console.log(`Syncing user: ${email} (Clerk ID: ${clerkId})`);

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE clerk_id = $1',
      [clerkId]
    );

    if (existing.rows.length > 0) {
      console.error(`✗ User with Clerk ID ${clerkId} already exists in database`);
      process.exit(1);
    }

    // Get or create store
    let storeId;
    const stores = await pool.query('SELECT id FROM stores LIMIT 1');
    
    if (stores.rows.length > 0) {
      storeId = stores.rows[0].id;
      console.log(`✓ Using existing store: ${storeId}`);
    } else {
      const storeRes = await pool.query(
        `INSERT INTO stores (id, name, address, phone, created_at)
         VALUES ($1, 'Default Store', NULL, NULL, NOW())
         RETURNING id`,
        [uuidv4()]
      );
      storeId = storeRes.rows[0].id;
      console.log(`✓ Created new store: ${storeId}`);
    }

    // Create user
    await pool.query(
      `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, 'owner', true, NOW())`,
      [uuidv4(), clerkId, storeId, name, email]
    );

    console.log(`✓ User synced successfully!`);
    console.log(`✓ Email: ${email}`);
    console.log(`✓ Role: owner`);
    console.log(`✓ Store: ${storeId}`);
    console.log('');
    console.log('Now refresh the app and you should be authenticated!');

  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
