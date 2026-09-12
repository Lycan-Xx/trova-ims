'use server'

import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query, withTransaction } from '@/lib/db'
import { generateReceiptNumber } from '@/lib/db/helpers'
import type { ClientBase } from 'pg'
import { normalizeCart, moneyCents, resolveSaleDeductions, quoteFromDeductions, type CartItem, type SaleDeduction, type SaleQuote } from '@/lib/sales-pricing'
import { BUSINESS_UTC_OFFSET } from '@/lib/business-date'
export type { CartItem, SaleQuote } from '@/lib/sales-pricing'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SaleItemResult {
  productId: string
  productName: string
  batchId: string | null
  batchRef: string | null
  qtySold: number
  unitPrice: string
  lineTotal: string
}

export interface SaleResult {
  saleId: string
  receiptNumber: string
  totalAmount: string
  changeGiven: string | null
  paymentMethod: string
  items: SaleItemResult[]
}

export interface SaleRow {
  id: string
  store_id: string
  receipt_number: string
  cashier_id: string | null
  cashier_name: string | null
  total_amount: string
  amount_paid: string | null
  change_given: string | null
  payment_method: string
  notes: string | null
  voided_at: string | null
  voided_by_id: string | null
  void_reason: string | null
  created_at: string
  sales_date: string
  items_count: number
}

export interface SaleDetail extends SaleRow {
  items: SaleItemResult[]
}

export interface SalesSummary {
  totalRevenue: number
  transactionCount: number
  totalUnitsSold: number
}

export interface SalesDayTotal {
  date: string
  transactionCount: number
  revenue: number
}

export interface SalesCsvRow {
  createdAt: string
  receiptNumber: string
  productName: string
  qtySold: number
  unitPrice: string
  lineTotal: string
  paymentMethod: string
  saleTotal: string
  cashierName: string | null
}

async function getExistingSaleForRequest(
  client: ClientBase,
  storeId: string,
  requestId: string,
): Promise<SaleResult | null> {
  const saleRes = await client.query(
    `SELECT id, receipt_number, total_amount, change_given, payment_method
     FROM sales
     WHERE store_id = $1 AND client_request_id = $2
     LIMIT 1`,
    [storeId, requestId],
  )
  const sale = saleRes.rows[0]
  if (!sale) return null

  const itemsRes = await client.query(
    `SELECT si.product_id, p.name AS product_name, si.batch_id, b.batch_ref,
            si.qty_sold, si.unit_price, si.line_total
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE si.sale_id = $1
     ORDER BY si.id`,
    [sale.id],
  )

  return {
    saleId: sale.id,
    receiptNumber: sale.receipt_number,
    totalAmount: sale.total_amount,
    changeGiven: sale.change_given,
    paymentMethod: sale.payment_method,
    items: itemsRes.rows.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      batchId: item.batch_id,
      batchRef: item.batch_ref,
      qtySold: item.qty_sold,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
  }
}

// ── createSale ─────────────────────────────────────────────────────────────────

export async function getSaleByRequestId(
  requestId: string,
): Promise<{ success: true; data: { saleId: string; receiptNumber: string; voidedAt: string | null } | null } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (!requestId || requestId.length > 128) return { success: false, error: 'Invalid checkout request.' }

  try {
    const result = await query(
      `SELECT id, receipt_number, voided_at
       FROM sales
       WHERE store_id = $1 AND client_request_id = $2
       LIMIT 1`,
      [user.store_id, requestId],
    )
    const sale = result.rows[0]
    return {
      success: true,
      data: sale ? {
        saleId: String(sale.id),
        receiptNumber: String(sale.receipt_number),
        voidedAt: sale.voided_at ? String(sale.voided_at) : null,
      } : null,
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not check checkout status.' }
  }
}

