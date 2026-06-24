'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { requireOwner, getCurrentUser } from '@/lib/auth'
import type { User, UserRole } from '@/lib/db/schema'

// ── updateStoreSettings ────────────────────────────────────────────────────────

export async function updateStoreSettings(formData: {
  name: string
  address?: string
  phone?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireOwner()

  const { name, address, phone } = formData

  if (!name?.trim()) return { success: false, error: 'Store name is required.' }
  if (name.trim().length > 120) return { success: false, error: 'Store name must be 120 characters or fewer.' }

  try {
    await query(
      `UPDATE stores
       SET name = $1, address = $2, phone = $3
       WHERE id = $4`,
      [name.trim(), address?.trim() || null, phone?.trim() || null, user.store_id],
    )
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update store settings.'
    return { success: false, error: message }
  }
}

// ── getStoreSettings ───────────────────────────────────────────────────────────

export async function getStoreSettings(): Promise<
  { success: true; data: { id: string; name: string; address: string | null; phone: string | null } } |
  { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  try {
    const res = await query(
      'SELECT id, name, address, phone FROM stores WHERE id = $1 LIMIT 1',
      [user.store_id],
    )
    if (res.rows.length === 0) return { success: false, error: 'Store not found.' }
    return { success: true, data: res.rows[0] as { id: string; name: string; address: string | null; phone: string | null } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch store settings.'
    return { success: false, error: message }
  }
}

// ── getUsers ───────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<
  { success: true; data: User[] } | { success: false; error: string }
> {
  const user = await requireOwner()

  try {
    const res = await query(
      `SELECT id, clerk_id, store_id, name, email, role, is_active, created_at
       FROM users
       WHERE store_id = $1
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'storekeeper' THEN 1 ELSE 2 END ASC,
         name ASC`,
      [user.store_id],
    )
    return { success: true, data: res.rows as User[] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users.'
    return { success: false, error: message }
  }
}

// ── updateUserRole ─────────────────────────────────────────────────────────────

export async function updateUserRole(
  targetUserId: string,
  role: 'storekeeper' | 'cashier',
): Promise<{ success: true } | { success: false; error: string }> {
  const currentUser = await requireOwner()

  if (targetUserId === currentUser.id) {
    return { success: false, error: 'You cannot change your own role.' }
  }

  try {
    // Fetch target user — must belong to same store
    const targetRes = await query(
      'SELECT id, role, store_id FROM users WHERE id = $1 AND store_id = $2 LIMIT 1',
      [targetUserId, currentUser.store_id],
    )
    if (targetRes.rows.length === 0) return { success: false, error: 'User not found.' }

    const target = targetRes.rows[0] as { id: string; role: UserRole; store_id: string }

    // If the target is currently an owner, ensure at least one owner remains
    if (target.role === 'owner') {
      const ownerCountRes = await query(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE store_id = $1 AND role = 'owner' AND is_active = true`,
        [currentUser.store_id],
      )
      const ownerCount: number = ownerCountRes.rows[0].count
      if (ownerCount <= 1) {
        return { success: false, error: 'Cannot demote the last owner. Promote another user first.' }
      }
    }

    await query(
      'UPDATE users SET role = $1 WHERE id = $2 AND store_id = $3',
      [role, targetUserId, currentUser.store_id],
    )
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update user role.'
    return { success: false, error: message }
  }
}

// ── deactivateUser ─────────────────────────────────────────────────────────────

export async function deactivateUser(
  targetUserId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const currentUser = await requireOwner()

  if (targetUserId === currentUser.id) {
    return { success: false, error: 'You cannot deactivate your own account.' }
  }

  try {
    const res = await query(
      'UPDATE users SET is_active = false WHERE id = $1 AND store_id = $2 RETURNING id',
      [targetUserId, currentUser.store_id],
    )
    if (res.rows.length === 0) return { success: false, error: 'User not found.' }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate user.'
    return { success: false, error: message }
  }
}

// ── inviteUser ─────────────────────────────────────────────────────────────────

export async function inviteUser(
  email: string,
  role: 'storekeeper' | 'cashier',
): Promise<{ success: true } | { success: false; error: string }> {
  const currentUser = await requireOwner()

  if (!email?.trim()) return { success: false, error: 'Email is required.' }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  try {
    // Check if this email is already on this store
    const existingRes = await query(
      'SELECT id FROM users WHERE store_id = $1 AND email = $2 LIMIT 1',
      [currentUser.store_id, email.trim().toLowerCase()],
    )
    if (existingRes.rows.length > 0) {
      return { success: false, error: 'This email is already a member of your store.' }
    }

    const client = await clerkClient()
    await client.invitations.createInvitation({
      emailAddress: email.trim().toLowerCase(),
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/sign-up`,
      publicMetadata: {
        invited_role: role,
        store_id: currentUser.store_id,
      },
    })

    return { success: true }
  } catch (err: unknown) {
    // Clerk throws structured errors
    if (
      err &&
      typeof err === 'object' &&
      'errors' in err &&
      Array.isArray((err as { errors: Array<{ message: string }> }).errors)
    ) {
      const msg = (err as { errors: Array<{ message: string }> }).errors[0]?.message
      return { success: false, error: msg ?? 'Invitation failed.' }
    }
    const message = err instanceof Error ? err.message : 'Failed to send invitation.'
    return { success: false, error: message }
  }
}
