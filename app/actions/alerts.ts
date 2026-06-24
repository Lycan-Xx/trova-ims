'use server'

import { query } from '@/lib/db'
import { requireStoreAccess } from '@/lib/auth'
import { getStockSummary } from '@/app/actions/batches'
import type { StockSummaryRow } from '@/app/actions/batches'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExpiryAlert {
  batchId: string
  productId: string
  productName: string
  sku: string
  vendorName: string | null
  qtyRemaining: number
  expiryDate: string
  daysUntilExpiry: number
}

export interface LowStockAlert extends StockSummaryRow {
  lastVendorName: string | null
}

// ── getExpiryAlerts ────────────────────────────────────────────────────────────

export async function getExpiryAlerts(daysAhead: number = 30): Promise<
  { success: true; data: ExpiryAlert[] } | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `SELECT
         b.id            AS batch_id,
         p.id            AS product_id,
         p.name          AS product_name,
         p.sku,
         v.name          AS vendor_name,
         b.qty_remaining,
         b.expiry_date
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE
         b.store_id = $1
         AND b.qty_remaining > 0
         AND b.expiry_date IS NOT NULL
         AND b.expiry_date <= (NOW() + ($2 || ' days')::interval)
         AND b.expiry_date >= NOW()
       ORDER BY b.expiry_date ASC`,
      [user.store_id, daysAhead],
    )

    const now = Date.now()
    const MS_PER_DAY = 1000 * 60 * 60 * 24

    const data: ExpiryAlert[] = result.rows.map((row) => {
      const expiryMs = new Date(row.expiry_date as string).getTime()
      const daysUntilExpiry = Math.ceil((expiryMs - now) / MS_PER_DAY)

      return {
        batchId: row.batch_id as string,
        productId: row.product_id as string,
        productName: row.product_name as string,
        sku: row.sku as string,
        vendorName: (row.vendor_name as string | null) ?? null,
        qtyRemaining: row.qty_remaining as number,
        expiryDate: row.expiry_date as string,
        daysUntilExpiry,
      }
    })

    return { success: true, data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── getLowStockAlerts ─────────────────────────────────────────────────────────

export async function getLowStockAlerts(): Promise<
  { success: true; data: LowStockAlert[] } | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const summaryResult = await getStockSummary()
    if (!summaryResult.success) {
      return { success: false, error: summaryResult.error }
    }

    const lowOrOut = summaryResult.data.filter(
      (row) => row.status === 'low_stock' || row.status === 'out_of_stock',
    )

    if (lowOrOut.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch the last vendor name for each low-stock product in one query
    const productIds = lowOrOut.map((r) => r.productId)
    const placeholders = productIds.map((_, i) => `$${i + 2}`).join(', ')

    const vendorResult = await query(
      `SELECT DISTINCT ON (b.product_id)
         b.product_id,
         v.name AS vendor_name
       FROM batches b
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.store_id = $1
         AND b.product_id IN (${placeholders})
         AND b.vendor_id IS NOT NULL
       ORDER BY b.product_id, b.received_at DESC`,
      [user.store_id, ...productIds],
    )

    const vendorMap = new Map<string, string>()
    for (const row of vendorResult.rows) {
      vendorMap.set(row.product_id as string, row.vendor_name as string)
    }

    const data: LowStockAlert[] = lowOrOut
      .map((row) => ({
        ...row,
        lastVendorName: vendorMap.get(row.productId) ?? null,
      }))
      .sort((a, b) => a.currentStock - b.currentStock)

    return { success: true, data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
