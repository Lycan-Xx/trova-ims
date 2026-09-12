import type { PGlite } from '@electric-sql/pglite'
import { mkdir, readFile, rename, rm, writeFile, link, readdir } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export const DESKTOP_SALES_EXPORT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const EXPORT_RETRY_INTERVAL_MS = 60 * 60 * 1000
const RECORDS_DIRECTORY_NAME = 'Trova Records'
const EXPORT_STATE_FILENAME = 'sales-export-state.json'

type ExportState = {
  lastExportEndAt: string
}

type ExportResult = {
  success: boolean
  due: boolean
  nextDelayMs: number
  error?: string
}

type ExportRow = {
  created_at: string | Date
  receipt_number: string
  product_name: string
  qty_sold: number
  unit_price: string
  line_total: string
  payment_method: string
  sale_total: string
  cashier_name: string | null
}

export type SalesExportManifest = {
  version: 1
  storeId: string
  windowStart: string
  windowEnd: string
  csvFile: string
  sha256: string
  rows: number
  transactions: number
  receipts: string[]
  lineTotal: string
  saleTotal: string
  createdAt: string
}

type ExportDatabase = Pick<PGlite, 'query'>
const exportGlobal = globalThis as typeof globalThis & {
  __trovaSalesExportJobs?: Map<string, Promise<unknown>>
}
const exportJobs = exportGlobal.__trovaSalesExportJobs ??= new Map()

// Shared across route bundles and both close-time/scheduled entry points.
async function serializedExport(key: string, fn: () => Promise<ExportResult>): Promise<ExportResult> {
  const previous = exportJobs.get(key) ?? Promise.resolve()
  const job = previous.catch(() => {}).then(fn)
  exportJobs.set(key, job)
  try { return await job } finally {
    if (exportJobs.get(key) === job) exportJobs.delete(key)
  }
}

