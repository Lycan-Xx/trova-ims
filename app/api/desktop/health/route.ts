import { NextResponse } from 'next/server'
import { access, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import {
  DESKTOP_LOCAL_STORE_ID,
  DESKTOP_LOCAL_USER_ID,
  getDesktopDb,
} from '@/lib/db/desktop-init'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type HealthCheck = {
  name: string
  ok: boolean
  detail?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runCheck(name: string, fn: () => Promise<string | void>): Promise<HealthCheck> {
  try {
    const detail = await fn()
    return detail ? { name, ok: true, detail } : { name, ok: true }
  } catch (error) {
    return { name, ok: false, detail: errorMessage(error) }
  }
}

export async function GET() {
  const dataDir = process.env.TROVA_DATA_DIR
  const schemaPath = join(process.cwd(), 'scripts', 'desktop-schema.sql')
  const checks: HealthCheck[] = []

  checks.push({
    name: 'desktop-mode',
    ok: process.env.DESKTOP_MODE === 'true',
    detail: process.env.DESKTOP_MODE === 'true' ? undefined : 'DESKTOP_MODE is not true',
  })

  checks.push({
    name: 'desktop-version',
    ok: true,
    detail: process.env.TROVA_DESKTOP_VERSION ?? 'unknown',
  })

  if (dataDir) {
    checks.push(await runCheck('data-dir', async () => {
      await mkdir(dataDir, { recursive: true })
      await access(dataDir, constants.W_OK)
      return dataDir
    }))
  } else {
    checks.push({ name: 'data-dir', ok: false, detail: 'TROVA_DATA_DIR is not set' })
  }

  checks.push(await runCheck('desktop-schema', async () => {
    await access(schemaPath, constants.R_OK)
    return schemaPath
  }))

  if (checks.some((check) => !check.ok)) {
    return NextResponse.json({ ok: false, checks }, { status: 503 })
  }

  checks.push(await runCheck('database', async () => {
    const db = await getDesktopDb()
    await db.query('SELECT 1')
  }))

  checks.push(await runCheck('seed-data', async () => {
    const db = await getDesktopDb()
    const result = await db.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM stores WHERE id = $1) AS stores,
          (SELECT COUNT(*)::int FROM users WHERE id = $2 AND is_active = true) AS users
      `,
      [DESKTOP_LOCAL_STORE_ID, DESKTOP_LOCAL_USER_ID],
    )
    const row = result.rows[0] as { stores?: number; users?: number } | undefined
    if (row?.stores !== 1 || row?.users !== 1) {
      throw new Error('Desktop seed store/user rows are missing')
    }
  }))

  const ok = checks.every((check) => check.ok)
  return NextResponse.json(
    {
      ok,
      version: process.env.TROVA_DESKTOP_VERSION ?? 'unknown',
      checks,
    },
    { status: ok ? 200 : 503 },
  )
}
