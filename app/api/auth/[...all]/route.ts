import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextRequest, NextResponse } from 'next/server'
import { IS_DESKTOP } from '@/lib/db'

export const dynamic = 'force-dynamic'

const desktopHandler = async () => {
  return NextResponse.redirect(new URL('/dashboard', 'http://localhost'))
}

const { GET: betterAuthGET, POST: betterAuthPOST } = toNextJsHandler(auth.handler)

// Wrap handlers to provide better error messages
export async function GET(request: NextRequest) {
  if (IS_DESKTOP) {
    return desktopHandler()
  }
  try {
    return await betterAuthGET(request)
  } catch (err) {
    console.error('[auth-api-get] Error:', err)
    const message = err instanceof Error ? err.message : String(err)
    
    // Provide helpful error messages for common issues
    if (message.includes('Invalid origin')) {
      const origin = request.headers.get('origin') || 'unknown'
      console.error(`[auth-api-get] Invalid origin: ${origin}. Add it to TRUSTED_ORIGINS in Vercel env vars.`)
      return NextResponse.json(
        { 
          error: 'Origin not allowed',
          details: `The origin ${origin} is not in the trusted origins list. Contact your administrator to add it.`,
          origin,
        },
        { status: 403 }
      )
    }
    
    throw err
  }
}

export async function POST(request: NextRequest) {
  if (IS_DESKTOP) {
    return desktopHandler()
  }
  try {
    return await betterAuthPOST(request)
  } catch (err) {
    console.error('[auth-api-post] Error:', err)
    const message = err instanceof Error ? err.message : String(err)
    
    // Provide helpful error messages for common issues
    if (message.includes('Invalid origin')) {
      const origin = request.headers.get('origin') || 'unknown'
      console.error(`[auth-api-post] Invalid origin: ${origin}. Add it to TRUSTED_ORIGINS in Vercel env vars.`)
      return NextResponse.json(
        { 
          error: 'Origin not allowed',
          details: `The origin ${origin} is not in the trusted origins list. Contact your administrator to add it.`,
          origin,
        },
        { status: 403 }
      )
    }
    
    if (message.includes('Invalid credentials') || message.includes('email')) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    if (message.includes('already exists')) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 400 }
      )
    }
    
    throw err
  }
}