const schedulerGlobal = globalThis as typeof globalThis & {
  __trovaImsDesktopSalesExportScheduler?: { started: boolean }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function formatFolderDate(value: Date): string {
  return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`
}

function formatTime(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

function safePathPart(value: string, fallback: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')

  return safe && safe !== '.' && safe !== '..' ? safe : fallback
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvForRows(rows: ExportRow[]): string {
  const headers = [
    'Date',
    'Time',
    'Transaction ID',
    'Product',
    'Quantity',
    'Unit Price',
    'Subtotal',
    'Discount',
    'Payment Method',
    'Total',
    'Cashier',
  ]

  const lines: unknown[][] = [headers]
  for (const row of rows) {
    const createdAt = new Date(row.created_at)
    lines.push([
      formatIsoDate(createdAt),
      formatTime(createdAt),
      row.receipt_number,
      row.product_name,
      String(row.qty_sold),
      row.unit_price,
      row.line_total,
      '',
      row.payment_method,
      row.sale_total,
      row.cashier_name ?? '',
    ])
  }

  return `${lines.map((line) => line.map(csvValue).join(',')).join('\r\n')}\r\n`
}

function getDocumentsDirectory(): string {
  return process.env.TROVA_DOCUMENTS_DIR?.trim() || join(homedir(), 'Documents')
}

function getStatePath(dataDirectory: string): string {
  return join(dataDirectory, EXPORT_STATE_FILENAME)
}

async function readExportState(statePath: string): Promise<ExportState | null> {
  try {
    const parsed = JSON.parse(await readFile(statePath, 'utf8')) as Partial<ExportState>
    if (typeof parsed.lastExportEndAt !== 'string') throw new Error('Invalid sales export state. Preserve the state file for investigation.')
    const timestamp = new Date(parsed.lastExportEndAt).getTime()
    if (!Number.isFinite(timestamp)) throw new Error('Invalid sales export timestamp.')
    return { lastExportEndAt: parsed.lastExportEndAt }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeExportState(statePath: string, lastExportEndAt: Date): Promise<void> {
  const temporaryPath = `${statePath}.${process.pid}.tmp`
  await writeFile(
    temporaryPath,
    JSON.stringify({ lastExportEndAt: lastExportEndAt.toISOString() }, null, 2),
    'utf8',
  )
  await replaceFile(temporaryPath, statePath)
}

async function replaceFile(temporaryPath: string, targetPath: string): Promise<void> {
  try {
    await rename(temporaryPath, targetPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'EEXIST' && code !== 'EPERM') throw error
    await rm(targetPath, { force: true })
    await rename(temporaryPath, targetPath)
  }
}

async function writeSalesWindow(
  db: ExportDatabase,
  storeId: string,
  storeName: string,
  start: Date,
  end: Date,
): Promise<void> {
  const inconsistent = await db.query(
    `SELECT s.id FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
     WHERE s.store_id = $1 AND s.voided_at IS NULL AND s.created_at >= $2 AND s.created_at < $3
     GROUP BY s.id, s.total_amount
     HAVING COUNT(si.id) = 0 OR SUM(si.line_total) <> s.total_amount
       OR BOOL_OR(si.qty_sold <= 0 OR si.qty_sold * si.unit_price <> si.line_total)
     LIMIT 1`, [storeId, start.toISOString(), end.toISOString()],
  )
  if (inconsistent.rows.length) throw new Error('Sales integrity check failed. Preserve the database and investigate before exporting this window.')
  const result = await db.query(
    `SELECT
       s.created_at,
       s.receipt_number,
       p.name AS product_name,
       si.qty_sold,
       si.unit_price,
       si.line_total,
       s.payment_method,
       s.total_amount AS sale_total,
       u.name AS cashier_name
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.id
     JOIN products p ON p.id = si.product_id
     LEFT JOIN users u ON u.id = s.cashier_id
     WHERE s.store_id = $1
       AND s.voided_at IS NULL
       AND s.created_at >= $2
       AND s.created_at < $3
     ORDER BY s.created_at ASC, s.receipt_number ASC, p.name ASC, si.id ASC`,
    [storeId, start.toISOString(), end.toISOString()],
  )

  const rows = result.rows as unknown as ExportRow[]
  const folderName = `${safePathPart(storeName, 'Store')}_${formatFolderDate(new Date(end.getTime() - 1))}`
  const stamp = (date: Date) => date.toISOString().replace(/[:.]/g, '-')
  const fileName = `sales-${stamp(start)}-to-${stamp(end)}.csv`
  const directory = join(getDocumentsDirectory(), RECORDS_DIRECTORY_NAME, folderName)
  const targetPath = join(directory, fileName)
  await mkdir(directory, { recursive: true })
  const content = csvForRows(rows)
  await publishImmutableFile(targetPath, content)

  const receipts = [...new Set(rows.map((row) => row.receipt_number))].sort()
  const lineTotalCents = rows.reduce((sum, row) => sum + Math.round(Number(row.line_total) * 100), 0)
  const saleTotals = new Map<string, number>()
  for (const row of rows) saleTotals.set(row.receipt_number, Math.round(Number(row.sale_total) * 100))
  const saleTotalCents = [...saleTotals.values()].reduce((sum, value) => sum + value, 0)
  const manifest: SalesExportManifest = {
    version: 1,
    storeId,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    csvFile: fileName,
    sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    rows: rows.length,
    transactions: receipts.length,
    receipts,
    lineTotal: (lineTotalCents / 100).toFixed(2),
    saleTotal: (saleTotalCents / 100).toFixed(2),
    createdAt: new Date().toISOString(),
  }
  await publishImmutableFile(`${targetPath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`[desktop-sales-export] Wrote ${rows.length} line item(s) to ${targetPath}`)
}

async function collectManifestPaths(directory: string): Promise<string[]> {
  const paths: string[] = []
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return paths
    throw error
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await collectManifestPaths(path))
    else if (entry.isFile() && entry.name.endsWith('.csv.manifest.json')) paths.push(path)
  }
  return paths
}

