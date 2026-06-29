import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/migrate',
  '/api/purge',
  '/api/test-suite',
  '/api/webhooks',
  '/privacy',
]

export function middleware(request: NextRequest) {
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
