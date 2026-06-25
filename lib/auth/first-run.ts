import { query } from '@/lib/db'

/**
 * Called after a successful Better Auth sign-up.
 *
 * - Checks if a pending invite row exists for this email → links it to the
 *   new auth_id and activates the account.
 * - If the users table is empty: creates a "My Store" store and assigns the
 *   new user the 'owner' role.
 * - Otherwise: creates the user as 'cashier' (an owner can promote them later).
 */
export async function handleFirstSignUp(
  authId: string,
  name: string,
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()

  // Check for a pending invite row for this email
  const inviteRes = await query(
    `SELECT id FROM users WHERE email = $1 AND auth_id IS NULL LIMIT 1`,
    [normalizedEmail],
  )

  if (inviteRes.rows.length > 0) {
    // Activate the pending invite row
    await query(
      `UPDATE users SET auth_id = $1, name = $2, is_active = true WHERE email = $3 AND auth_id IS NULL`,
      [authId, name, normalizedEmail],
    )
    return
  }

  // Check whether any active user already exists
  const countResult = await query(`SELECT COUNT(*)::int AS count FROM users WHERE is_active = true`)
  const userCount: number = countResult.rows[0].count

  if (userCount === 0) {
    // First ever sign-up — bootstrap the store and make this user the owner
    const storeResult = await query(
      `INSERT INTO stores (id, name, address, phone, created_at)
       VALUES (gen_random_uuid(), $1, NULL, NULL, NOW())
       RETURNING id`,
      ['My Store'],
    )
    const storeId: string = storeResult.rows[0].id

    await query(
      `INSERT INTO users (id, auth_id, store_id, name, email, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', true, NOW())`,
      [authId, storeId, name, normalizedEmail],
    )
  } else {
    // Subsequent sign-ups without a pending invite
    const storeResult = await query('SELECT id FROM stores ORDER BY created_at ASC LIMIT 1')
    const storeId: string = storeResult.rows[0]?.id
    if (!storeId) throw new Error('No store found for new user assignment')

    await query(
      `INSERT INTO users (id, auth_id, store_id, name, email, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'cashier', true, NOW())`,
      [authId, storeId, name, normalizedEmail],
    )
  }
}