export async function verifySalesArchiveCoverage(
  db: ExportDatabase,
  _dataDirectory: string,
  storeId: string,
  cutoff: Date,
): Promise<{ covered: boolean; missing: number }> {
  const activeSales = await db.query(
    `SELECT receipt_number FROM sales
     WHERE store_id = $1 AND voided_at IS NULL AND created_at < $2`,
    [storeId, cutoff.toISOString()],
  )
  const required = new Set((activeSales.rows as Array<{ receipt_number: string }>).map((row) => String(row.receipt_number)))
  if (!required.size) return { covered: true, missing: 0 }

  const covered = new Set<string>()
  const recordsDirectory = join(getDocumentsDirectory(), RECORDS_DIRECTORY_NAME)
  for (const manifestPath of await collectManifestPaths(recordsDirectory)) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<SalesExportManifest>
      if (
        manifest.version !== 1 || manifest.storeId !== storeId || !Array.isArray(manifest.receipts) ||
        typeof manifest.csvFile !== 'string' || typeof manifest.sha256 !== 'string'
      ) continue
      const csvPath = join(dirname(manifestPath), manifest.csvFile)
      const csvContent = await readFile(csvPath, 'utf8')
      if (createHash('sha256').update(csvContent, 'utf8').digest('hex') !== manifest.sha256) {
        console.error(`[desktop-sales-export] Hash mismatch for archive ${csvPath}`)
        continue
      }
      for (const receipt of manifest.receipts) covered.add(String(receipt))
    } catch (error) {
      console.error(`[desktop-sales-export] Ignoring unreadable archive manifest ${manifestPath}:`, error)
    }
  }
  const missing = [...required].filter((receipt) => !covered.has(receipt)).length
  return { covered: missing === 0, missing }
}

async function exportIfDue(
  db: ExportDatabase,
  dataDirectory: string,
  storeId: string,
  now = new Date(),
): Promise<ExportResult> {
  const statePath = getStatePath(dataDirectory)
  const state = await readExportState(statePath)
  const lastExportEnd = state ? new Date(state.lastExportEndAt) : null

  if (lastExportEnd && now.getTime() - lastExportEnd.getTime() < DESKTOP_SALES_EXPORT_INTERVAL_MS) {
    return {
      success: true,
      due: false,
      nextDelayMs: Math.max(1, DESKTOP_SALES_EXPORT_INTERVAL_MS - (now.getTime() - lastExportEnd.getTime())),
    }
  }

  try {
    const storeResult = await db.query(
      'SELECT name FROM stores WHERE id = $1 LIMIT 1',
      [storeId],
    )
    const storeName = String((storeResult.rows[0] as { name?: string } | undefined)?.name ?? 'Store')

    if (!lastExportEnd) {
      const oldestResult = await db.query(
        'SELECT MIN(created_at) AS oldest_sale FROM sales WHERE store_id = $1',
        [storeId],
      )
      const oldestValue = (oldestResult.rows[0] as { oldest_sale?: string | Date } | undefined)?.oldest_sale
      const oldestSale = oldestValue ? new Date(oldestValue) : null
      const start = oldestSale && Number.isFinite(oldestSale.getTime())
        ? oldestSale
        : new Date(now.getTime() - DESKTOP_SALES_EXPORT_INTERVAL_MS)

      await writeSalesWindow(db, storeId, storeName, start, now)
      await writeExportState(statePath, now)
      return { success: true, due: true, nextDelayMs: DESKTOP_SALES_EXPORT_INTERVAL_MS }
    }

    let cursor = lastExportEnd
    while (now.getTime() - cursor.getTime() >= DESKTOP_SALES_EXPORT_INTERVAL_MS) {
      const end = new Date(cursor.getTime() + DESKTOP_SALES_EXPORT_INTERVAL_MS)
      await writeSalesWindow(db, storeId, storeName, cursor, end)
      await writeExportState(statePath, end)
      cursor = end
    }

    return {
      success: true,
      due: true,
      nextDelayMs: Math.max(1, DESKTOP_SALES_EXPORT_INTERVAL_MS - (now.getTime() - cursor.getTime())),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[desktop-sales-export] Export failed: ${message}`)
    return { success: false, due: true, nextDelayMs: EXPORT_RETRY_INTERVAL_MS, error: message }
  }
}

async function exportNow(
  db: ExportDatabase,
  dataDirectory: string,
  storeId: string,
  now = new Date(),
): Promise<ExportResult> {
  const statePath = getStatePath(dataDirectory)
  const state = await readExportState(statePath)
  const lastExportEnd = state ? new Date(state.lastExportEndAt) : null

  // Nothing to flush if we already exported up to (or past) now — avoids
  // writing a near-empty file if this is called twice in quick succession
  // (e.g. the main window and an unrelated shutdown path both firing).
  if (lastExportEnd && now.getTime() - lastExportEnd.getTime() < 1000) {
    return { success: true, due: false, nextDelayMs: DESKTOP_SALES_EXPORT_INTERVAL_MS }
  }

  try {
    const storeResult = await db.query(
      'SELECT name FROM stores WHERE id = $1 LIMIT 1',
      [storeId],
    )
    const storeName = String((storeResult.rows[0] as { name?: string } | undefined)?.name ?? 'Store')

    let start = lastExportEnd
    if (!start) {
      const oldestResult = await db.query(
        'SELECT MIN(created_at) AS oldest_sale FROM sales WHERE store_id = $1',
        [storeId],
      )
      const oldestValue = (oldestResult.rows[0] as { oldest_sale?: string | Date } | undefined)?.oldest_sale
      const oldestSale = oldestValue ? new Date(oldestValue) : null
      start = oldestSale && Number.isFinite(oldestSale.getTime()) ? oldestSale : now
    }

    // Flushing early "closes out" the current window early; the next
    // scheduled weekly export simply resumes counting from `now`.
    await writeSalesWindow(db, storeId, storeName, start, now)
    await writeExportState(statePath, now)

    return { success: true, due: true, nextDelayMs: DESKTOP_SALES_EXPORT_INTERVAL_MS }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[desktop-sales-export] Close-time export failed: ${message}`)
    return { success: false, due: true, nextDelayMs: EXPORT_RETRY_INTERVAL_MS, error: message }
  }
}

