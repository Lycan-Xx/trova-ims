import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/desktop',
  '/api/migrate',
  '/api/purge',
  '/api/test-suite',
  '/api/webhooks',
  '/privacy',
  '/landing',
]

export function middleware(request: NextRequest) {
  // In DESKTOP_MODE there's no session cookie — the app is single-user
  // with no sign-in. Make server-side routing authoritative: when the
  // app is running in desktop mode, redirect the root path to /dashboard
  // and skip auth gating for all other routes.
  // Use runtime env check instead of IS_DESKTOP constant to avoid
  // importing lib/db which contains Node.js APIs incompatible with Edge Runtime.
  if (process.env.DESKTOP_MODE === 'true') {
    const { pathname } = request.nextUrl
    if (
      pathname === '/' ||
      pathname === '/sign-in' ||
      pathname === '/sign-up' ||
      pathname === '/join' ||
      pathname === '/landing' ||
      pathname === '/privacy'
    ) {
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Always allow public paths and root
  if (pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for a Better Auth session cookie (plain or Secure-prefixed)
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
