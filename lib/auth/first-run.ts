import { query } from '@/lib/db'

/**
 * Called from the Clerk webhook on user.created.
 *
 * - If the users table is empty: creates a "My Store" store and assigns the
 *   new user the 'owner' role linked to that store.
 * - If users already exist: creates the user as 'cashier' (an owner can
 *   promote them later).
 */
export async function handleFirstSignUp(
  clerkId: string,
  name: string,
  email: string,
): Promise<void> {
  // Check whether any user already exists
  const countResult = await query('SELECT COUNT(*)::int AS count FROM users')
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
      `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', true, NOW())`,
      [clerkId, storeId, name, email],
    )
  } else {
    // Subsequent sign-ups: role is 'cashier' until an owner promotes them.
    // We don't yet know which store they belong to — store_id is temporarily
    // set to the first store found. An owner can reassign later.
    const storeResult = await query(
      'SELECT id FROM stores ORDER BY created_at ASC LIMIT 1',
    )
    const storeId: string = storeResult.rows[0]?.id

    if (!storeId) {
      throw new Error('No store found for new user assignment')
    }

    await query(
      `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'cashier', true, NOW())`,
      [clerkId, storeId, name, email],
    )
  }
}