export async function createSale(
  cartItems: CartItem[],
  paymentMethod: 'cash' | 'transfer' | 'pos',
  amountPaid: number,
  requestId: string,
  expectedTotal: number,
): Promise<{ success: true; data: SaleResult } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'Cart is empty.' }
  }
  if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 128) {
    return { success: false, error: 'Invalid checkout request.' }
  }

  if (!['cash', 'transfer', 'pos'].includes(paymentMethod)) return { success: false, error: 'Invalid payment method.' }
  try {
    cartItems = normalizeCart(cartItems)
    moneyCents(expectedTotal)
    const result = await withTransaction(async (client: ClientBase) => {

      try {
        // A retry after a slow or interrupted response must return the first
        // completed sale instead of recording the basket again.
        const existingSale = await getExistingSaleForRequest(client, user.store_id, requestId)
        if (existingSale) {
          return existingSale
        }

        let allDeductions: SaleDeduction[]
        try {
          allDeductions = await resolveSaleDeductions(client, user.store_id, cartItems)
        } catch (error) {
          // A concurrent retry may have used the final units while we waited
          // for product/batch locks. Return that committed receipt if present.
          if (error instanceof Error && error.message.startsWith('Insufficient stock')) {
            const completed = await getExistingSaleForRequest(client, user.store_id, requestId)
            if (completed) return completed
          }
          throw error
        }
        const completed = await getExistingSaleForRequest(client, user.store_id, requestId)
        if (completed) return completed
        const totalAmount = Number(quoteFromDeductions(allDeductions).totalAmount)
        if (moneyCents(expectedTotal) !== moneyCents(totalAmount)) {
          throw new Error('Price changed. Refresh the quote and confirm the new total before completing the sale.')
        }

        if (
          paymentMethod === 'cash' &&
          (!Number.isFinite(amountPaid) || Math.round(amountPaid * 100) !== Math.round(totalAmount * 100))
        ) {
          throw new Error('Cash amount received must match the sale total exactly.')
        }

        const changeGiven =
          paymentMethod === 'cash' ? amountPaid - totalAmount : null

        // Receipt number with retry on collision
        let receiptNumber = generateReceiptNumber()
        let attempt = 0
        while (attempt < 5) {
          const existing = await client.query(
            'SELECT id FROM sales WHERE receipt_number = $1 LIMIT 1',
            [receiptNumber],
          )
          if (existing.rows.length === 0) break
          receiptNumber = generateReceiptNumber(Math.floor(Math.random() * 10000))
          attempt++
        }

        const saleRes = await client.query(
          `INSERT INTO sales
             (id, store_id, receipt_number, cashier_id, total_amount,
              amount_paid, change_given, payment_method, notes, client_request_id, created_at)
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NULL, $8, NOW())
           ON CONFLICT (store_id, client_request_id) DO NOTHING
           RETURNING id, receipt_number, total_amount, change_given, payment_method`,
          [
            user.store_id,
            receiptNumber,
            user.id,
            totalAmount.toFixed(2),
            paymentMethod === 'cash' ? amountPaid.toFixed(2) : null,
            changeGiven !== null ? changeGiven.toFixed(2) : null,
            paymentMethod,
            requestId,
          ],
        )

        if (saleRes.rows.length === 0) {
          const existingSale = await getExistingSaleForRequest(client, user.store_id, requestId)
          if (!existingSale) throw new Error('A matching sale could not be found.')
          return existingSale
        }

        const sale = saleRes.rows[0]

        // ── STEP 3: Insert Sale Items + Decrement Batch Quantities ───────────
        const saleItemResults: SaleItemResult[] = []

        // Merge deductions for same batch (shouldn't happen but defensive)
        const mergedDeductions = new Map<string, SaleDeduction>()
        for (const d of allDeductions) {
          const key = d.batchId ?? `untracked:${d.productId}:${d.unitPrice.toFixed(2)}`
          const existing = mergedDeductions.get(key)
          if (existing) {
            existing.qtyDeducted += d.qtyDeducted
          } else {
            mergedDeductions.set(key, { ...d })
          }
        }

        for (const d of mergedDeductions.values()) {
          const lineTotal = d.qtyDeducted * moneyCents(d.unitPrice) / 100

          // Fetch batch ref for the receipt
          let batchRef: string | null = null
          if (d.batchId) {
            const batchRefRes = await client.query(
              'SELECT batch_ref FROM batches WHERE id = $1 LIMIT 1',
              [d.batchId],
            )
            batchRef = batchRefRes.rows[0]?.batch_ref ?? null
          }

          // Insert sale_item
          await client.query(
            `INSERT INTO sale_items
               (id, sale_id, product_id, batch_id, qty_sold, unit_price, line_total)
             VALUES
               (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
            [
              sale.id,
              d.productId,
              d.batchId,
              d.qtyDeducted,
              d.unitPrice.toFixed(2),
              lineTotal.toFixed(2),
            ],
          )

          // Decrement batch qty_remaining
          if (d.batchId) {
            const updated = await client.query(
              `UPDATE batches
               SET qty_remaining = qty_remaining - $1
               WHERE id = $2 AND store_id = $3 AND qty_remaining >= $1
               RETURNING id`,
              [d.qtyDeducted, d.batchId, user.store_id],
            )
            if (updated.rows.length !== 1) throw new Error('Stock changed during checkout. Please refresh the cart.')
          }

          saleItemResults.push({
            productId: d.productId,
            productName: d.productName,
            batchId: d.batchId,
            batchRef,
            qtySold: d.qtyDeducted,
            unitPrice: d.unitPrice.toFixed(2),
            lineTotal: lineTotal.toFixed(2),
          })
        }

        return {
          saleId: sale.id,
          receiptNumber: sale.receipt_number,
          totalAmount: sale.total_amount,
          changeGiven: sale.change_given,
          paymentMethod: sale.payment_method,
          items: saleItemResults,
        } satisfies SaleResult
      } catch (err) {
        throw err
      }
    })

    return { success: true, data: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create sale.'
    return { success: false, error: message }
  }
}

// ── getSales ───────────────────────────────────────────────────────────────────

export async function getSales(filters?: {
  dateFrom?: string
  dateTo?: string
  cashierId?: string
  paymentMethod?: string
  page?: number
}): Promise<
  | { success: true; data: { sales: SaleRow[]; dayTotals: SalesDayTotal[]; totalCount: number; totalPages: number; currentPage: number; summary: SalesSummary } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const page = Math.max(1, filters?.page ?? 1)
  const limit = 20
  const offset = (page - 1) * limit

  try {
    // Condition fragments are built as functions of the alias so the same
    // filters can be applied against `sales s` (for revenue/count) and
    // `sales s2` (for the units-sold subquery) without duplicating logic.
    type ConditionFn = (alias: string) => string
    const conditionFns: ConditionFn[] = [(a) => `${a}.store_id = $1`, (a) => `${a}.voided_at IS NULL`]
    const params: unknown[] = [user.store_id]
    let idx = 2

    // Cashiers can only see their own sales
    if (user.role === 'cashier') {
      const i = idx++
      conditionFns.push((a) => `${a}.cashier_id = $${i}`)
      params.push(user.id)
    } else if (filters?.cashierId) {
      const i = idx++
      conditionFns.push((a) => `${a}.cashier_id = $${i}`)
      params.push(filters.cashierId)
    }

    if (filters?.paymentMethod) {
      const i = idx++
      conditionFns.push((a) => `${a}.payment_method = $${i}`)
      params.push(filters.paymentMethod)
    }

    if (filters?.dateFrom) {
      const i = idx++
      conditionFns.push((a) => `${a}.created_at >= (($${i}::date::text || ' 00:00:00${BUSINESS_UTC_OFFSET}')::timestamptz)`)
      params.push(filters.dateFrom)
    }

    if (filters?.dateTo) {
      const i = idx++
      conditionFns.push((a) => `${a}.created_at < ((($${i}::date + 1)::text || ' 00:00:00${BUSINESS_UTC_OFFSET}')::timestamptz)`)
      params.push(filters.dateTo)
    }

    const buildWhere = (alias: string) => conditionFns.map((fn) => fn(alias)).join(' AND ')
    const where = buildWhere('s')

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM sales s WHERE ${where}`,
      params,
    )
    const totalCount: number = countRes.rows[0].total
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))

    // NOTE: total_revenue/transaction_count must come from `sales` alone. Joining
    // sale_items fans out one row per line item, which multiplies total_amount
    // (and, if not for the previous DISTINCT patch, COUNT) by basket size. Units
    // sold is computed separately against sale_items so it isn't affected.
    const summaryRes = await query(
      `SELECT
         COALESCE(SUM(s.total_amount), 0)::float AS total_revenue,
         COUNT(s.id)::int AS transaction_count,
         COALESCE((
           SELECT SUM(si.qty_sold)::int
           FROM sale_items si
           JOIN sales s2 ON s2.id = si.sale_id
           WHERE ${buildWhere('s2')}
         ), 0) AS total_units_sold
       FROM sales s
       WHERE ${where}`,
      params,
    )
    const summaryRow = summaryRes.rows[0]
    const totalRevenue = parseFloat(String(summaryRow.total_revenue)) || 0
    const transactionCount = parseInt(String(summaryRow.transaction_count), 10) || 0
    const totalUnitsSold = parseInt(String(summaryRow.total_units_sold), 10) || 0

    const dayTotalsRes = await query(
      `SELECT
         (((s.created_at AT TIME ZONE 'UTC') + INTERVAL '1 hour')::date)::text AS date,
         COUNT(s.id)::int AS transaction_count,
         COALESCE(SUM(s.total_amount), 0)::float AS revenue
       FROM sales s
       WHERE ${where}
       GROUP BY ((s.created_at AT TIME ZONE 'UTC') + INTERVAL '1 hour')::date
       ORDER BY ((s.created_at AT TIME ZONE 'UTC') + INTERVAL '1 hour')::date DESC`,
      params,
    )

    const dataRes = await query(
      `SELECT
         s.id,
         s.store_id,
         s.receipt_number,
         s.cashier_id,
         u.name AS cashier_name,
         s.total_amount,
         s.amount_paid,
         s.change_given,
         s.payment_method,
         s.notes,
         s.voided_at,
         s.voided_by_id,
         s.void_reason,
         s.created_at,
         (((s.created_at AT TIME ZONE 'UTC') + INTERVAL '1 hour')::date)::text AS sales_date,
         (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)::int AS items_count
       FROM sales s
       LEFT JOIN users u ON u.id = s.cashier_id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )

    return {
      success: true,
      data: {
        sales: dataRes.rows as SaleRow[],
        dayTotals: dayTotalsRes.rows.map((row) => ({
          date: row.date,
          transactionCount: parseInt(String(row.transaction_count), 10) || 0,
          revenue: parseFloat(String(row.revenue)) || 0,
        })),
        totalCount,
        totalPages,
        currentPage: page,
        summary: {
          totalRevenue,
          transactionCount,
          totalUnitsSold,
        },
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sales.'
    return { success: false, error: message }
  }
}

// ── getEffectiveUnitPrices ───────────────────────────────────────────────────
//
// The POS uses this only as a single-unit display hint. Quantity-aware carts
// must use getSaleQuote(), because one basket can span multiple FEFO prices.

export async function getEffectiveUnitPrices(
  productIds: string[],
): Promise<{ success: true; data: Record<string, number> } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  if (productIds.length === 0) return { success: true, data: {} }

  try {
    // For each product, the price that would be charged is the
    // selling_price_override of the *next* batch to be deducted in FEFO
    // order (earliest expiry, then oldest received), or the product's
    // default selling_price if that batch has no override or there's no
    // stock at all yet.
    const result = await query(
      `SELECT DISTINCT ON (p.id)
         p.id AS product_id,
         COALESCE(b.selling_price_override, p.selling_price) AS effective_price
       FROM products p
       LEFT JOIN batches b
         ON b.product_id = p.id
         AND b.store_id = p.store_id
         AND b.qty_remaining > 0
         AND p.track_inventory = true
       WHERE p.id = ANY($1) AND p.store_id = $2
       ORDER BY p.id, b.expiry_date ASC NULLS LAST, b.received_at ASC, b.id ASC`,
      [productIds, user.store_id],
    )

    const prices: Record<string, number> = {}
    for (const row of result.rows as { product_id: string; effective_price: string }[]) {
      prices[row.product_id] = parseFloat(row.effective_price)
    }

    return { success: true, data: prices }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch prices.'
    return { success: false, error: message }
  }
}

// ── getCashiers ────────────────────────────────────────────────────────────────

export async function getCashiers(): Promise<
  { success: true; data: { id: string; name: string }[] } | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  // Only owners/storekeepers need the cashier filter
  if (user.role === 'cashier') return { success: true, data: [] }

  try {
    const res = await query(
      `SELECT id, name FROM users
       WHERE store_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [user.store_id],
    )
    return { success: true, data: res.rows as { id: string; name: string }[] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch cashiers.'
    return { success: false, error: message }
  }
}

// ── getSaleById ────────────────────────────────────────────────────────────────

export async function getSaleById(
  saleId: string,
): Promise<{ success: true; data: SaleDetail } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  try {
    // Fetch sale header + cashier name
    const saleRes = await query(
      `SELECT
         s.id,
         s.store_id,
         s.receipt_number,
         s.cashier_id,
         u.name AS cashier_name,
         s.total_amount,
         s.amount_paid,
         s.change_given,
         s.payment_method,
         s.notes,
         s.voided_at,
         s.voided_by_id,
         s.void_reason,
         s.created_at,
         (((s.created_at AT TIME ZONE 'UTC') + INTERVAL '1 hour')::date)::text AS sales_date,
         (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)::int AS items_count
       FROM sales s
       LEFT JOIN users u ON u.id = s.cashier_id
       WHERE s.id = $1 AND s.store_id = $2
       LIMIT 1`,
      [saleId, user.store_id],
    )

    if (saleRes.rows.length === 0) {
      return { success: false, error: 'Sale not found.' }
    }

    // Cashiers can only view their own sales
    const sale = saleRes.rows[0] as SaleRow
    if (user.role === 'cashier' && sale.cashier_id !== user.id) {
      return { success: false, error: 'Access denied.' }
    }

    // Fetch all sale items with product name and batch ref
    const itemsRes = await query(
      `SELECT
         si.id,
         si.product_id,
         p.name AS product_name,
         si.batch_id,
         b.batch_ref,
         si.qty_sold,
         si.unit_price,
         si.line_total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       LEFT JOIN batches b ON b.id = si.batch_id
       WHERE si.sale_id = $1
       ORDER BY p.name ASC`,
      [saleId],
    )

    const items: SaleItemResult[] = itemsRes.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      batchId: row.batch_id,
      batchRef: row.batch_ref,
      qtySold: row.qty_sold,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
    }))

    return {
      success: true,
      data: { ...sale, items },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sale.'
    return { success: false, error: message }
  }
}

