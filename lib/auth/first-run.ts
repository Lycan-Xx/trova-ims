import { query } from '@/lib/db'

/**
 * Called after a successful Better Auth sign-up.
 *
 * - Checks if a pending invite row exists for this email → links it to the
 *   new auth_id and activates the account with their assigned role.
 * - If NOT invited: creates a new "My Store" store and assigns the new user
 *   the 'owner' role so they can manage their own store.
 */
export async function handleFirstSignUp(
  authId: string,
  name: string,
  email: string,
): Promise<void> {
  try {
    const normalizedEmail = email.trim().toLowerCase()

    // Check for a pending invite row for this email
    const inviteRes = await query(
      `SELECT id, role, store_id FROM users WHERE email = $1 AND auth_id IS NULL LIMIT 1`,
      [normalizedEmail],
    )

    if (inviteRes.rows.length > 0) {
      // Activate the pending invite row with their assigned role
      const invitedRole = inviteRes.rows[0].role
      await query(
        `UPDATE users SET auth_id = $1, name = $2, is_active = true WHERE email = $3 AND auth_id IS NULL`,
        [authId, name, normalizedEmail],
      )
      console.log(`[auth] Activated pending invite for ${normalizedEmail} with role: ${invitedRole}`)
      return
    }

    // No pending invite — this is a new independent sign-up
    // Create a new store for this user and make them an owner
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
    console.log(`[auth] Created new user as owner: ${normalizedEmail} (store: ${storeId})`)
  } catch (err) {
    console.error(`[auth] handleFirstSignUp failed for ${email}:`, err)
    throw err
  }
}
