import { betterAuth } from 'better-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { pool, query, IS_DESKTOP } from '@/lib/db'
import { DESKTOP_LOCAL_STORE_ID, DESKTOP_LOCAL_USER_ID } from '@/lib/db/desktop-init'
import { handleFirstSignUp } from '@/lib/auth/first-run'
import type { User, UserRole } from '@/lib/db/schema'

// ── Better Auth Configuration ─────────────────────────────────────────────────

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000'

// Build trusted origins list — includes production domain, preview domains, and custom domains
// See TRUSTED_ORIGINS_CONFIG below to add new domains
const TRUSTED_ORIGINS_CONFIG = [
  // Production domain (from env var or derived from VERCEL_PROJECT_PRODUCTION_URL)
  process.env.BETTER_AUTH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  // Vercel preview deployments
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  // Add custom domains here (e.g., 'https://your-custom-domain.com')
  // Users can also set TRUSTED_ORIGINS env var as comma-separated list
  ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',').map(o => o.trim()) : []),
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
]

const trustedOrigins = Array.from(
  new Set(TRUSTED_ORIGINS_CONFIG.filter(Boolean) as string[])
)

if (!process.env.BETTER_AUTH_SECRET && !IS_DESKTOP) {
  throw new Error(
    'BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32'
  )
}

// In desktop mode Better Auth is never initialised — the auth bypass below
// short-circuits every requireStoreAccess() / requireOwner() call before
// it reaches any Better Auth code, so this conditional stops the module
// from blowing up on startup when the secret isn't set.
export const auth = IS_DESKTOP ? null! : betterAuth({
  baseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  // Reuse the Aurora IAM-authenticated pool from lib/db — no DATABASE_URL needed
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session age every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    disableCSRFCheck: false,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      path: '/',
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await handleFirstSignUp(user.id, user.name || '', user.email || '')
          } catch (err) {
            console.error('[better-auth] handleFirstSignUp failed:', err)
            // Don't throw - let the user be created even if onboarding fails
          }
        },
      },
    },
  },
})

// ── App-level auth helpers ─────────────────────────────────────────────────────

/**
 * In DESKTOP_MODE: returns the seeded local owner row directly — no session
 * check, no network, no Better Auth. Every action file calls requireStoreAccess()
 * or requireOwner() which both flow through here, so this single check is the
 * only place that needs to know about desktop mode.
 *
 * In cloud mode: returns the app-level user row for the current Better Auth
 * session, keyed on the Better Auth user.id stored in users.auth_id.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (IS_DESKTOP) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true LIMIT 1',
      [DESKTOP_LOCAL_USER_ID],
    )
    return (result.rows[0] as User) ?? null
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) return null

    const result = await query(
      'SELECT * FROM users WHERE auth_id = $1 AND is_active = true LIMIT 1',
      [session.user.id],
    )
    if (result.rows.length === 0) return null
    return result.rows[0] as User
  } catch {
    return null
  }
})

export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (!allowedRoles.includes(user.role)) redirect('/dashboard?error=unauthorized')
  return user
}

export async function requireOwner(): Promise<User> {
  // Desktop owner has full access — role check still runs so nothing
  // silently bypasses role-gated paths, but the seeded user is 'owner'
  // so it always passes.
  return requireRole(['owner'])
}

export async function requireStoreAccess(): Promise<User> {
  return requireRole(['owner', 'storekeeper'])
}
