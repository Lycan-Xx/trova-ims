'use server'

import { query } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'storekeeper' | 'cashier'
  is_active: boolean
  created_at: string
}

export interface PendingInvitation {
  id: string
  email: string
  role: 'owner' | 'storekeeper' | 'cashier'
  status: string
  created_at: string
  expires_at: string
}

// ── Send Invitation ────────────────────────────────────────────────────────

export async function sendInvitation(
  email: string,
  role: 'storekeeper' | 'cashier',
): Promise<{ success: true; invitationId: string } | { success: false; error: string }> {
  try {
    const owner = await requireOwner()

    const normalizedEmail = email.trim().toLowerCase()

    // Validate email
    if (!normalizedEmail.includes('@')) {
      return { success: false, error: 'Invalid email address' }
    }

    // Check if user already exists in store
    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1 AND store_id = $2`,
      [normalizedEmail, owner.store_id],
    )
    if (existingUser.rows.length > 0) {
      return { success: false, error: 'User already in your store' }
    }

    // Check if invitation already pending
    const existingInvite = await query(
      `SELECT id FROM invitations 
       WHERE email = $1 AND store_id = $2 AND status = 'pending'`,
      [normalizedEmail, owner.store_id],
    )
    if (existingInvite.rows.length > 0) {
      return { success: false, error: 'Invitation already sent to this email' }
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

    const result = await query(
      `INSERT INTO invitations (id, store_id, email, role, invited_by, token, status, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', $6, NOW())
       RETURNING id`,
      [owner.store_id, normalizedEmail, role, owner.id, token, expiresAt.toISOString()],
    )

    // TODO: Send email with invitation link
    // const invitationUrl = `${process.env.BETTER_AUTH_URL}/join?token=${token}`
    // await sendEmail(email, 'Join StockSmart', invitationUrl)

    return { success: true, invitationId: result.rows[0].id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send invitation'
    return { success: false, error: message }
  }
}

// ── Get Team Members ───────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<
  { success: true; data: TeamMember[] } | { success: false; error: string }
> {
  try {
    const owner = await requireOwner()

    const result = await query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE store_id = $1
       ORDER BY role DESC, name ASC`,
      [owner.store_id],
    )

    return {
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch team members'
    return { success: false, error: message }
  }
}

// ── Get Pending Invitations ────────────────────────────────────────────────

export async function getPendingInvitations(): Promise<
  { success: true; data: PendingInvitation[] } | { success: false; error: string }
> {
  try {
    const owner = await requireOwner()

    const result = await query(
      `SELECT id, email, role, status, created_at, expires_at
       FROM invitations
       WHERE store_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [owner.store_id],
    )

    return {
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        expires_at: row.expires_at,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch pending invitations'
    return { success: false, error: message }
  }
}

// ── Accept Invitation ──────────────────────────────────────────────────────

export async function acceptInvitation(
  token: string,
): Promise<{ success: true; storeId: string } | { success: false; error: string }> {
  try {
    // Get invitation by token
    const invitRes = await query(
      `SELECT id, email, role, store_id, expires_at, status
       FROM invitations
       WHERE token = $1
       LIMIT 1`,
      [token],
    )

    if (invitRes.rows.length === 0) {
      return { success: false, error: 'Invalid or expired invitation link' }
    }

    const invite = invitRes.rows[0]

    // Check if expired
    const expiresAt = new Date(invite.expires_at)
    if (expiresAt < new Date()) {
      return { success: false, error: 'Invitation has expired' }
    }

    // Check if already accepted
    if (invite.status !== 'pending') {
      return { success: false, error: 'Invitation has already been used' }
    }

    // Mark as accepted and create user row
    // (The auth handler will fill in auth_id when user signs up with this email)
    await query(
      `UPDATE invitations SET status = 'accepted' WHERE id = $1`,
      [invite.id],
    )

    await query(
      `INSERT INTO users (id, store_id, name, email, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, '', $2, $3, true, NOW())
       ON CONFLICT DO NOTHING`,
      [invite.store_id, invite.email, invite.role],
    )

    return { success: true, storeId: invite.store_id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept invitation'
    return { success: false, error: message }
  }
}

// ── Cancel Invitation ──────────────────────────────────────────────────────

export async function cancelInvitation(
  invitationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const owner = await requireOwner()

    await query(
      `UPDATE invitations 
       SET status = 'expired'
       WHERE id = $1 AND store_id = $2`,
      [invitationId, owner.store_id],
    )

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel invitation'
    return { success: false, error: message }
  }
}

// ── Update Team Member Role ────────────────────────────────────────────────

export async function updateMemberRole(
  memberId: string,
  newRole: 'storekeeper' | 'cashier',
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const owner = await requireOwner()

    // Prevent removing owner role (only one owner per store)
    const member = await query(
      `SELECT role FROM users WHERE id = $1 AND store_id = $2`,
      [memberId, owner.store_id],
    )

    if (member.rows.length === 0) {
      return { success: false, error: 'Member not found' }
    }

    if (member.rows[0].role === 'owner') {
      return { success: false, error: 'Cannot modify owner role' }
    }

    await query(
      `UPDATE users SET role = $1 WHERE id = $2 AND store_id = $3`,
      [newRole, memberId, owner.store_id],
    )

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update member role'
    return { success: false, error: message }
  }
}

// ── Remove Team Member ─────────────────────────────────────────────────────

export async function removeMember(
  memberId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const owner = await requireOwner()

    // Prevent removing owner
    const member = await query(
      `SELECT role FROM users WHERE id = $1 AND store_id = $2`,
      [memberId, owner.store_id],
    )

    if (member.rows.length === 0) {
      return { success: false, error: 'Member not found' }
    }

    if (member.rows[0].role === 'owner') {
      return { success: false, error: 'Cannot remove owner' }
    }

    await query(
      `UPDATE users SET is_active = false WHERE id = $1 AND store_id = $2`,
      [memberId, owner.store_id],
    )

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove member'
    return { success: false, error: message }
  }
}
