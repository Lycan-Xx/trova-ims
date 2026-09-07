import type { PGlite } from '@electric-sql/pglite'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

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

  const lines = [headers]
  for (const row of rows) {
    const createdAt = new Date(row.created_at)
    lines.push([
      formatIsoDate(createdAt),
      formatTime(createdAt),
      row.receipt_number,
      row.product_name,
      row.qty_sold,
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
    if (typeof parsed.lastExportEndAt !== 'string') return null
    const timestamp = new Date(parsed.lastExportEndAt).getTime()
    return Number.isFinite(timestamp) ? { lastExportEndAt: parsed.lastExportEndAt } : null
  } catch {
    return null
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
  db: PGlite,
  storeId: string,
  storeName: string,
  start: Date,
  end: Date,
): Promise<void> {
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
       AND s.created_at >= $2
       AND s.created_at < $3
     ORDER BY s.created_at ASC, s.receipt_number ASC, p.name ASC`,
    [storeId, start.toISOString(), end.toISOString()],
  )

  const rows = result.rows as unknown as ExportRow[]
  const folderName = `${safePathPart(storeName, 'Store')}_${formatFolderDate(new Date(end.getTime() - 1))}`
  const fileName = `sales-${formatIsoDate(start)}-to-${formatIsoDate(new Date(end.getTime() - 1))}.csv`
  const directory = join(getDocumentsDirectory(), RECORDS_DIRECTORY_NAME, folderName)
  const targetPath = join(directory, fileName)
  const temporaryPath = `${targetPath}.${process.pid}.tmp`

  await mkdir(directory, { recursive: true })
  await writeFile(temporaryPath, csvForRows(rows), 'utf8')
  await replaceFile(temporaryPath, targetPath)

  console.log(`[desktop-sales-export] Wrote ${rows.length} line item(s) to ${targetPath}`)
}

export async function runDesktopSalesExportIfDue(
  db: PGlite,
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

export async function runDesktopSalesExportNow(
  db: PGlite,
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
