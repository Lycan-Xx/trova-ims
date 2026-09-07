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
  '/demo',
]

export function proxy(request: NextRequest) {
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
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  if (pathname === '/' || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

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
