import { NextRequest, NextResponse } from 'next/server'
import { withConnection } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const PURGE_STATEMENTS = [
    'DROP TABLE IF EXISTS sale_items CASCADE',
    'DROP TABLE IF EXISTS sales CASCADE',
    'DROP TABLE IF EXISTS batches CASCADE',
    'DROP TABLE IF EXISTS products CASCADE',
    'DROP TABLE IF EXISTS categories CASCADE',
    'DROP TABLE IF EXISTS vendors CASCADE',
    'DROP TABLE IF EXISTS users CASCADE',
    'DROP TABLE IF EXISTS stores CASCADE',
    'DROP TABLE IF EXISTS verification CASCADE',
    'DROP TABLE IF EXISTS account CASCADE',
    'DROP TABLE IF EXISTS session CASCADE',
    'DROP TABLE IF EXISTS "user" CASCADE',
    'DROP TYPE IF EXISTS user_role',
    'DROP TYPE IF EXISTS vendor_type',
    'DROP TYPE IF EXISTS unit_type',
  ]

  try {
    await withConnection(async (client) => {
      for (const stmt of PURGE_STATEMENTS) {
        await client.query(stmt)
      }
    })

    return NextResponse.json({
      ok: true,
      message: `Aurora purged: ${PURGE_STATEMENTS.length} statements executed. All tables, enums, and data deleted.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[purge] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