async function exportSafely(db: PGlite, dataDirectory: string, storeId: string, now: Date, dueOnly: boolean): Promise<ExportResult> {
  return serializedExport(`${dataDirectory}:${storeId}`, async () => {
    try {
      // PGlite serializes a query against an active native transaction. The
      // exporter itself must not perform filesystem writes inside a DB
      // transaction: an archive can otherwise be published before commit.
      return await (dueOnly ? exportIfDue : exportNow)(db, dataDirectory, storeId, now)
    } catch (error) {
      return { success: false, due: true, nextDelayMs: EXPORT_RETRY_INTERVAL_MS, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

async function publishImmutableFile(targetPath: string, content: string): Promise<void> {
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' })
  try {
    try { await link(temporaryPath, targetPath) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await readFile(targetPath, 'utf8') !== content) {
        throw new Error(`An archive artifact already exists at ${targetPath} with different contents. It was preserved.`)
      }
    }
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function runDesktopSalesExportIfDue(db: PGlite, dataDirectory: string, storeId: string, now = new Date()): Promise<ExportResult> {
  return exportSafely(db, dataDirectory, storeId, now, true)
}

export async function runDesktopSalesExportNow(db: PGlite, dataDirectory: string, storeId: string, now = new Date()): Promise<ExportResult> {
  return exportSafely(db, dataDirectory, storeId, now, false)
}

export function scheduleDesktopSalesExport(
  db: PGlite,
  dataDirectory: string,
  storeId: string,
  initialDelayMs: number,
): void {
  if (schedulerGlobal.__trovaImsDesktopSalesExportScheduler?.started) return
  schedulerGlobal.__trovaImsDesktopSalesExportScheduler = { started: true }

  const scheduleNext = (delayMs: number) => {
    setTimeout(async () => {
      const result = await runDesktopSalesExportIfDue(db, dataDirectory, storeId)
      scheduleNext(result.success ? result.nextDelayMs : EXPORT_RETRY_INTERVAL_MS)
    }, Math.max(1, delayMs))
  }

  scheduleNext(initialDelayMs)
}
