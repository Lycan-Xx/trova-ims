'use server'

import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { query } from '@/lib/db'

// ── getSalesAnalytics ──────────────────────────────────────────────────────────

export interface DailyRevenue {
  date: string    // YYYY-MM-DD
  revenue: number
}

export interface TopProduct {
  productId: string
  name: string
  sku: string
  unitsSold: number
  revenue: number
  avgMargin: number
}

export interface SalesAnalytics {
  totalRevenue: number
  totalTransactions: number
  avgTransactionValue: number
  totalUnitsSold: number
  dailyRevenue: DailyRevenue[]
  topProducts: TopProduct[]
}

export async function getSalesAnalytics(
  dateFrom: string,
  dateTo: string,
): Promise<{ success: true; data: SalesAnalytics } | { success: false; error: string }> {
  const user = await requireOwner().catch(() => null)
  if (!user) redirect('/sign-in')

  try {
    // Summary stats
    const summaryRes = await query(
      `SELECT
         COALESCE(SUM(s.total_amount), 0)::float          AS total_revenue,
         COUNT(s.id)::int                                  AS total_transactions,
         COALESCE(SUM(si.qty_sold), 0)::int                AS total_units_sold
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.store_id = $1
         AND s.created_at::date >= $2::date
         AND s.created_at::date <= $3::date`,
      [user.store_id, dateFrom, dateTo],
    )
    const summary = summaryRes.rows[0]
    const totalRevenue = parseFloat(summary.total_revenue) || 0
    const totalTransactions = parseInt(summary.total_transactions) || 0
    const totalUnitsSold = parseInt(summary.total_units_sold) || 0
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    // Daily revenue
    const dailyRes = await query(
      `SELECT
         s.created_at::date::text AS date,
         SUM(s.total_amount)::float AS revenue
       FROM sales s
       WHERE s.store_id = $1
         AND s.created_at::date >= $2::date
         AND s.created_at::date <= $3::date
       GROUP BY s.created_at::date
       ORDER BY s.created_at::date ASC`,
      [user.store_id, dateFrom, dateTo],
    )
    const dailyRevenue: DailyRevenue[] = dailyRes.rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue) || 0,
    }))

    // Top 10 products by units sold, with avg margin
    const topRes = await query(
      `SELECT
         p.id                                                        AS "productId",
         p.name,
         p.sku,
         SUM(si.qty_sold)::int                                       AS "unitsSold",
         SUM(si.line_total)::float                                   AS revenue,
         AVG(
           CASE
             WHEN si.unit_price > 0
             THEN ((si.unit_price - b.cost_per_unit) / si.unit_price) * 100
             ELSE 0
           END
         )::float                                                    AS "avgMargin"
       FROM sale_items si
       JOIN sales s   ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       JOIN batches b  ON b.id = si.batch_id
       WHERE s.store_id = $1
         AND s.created_at::date >= $2::date
         AND s.created_at::date <= $3::date
       GROUP BY p.id, p.name, p.sku
       ORDER BY "unitsSold" DESC
       LIMIT 10`,
      [user.store_id, dateFrom, dateTo],
    )
    const topProducts: TopProduct[] = topRes.rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      unitsSold: parseInt(r.unitsSold) || 0,
      revenue: parseFloat(r.revenue) || 0,
      avgMargin: parseFloat(r.avgMargin) || 0,
    }))

    return {
      success: true,
      data: { totalRevenue, totalTransactions, avgTransactionValue, totalUnitsSold, dailyRevenue, topProducts },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sales analytics.'
    return { success: false, error: message }
  }
}

// ── getVendorAnalytics ─────────────────────────────────────────────────────────

export interface VendorAnalytics {
  vendorId: string
  vendorName: string
  vendorType: 'direct' | 'consignment'
  batchCount: number
  totalUnitsReceived: number
  totalPurchaseCost: number
  outstandingQty: number
}

export async function getVendorAnalytics(
  dateFrom: string,
  dateTo: string,
): Promise<{ success: true; data: VendorAnalytics[] } | { success: false; error: string }> {
  const user = await requireOwner().catch(() => null)
  if (!user) redirect('/sign-in')

  try {
    const res = await query(
      `SELECT
         v.id                                              AS "vendorId",
         v.name                                           AS "vendorName",
         v.type                                           AS "vendorType",
         COUNT(b.id)::int                                 AS "batchCount",
         COALESCE(SUM(b.qty_received), 0)::int            AS "totalUnitsReceived",
         COALESCE(SUM(b.total_purchase_cost), 0)::float   AS "totalPurchaseCost",
         COALESCE(SUM(
           CASE WHEN b.is_consignment THEN b.qty_remaining ELSE 0 END
         ), 0)::int                                       AS "outstandingQty"
       FROM vendors v
       LEFT JOIN batches b ON b.vendor_id = v.id
         AND b.received_at::date >= $2::date
         AND b.received_at::date <= $3::date
       WHERE v.store_id = $1
         AND v.is_active = true
       GROUP BY v.id, v.name, v.type
       ORDER BY "totalUnitsReceived" DESC`,
      [user.store_id, dateFrom, dateTo],
    )
    return {
      success: true,
      data: res.rows.map((r) => ({
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        vendorType: r.vendorType as 'direct' | 'consignment',
        batchCount: parseInt(r.batchCount) || 0,
        totalUnitsReceived: parseInt(r.totalUnitsReceived) || 0,
        totalPurchaseCost: parseFloat(r.totalPurchaseCost) || 0,
        outstandingQty: parseInt(r.outstandingQty) || 0,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch vendor analytics.'
    return { success: false, error: message }
  }
}

// ── getExpiryRisk ──────────────────────────────────────────────────────────────

export interface ExpiryRiskItem {
  batchId: string
  productName: string
  batchRef: string | null
  vendorName: string | null
  qtyRemaining: number
  expiryDate: string
  estValueAtRisk: number
}

export async function getExpiryRisk(): Promise<
  { success: true; data: ExpiryRiskItem[] } | { success: false; error: string }
> {
  const user = await requireOwner().catch(() => null)
  if (!user) redirect('/sign-in')

  try {
    const res = await query(
      `SELECT
         b.id                                                                  AS "batchId",
         p.name                                                               AS "productName",
         b.batch_ref                                                          AS "batchRef",
         v.name                                                               AS "vendorName",
         b.qty_remaining                                                      AS "qtyRemaining",
         b.expiry_date::text                                                  AS "expiryDate",
         (b.qty_remaining * COALESCE(b.selling_price_override, p.selling_price))::float
                                                                             AS "estValueAtRisk"
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.store_id = $1
         AND b.qty_remaining > 0
         AND b.expiry_date IS NOT NULL
       ORDER BY b.expiry_date ASC`,
      [user.store_id],
    )
    return {
      success: true,
      data: res.rows.map((r) => ({
        batchId: r.batchId,
        productName: r.productName,
        batchRef: r.batchRef,
        vendorName: r.vendorName,
        qtyRemaining: parseInt(r.qtyRemaining) || 0,
        expiryDate: r.expiryDate,
        estValueAtRisk: parseFloat(r.estValueAtRisk) || 0,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch expiry risk.'
    return { success: false, error: message }
  }
}
