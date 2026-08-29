'use server'

import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query, withConnection } from '@/lib/db'
import { generateReceiptNumber } from '@/lib/db/helpers'
import type { ClientBase } from 'pg'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  qtySold: number
}

interface SaleDeduction {
  batchId: string | null
  productId: string
  productName: string
  qtyDeducted: number
  unitPrice: number   // resolved at time of deduction
}

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
  created_at: string
  items_count: number
}

export interface SaleDetail extends SaleRow {
  items: SaleItemResult[]
}

// ── createSale ─────────────────────────────────────────────────────────────────

export async function createSale(
  cartItems: CartItem[],
  paymentMethod: 'cash' | 'transfer' | 'pos',
  amountPaid: number,
): Promise<{ success: true; data: SaleResult } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'Cart is empty.' }
  }

  try {
    const result = await withConnection(async (client: ClientBase) => {
      await client.query('BEGIN')

      try {
        // ── STEP 1: FEFO Batch Resolution ────────────────────────────────────
        const allDeductions: SaleDeduction[] = []

        for (const item of cartItems) {
          if (item.qtySold <= 0) continue

          // Fetch product for name + default selling price
          const productRes = await client.query(
            `SELECT id, name, selling_price, track_inventory FROM products
             WHERE id = $1 AND store_id = $2 AND is_active = true
             LIMIT 1`,
            [item.productId, user.store_id],
          )
          if (productRes.rows.length === 0) {
            throw new Error(`Product not found: ${item.productId}`)
          }
          const product = productRes.rows[0]

          if (!product.track_inventory) {
            allDeductions.push({
              batchId: null,
              productId: item.productId,
              productName: product.name,
              qtyDeducted: item.qtySold,
              unitPrice: parseFloat(product.selling_price),
            })
            continue
          }

          // Fetch all batches with remaining stock, FEFO order.
          // FOR UPDATE locks these rows for the duration of the transaction so
          // concurrent sales (e.g. two cashiers checking out the same product
          // at once) can't both read the same qty_remaining and oversell.
          const batchRes = await client.query(
            `SELECT id, qty_remaining, selling_price_override, expiry_date
             FROM batches
             WHERE product_id = $1
               AND store_id = $2
               AND qty_remaining > 0
             ORDER BY expiry_date ASC NULLS LAST, received_at ASC
             FOR UPDATE`,
            [item.productId, user.store_id],
          )

          const batches = batchRes.rows
          const totalAvailable = batches.reduce(
            (sum: number, b: { qty_remaining: number }) => sum + b.qty_remaining, 0,
          )

          if (totalAvailable < item.qtySold) {
            throw new Error(`Insufficient stock for ${product.name}`)
          }

          // Walk batches in FEFO order, deducting until qtySold is satisfied
          let remaining = item.qtySold
          for (const batch of batches) {
            if (remaining <= 0) break
            const deduct = Math.min(remaining, batch.qty_remaining)
            const unitPrice = batch.selling_price_override !== null
              ? parseFloat(batch.selling_price_override)
              : parseFloat(product.selling_price)

            allDeductions.push({
              batchId: batch.id,
              productId: item.productId,
              productName: product.name,
              qtyDeducted: deduct,
              unitPrice,
            })
            remaining -= deduct
          }
        }

        // ── STEP 2: Create Sale Record ────────────────────────────────────────
        if (allDeductions.length === 0) {
          throw new Error('Cart has no valid items.')
        }

        const totalAmount = allDeductions.reduce(
          (sum, d) => sum + d.qtyDeducted * d.unitPrice,
          0,
        )

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
              amount_paid, change_given, payment_method, notes, created_at)
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NULL, NOW())
           RETURNING id, receipt_number, total_amount, change_given, payment_method`,
          [
            user.store_id,
            receiptNumber,
            user.id,
            totalAmount.toFixed(2),
            paymentMethod === 'cash' ? amountPaid.toFixed(2) : null,
            changeGiven !== null ? changeGiven.toFixed(2) : null,
            paymentMethod,
          ],
        )

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
          const lineTotal = d.qtyDeducted * d.unitPrice

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
            await client.query(
              `UPDATE batches
               SET qty_remaining = qty_remaining - $1
               WHERE id = $2 AND store_id = $3`,
              [d.qtyDeducted, d.batchId, user.store_id],
            )
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

        await client.query('COMMIT')

        return {
          saleId: sale.id,
          receiptNumber: sale.receipt_number,
          totalAmount: sale.total_amount,
          changeGiven: sale.change_given,
          paymentMethod: sale.payment_method,
          items: saleItemResults,
        } satisfies SaleResult
      } catch (err) {
        await client.query('ROLLBACK')
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
  | { success: true; data: { sales: SaleRow[]; totalCount: number; totalPages: number; currentPage: number } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const page = Math.max(1, filters?.page ?? 1)
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const conditions: string[] = ['s.store_id = $1']
    const params: unknown[] = [user.store_id]
    let idx = 2

    // Cashiers can only see their own sales
    if (user.role === 'cashier') {
      conditions.push(`s.cashier_id = $${idx++}`)
      params.push(user.id)
    } else if (filters?.cashierId) {
      conditions.push(`s.cashier_id = $${idx++}`)
      params.push(filters.cashierId)
    }

    if (filters?.paymentMethod) {
      conditions.push(`s.payment_method = $${idx++}`)
      params.push(filters.paymentMethod)
    }

    if (filters?.dateFrom) {
      conditions.push(`s.created_at >= $${idx++}`)
      params.push(filters.dateFrom)
    }

    if (filters?.dateTo) {
      conditions.push(`s.created_at <= $${idx++}`)
      params.push(filters.dateTo)
    }

    const where = conditions.join(' AND ')

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM sales s WHERE ${where}`,
      params,
    )
    const totalCount: number = countRes.rows[0].total
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))

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
         s.created_at,
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
        totalCount,
        totalPages,
        currentPage: page,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sales.'
    return { success: false, error: message }
  }
}

// ── getEffectiveUnitPrices ───────────────────────────────────────────────────
//
// The POS cart previews a total using product.selling_price, but createSale()
// actually charges whatever the next FEFO batch's selling_price_override
// resolves to (falling back to the product price if unset). Those two numbers
// can silently diverge whenever a batch was intake'd with an overridden
// selling price. This gives the cart the real, about-to-be-charged price for
// each product so the on-screen total always matches the receipt.

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
       WHERE p.id = ANY($1) AND p.store_id = $2
       ORDER BY p.id, b.expiry_date ASC NULLS LAST, b.received_at ASC`,
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
         s.created_at
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
