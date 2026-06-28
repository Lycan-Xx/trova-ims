import { betterAuth } from 'better-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { pool, query } from '@/lib/db'
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

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
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
 * Returns the app-level user row (with role + storeId) for the current
 * Better Auth session, keyed on the Better Auth user.id stored in our
 * users.auth_id column.
 */
export async function getCurrentUser(): Promise<User | null> {
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
}

export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (!allowedRoles.includes(user.role)) throw new Response('Forbidden', { status: 403 })
  return user
}

export async function requireOwner(): Promise<User> {
  return requireRole(['owner'])
}

export async function requireStoreAccess(): Promise<User> {
  return requireRole(['owner', 'storekeeper'])
}