export async function getSaleItems(
  saleId: string,
): Promise<{ success: true; data: SaleItemResult[] } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  try {
    const saleRes = await query(
      `SELECT id, cashier_id FROM sales WHERE id = $1 AND store_id = $2 LIMIT 1`,
      [saleId, user.store_id],
    )
    const sale = saleRes.rows[0]
    if (!sale || (user.role === 'cashier' && sale.cashier_id !== user.id)) {
      return { success: false, error: 'Sale not found.' }
    }
    const itemsRes = await query(
      `SELECT si.product_id, p.name AS product_name, si.batch_id, b.batch_ref,
              si.qty_sold, si.unit_price, si.line_total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       LEFT JOIN batches b ON b.id = si.batch_id
       WHERE si.sale_id = $1
       ORDER BY si.id ASC`,
      [saleId],
    )
    return {
      success: true,
      data: itemsRes.rows.map((row) => ({
        productId: row.product_id,
        productName: row.product_name,
        batchId: row.batch_id,
        batchRef: row.batch_ref,
        qtySold: row.qty_sold,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
      })),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch sale items.' }
  }
}

export async function deleteSale(
  _saleId: string,
  _confirmationText: string,
): Promise<
  | { success: true; data: { receiptNumber: string } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  return { success: false, error: 'Permanent sale deletion is disabled. Use an auditable void instead.' }
}

