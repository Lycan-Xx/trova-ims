import { query } from '@/lib/db'

/**
 * Optional: Manual currency migration endpoint
 * GET /api/migrate-currency?secret=YOUR_MIGRATION_SECRET
 * 
 * This adds the currency column to stores table if it doesn't exist.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    // Add currency column if it doesn't exist
    // Sets default to 'NGN' for existing stores
    await query(`
      ALTER TABLE stores
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'NGN' NOT NULL;
    `)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Currency column added/verified successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Migration failed'
    console.error('Currency migration error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
