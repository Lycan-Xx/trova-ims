import { NextResponse } from 'next/server'
import { dirname } from 'node:path'
import { DESKTOP_LOCAL_STORE_ID, getDbPath, getDesktopDb } from '@/lib/db/desktop-init'
import { runDesktopSalesExportNow } from '@/lib/desktop-sales-export'

// Called by the Tauri shell as part of the main-window close sequence (see
// src-tauri/src/main.rs, trigger_export_now) so a CSV backup exists even if
// the store closes the app between scheduled weekly exports. Loopback-only —
// the local server only binds 127.0.0.1, so no auth is needed here, matching
// /api/desktop/health.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (process.env.DESKTOP_MODE !== 'true') {
    return NextResponse.json({ success: false, error: 'Not running in desktop mode.' }, { status: 404 })
  }

  try {
    const db = await getDesktopDb()
    const result = await runDesktopSalesExportNow(db, dirname(getDbPath()), DESKTOP_LOCAL_STORE_ID)
    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, due: true, error: message }, { status: 500 })
  }
}
