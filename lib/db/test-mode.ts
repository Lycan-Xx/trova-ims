// lib/db/test-mode.ts
//
// Desktop-only "Test Mode" toggle. When enabled, query()/withConnection()
// in lib/db/index.ts route to the isolated test PGlite database
// (getDesktopTestDb() in desktop-init.ts) instead of the real one — so
// sales and products created while testing never touch the real store
// ledger. Toggling off simply routes back to the real database; nothing
// about the real data is touched by flipping this switch either way.
//
// State is a small JSON file next to the databases (not a database row —
// deliberately, since it needs to be readable before deciding which
// database to open) and cached in memory to avoid a disk read on every
// query.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getDbPath } from './desktop-init'

function getStatePath(): string {
  return join(dirname(getDbPath()), 'test-mode-state.json')
}

let cachedEnabled: boolean | null = null

export function isTestModeEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled
  try {
    const parsed = JSON.parse(readFileSync(getStatePath(), 'utf8')) as { enabled?: boolean }
    cachedEnabled = parsed.enabled === true
  } catch {
    cachedEnabled = false
  }
  return cachedEnabled
}

export function setTestModeEnabled(enabled: boolean): void {
  cachedEnabled = enabled
  const statePath = getStatePath()
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify({ enabled }, null, 2), 'utf8')
}
