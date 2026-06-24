import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import type { User, UserRole } from '@/lib/db/schema'

/**
 * Returns the full user row from the database (including role and storeId)
 * for the currently authenticated Clerk session, or null if unauthenticated
 * or the user record does not yet exist in the DB.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth()

  if (!clerkId) return null

  const result = await query(
    'SELECT * FROM users WHERE clerk_id = $1 AND is_active = true LIMIT 1',
    [clerkId],
  )

  if (result.rows.length === 0) return null

  return result.rows[0] as User
}

/**
 * Asserts that the current user is authenticated and has one of the allowed
 * roles. Redirects to /sign-in if not authenticated; throws a 403 Response
 * if authenticated but not authorised.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Response('Forbidden', { status: 403 })
  }

  return user
}

/**
 * Requires the current user to be an owner.
 */
export async function requireOwner(): Promise<User> {
  return requireRole(['owner'])
}

/**
 * Requires the current user to be an owner or storekeeper.
 */
export async function requireStoreAccess(): Promise<User> {
  return requireRole(['owner', 'storekeeper'])
}
