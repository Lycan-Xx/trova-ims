import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { handleFirstSignUp } from '@/lib/auth/first-run'

// Clerk signs webhook payloads with CLERK_WEBHOOK_SECRET.
// Add this env var in your Vercel project settings (Clerk dashboard → Webhooks).
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    first_name: string | null
    last_name: string | null
    email_addresses: Array<{ email_address: string; id: string }>
    primary_email_address_id: string
  }
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not set')
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  // Verify the Svix signature
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing svix headers', { status: 400 })
  }

  const payload = await req.text()

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: ClerkUserCreatedEvent

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent
  } catch (err) {
    console.error('[clerk-webhook] Signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (event.type !== 'user.created') {
    // Acknowledge other events without acting on them
    return NextResponse.json({ received: true })
  }

  const { id: clerkId, first_name, last_name, email_addresses, primary_email_address_id } =
    event.data

  const primaryEmail = email_addresses.find(
    (e) => e.id === primary_email_address_id,
  )?.email_address ?? email_addresses[0]?.email_address ?? ''

  const name = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail

  try {
    await handleFirstSignUp(clerkId, name, primaryEmail)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[clerk-webhook] handleFirstSignUp failed:', err)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
