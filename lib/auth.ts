import { betterAuth } from 'better-auth'
import { Pool } from 'pg'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { handleFirstSignUp } from '@/lib/auth/first-run'
import type { User, UserRole } from '@/lib/db/schema'

// ── Better Auth instance ───────────────────────────────────────────────────────

const productionURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  process.env.V0_RUNTIME_URL ??
  'http://localhost:3000'

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined,
      process.env.V0_RUNTIME_URL,
      'http://localhost:3000',
    ].filter(Boolean) as string[],
  ),
)

export const auth = betterAuth({
  baseURL: productionURL,
  trustedOrigins,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  advanced: {
    ...(process.env.NODE_ENV === 'development' && {
      defaultCookieAttributes: {
        sameSite: 'none' as const,
        secure: true,
      },
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await handleFirstSignUp(user.id, user.name, user.email)
          } catch (err) {
            console.error('[auth] handleFirstSignUp failed:', err)
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
