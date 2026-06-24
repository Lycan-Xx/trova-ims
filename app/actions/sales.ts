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

interface BatchDeduction {
  batchId: string
  productId: string
  productName: string
  qtyDeducted: number
  unitPrice: number   // resolved at time of deduction
}

export interface SaleItemResult {
  productId: string
  productName: string
  batchId: string
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
        const allDeductions: BatchDeduction[] = []

        for (const item of cartItems) {
          if (item.qtySold <= 0) continue

          // Fetch product for name + default selling price
          const productRes = await client.query(
            `SELECT id, name, selling_price FROM products
             WHERE id = $1 AND store_id = $2 AND is_active = true
             LIMIT 1`,
            [item.productId, user.store_id],
          )
          if (productRes.rows.length === 0) {
            throw new Error(`Product not found: ${item.productId}`)
          }
          const product = productRes.rows[0]

          // Fetch all batches with remaining stock, FEFO order
          const batchRes = await client.query(
            `SELECT id, qty_remaining, selling_price_override, expiry_date
             FROM batches
             WHERE product_id = $1
               AND store_id = $2
               AND qty_remaining > 0
             ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
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
        const mergedDeductions = new Map<string, BatchDeduction>()
        for (const d of allDeductions) {
          const key = `${d.batchId}`
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
          const batchRefRes = await client.query(
            'SELECT batch_ref FROM batches WHERE id = $1 LIMIT 1',
            [d.batchId],
          )
          const batchRef = batchRefRes.rows[0]?.batch_ref ?? null

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
          await client.query(
            `UPDATE batches
             SET qty_remaining = qty_remaining - $1
             WHERE id = $2 AND store_id = $3`,
            [d.qtyDeducted, d.batchId, user.store_id],
          )

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
         s.created_at
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
       JOIN batches b ON b.id = si.batch_id
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