export async function voidSale(
  saleId: string,
  confirmationText: string,
  reason: string,
): Promise<{ success: true; data: { receiptNumber: string; voidedAt: string } } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== 'owner') return { success: false, error: 'Only the store owner can void a sale.' }
  const cleanedReason = reason?.trim()
  if (!saleId || !confirmationText || !cleanedReason || cleanedReason.length < 3 || cleanedReason.length > 500) {
    return { success: false, error: 'Sale, confirmation, and a reason (3–500 characters) are required.' }
  }

  try {
    const result = await withTransaction(async (client: ClientBase) => {
      const saleRes = await client.query(
        `SELECT id, receipt_number, voided_at FROM sales
         WHERE id = $1 AND store_id = $2 FOR UPDATE`, [saleId, user.store_id],
      )
      const sale = saleRes.rows[0]
      if (!sale) throw new Error('Sale not found.')
      if (sale.voided_at) throw new Error('This sale has already been voided.')
      if (confirmationText !== `VOID ${sale.receipt_number}`) {
        throw new Error('The confirmation text does not match this receipt.')
      }

      const missing = await client.query(
        `SELECT 1 FROM sale_items si LEFT JOIN batches b ON b.id = si.batch_id
         WHERE si.sale_id = $1 AND si.batch_id IS NOT NULL AND b.id IS NULL LIMIT 1`, [saleId],
      )
      if (missing.rows.length) throw new Error('This sale references a missing inventory batch; void was not applied.')

      await client.query(
        `UPDATE batches b SET qty_remaining = b.qty_remaining + restored.qty_sold
         FROM (SELECT batch_id, SUM(qty_sold)::int AS qty_sold FROM sale_items
               WHERE sale_id = $1 AND batch_id IS NOT NULL GROUP BY batch_id) restored
         WHERE b.id = restored.batch_id AND b.store_id = $2`, [saleId, user.store_id],
      )
      const update = await client.query(
        `UPDATE sales SET voided_at = NOW(), voided_by_id = $3, void_reason = $4
         WHERE id = $1 AND store_id = $2 AND voided_at IS NULL
         RETURNING receipt_number, voided_at`, [saleId, user.store_id, user.id, cleanedReason],
      )
      if (update.rows.length !== 1) throw new Error('Sale changed before it could be voided.')
      return { receiptNumber: update.rows[0].receipt_number as string, voidedAt: String(update.rows[0].voided_at) }
    })
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to void sale.' }
  }
}

export async function getRetainedSalesCsvRows(filters?: {
  dateFrom?: string
  dateTo?: string
  cashierId?: string
  paymentMethod?: string
}): Promise<{ success: true; data: SalesCsvRow[] } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== 'owner') {
    return { success: false, error: 'Only the store owner can export sales records.' }
  }

  try {
    const conditions: string[] = [
      's.store_id = $1',
      's.voided_at IS NULL',
      "s.created_at >= NOW() - INTERVAL '2 years'",
    ]
    const params: unknown[] = [user.store_id]
    let idx = 2

    if (filters?.cashierId) {
      conditions.push(`s.cashier_id = $${idx++}`)
      params.push(filters.cashierId)
    }

    if (filters?.paymentMethod) {
      conditions.push(`s.payment_method = $${idx++}`)
      params.push(filters.paymentMethod)
    }

    if (filters?.dateFrom) {
      conditions.push(`s.created_at >= (($${idx}::date::text || ' 00:00:00${BUSINESS_UTC_OFFSET}')::timestamptz)`)
      params.push(filters.dateFrom)
      idx++
    }

    if (filters?.dateTo) {
      conditions.push(`s.created_at < ((($${idx}::date + 1)::text || ' 00:00:00${BUSINESS_UTC_OFFSET}')::timestamptz)`)
      params.push(filters.dateTo)
      idx++
    }

    const result = await query(
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
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC, s.receipt_number ASC, p.name ASC`,
      params,
    )

    return {
      success: true,
      data: result.rows.map((row) => ({
        createdAt: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
        receiptNumber: row.receipt_number as string,
        productName: row.product_name as string,
        qtySold: row.qty_sold as number,
        unitPrice: row.unit_price as string,
        lineTotal: row.line_total as string,
        paymentMethod: row.payment_method as string,
        saleTotal: row.sale_total as string,
        cashierName: row.cashier_name as string | null,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export sales records.'
    return { success: false, error: message }
  }
}

/** Quantity-aware server quote; no sale or inventory mutation. */
export async function getSaleQuote(cartItems: CartItem[]): Promise<{ success: true; data: SaleQuote } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  try {
    const data = await withTransaction(async client =>
      quoteFromDeductions(await resolveSaleDeductions(client, user.store_id, cartItems)))
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not quote this cart.' }
  }
}
