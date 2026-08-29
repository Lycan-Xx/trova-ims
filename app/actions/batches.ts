'use server'

import { randomUUID } from 'crypto'
import type { ClientBase } from 'pg'
import { query, withConnection } from '@/lib/db'
import { requireStoreAccess } from '@/lib/auth'
import type { Batch, Product, Vendor } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchWithRefs extends Batch {
  product_name: string
  product_sku: string
  vendor_name: string | null
}

export interface GetBatchesResult {
  batches: BatchWithRefs[]
  totalCount: number
  totalPages: number
}

export interface GetBatchesFilters {
  productId?: string
  vendorId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  consignmentOnly?: boolean
  sessionId?: string
  page?: number
}

export interface StockSummaryRow {
  productId: string
  productName: string
  sku: string
  currentStock: number
  reorderLevel: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export interface IntakeLineInput {
  productId: string
  vendorId?: string | null
  purchaseMode: 'unit' | 'pack'
  qtyReceived: number
  packSize?: number
  totalPurchaseCost: number
  sellingPriceOverride?: number | null
  expiryDate?: Date | null
  supplierLotNumber?: string | null
  isConsignment?: boolean
}

export interface CreateBatchSessionResult {
  /** Null when the submission was a single line — no grouping needed. */
  sessionId: string | null
  batches: Batch[]
}

const PAGE_SIZE = 20

// ─── createBatchSession ─────────────────────────────────────────────────────
//
// Records one or more batches from a single Stock Intake submission — e.g.
// one restock trip covering several products and/or several vendors — as
// one all-or-nothing transaction. If any line fails validation, nothing
// commits: stock counts should never drift from reality because line 9 of
// 14 quietly failed while the rest went through. See
// docs/intake-sessions.md for the full design rationale.
//
// Lines sharing one submission get a shared, generated intake_session_id
// stamped on every batch (null when there's only one line — a plain
// one-off intake, exactly as it's always worked). Every batch also keeps
// its own vendor_id/product_id — the session is a grouping tag layered on
// top of the existing one-batch-one-product-one-vendor model, not a change
// to it.

export async function createBatchSession(formData: {
  receivedAt: Date
  notes?: string | null
  lines: IntakeLineInput[]
}): Promise<
  { success: true; data: CreateBatchSessionResult } | { success: false; error: string }
> {
  const user = await requireStoreAccess()

  if (!formData.lines || formData.lines.length === 0) {
    return { success: false, error: 'Add at least one product line before submitting.' }
  }

  try {
    const data = await withConnection(async (client: ClientBase) => {
      await client.query('BEGIN')

      try {
        const sessionId = formData.lines.length > 1 ? randomUUID() : null
        const datePart = formData.receivedAt.toISOString().slice(0, 10).replace(/-/g, '')

        // Starting sequence for the auto-generated batch_ref, based on how
        // many batches this store already has for the chosen date. Each
        // line in this submission increments it, so a 5-line session gets
        // 5 consecutive references (…-004, …-005, …-006…) instead of a
        // collision.
        const todayCountRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM batches
           WHERE store_id = $1 AND received_at::date = $2::date`,
          [user.store_id, formData.receivedAt],
        )
        let seq = (todayCountRes.rows[0].count as number) + 1

        const createdBatches: Batch[] = []

        for (let i = 0; i < formData.lines.length; i++) {
          const line = formData.lines[i]
          const lineLabel = formData.lines.length > 1 ? `Line ${i + 1}: ` : ''

          const productRes = await client.query(
            'SELECT id, track_inventory FROM products WHERE id = $1 AND store_id = $2 AND is_active = true LIMIT 1',
            [line.productId, user.store_id],
          )
          if (productRes.rows.length === 0) {
            throw new Error(`${lineLabel}product not found or inactive.`)
          }
          const product = productRes.rows[0] as Pick<Product, 'id' | 'track_inventory'>

          let isConsignment = line.isConsignment ?? false
          if (line.vendorId) {
            const vendorRes = await client.query(
              'SELECT id, type FROM vendors WHERE id = $1 AND store_id = $2 AND is_active = true LIMIT 1',
              [line.vendorId, user.store_id],
            )
            if (vendorRes.rows.length === 0) {
              throw new Error(`${lineLabel}vendor not found or inactive.`)
            }
            if ((vendorRes.rows[0] as Vendor).type === 'consignment') {
              isConsignment = true
            }
          }

          const packSize = line.packSize ?? 1
          const actualUnits =
            line.purchaseMode === 'pack' ? line.qtyReceived * packSize : line.qtyReceived

          if (actualUnits <= 0) {
            throw new Error(`${lineLabel}quantity must be greater than zero.`)
          }
          if (line.totalPurchaseCost < 0) {
            throw new Error(`${lineLabel}total purchase cost cannot be negative.`)
          }

          const costPerUnit = line.totalPurchaseCost > 0 ? line.totalPurchaseCost / actualUnits : 0
          const batchRef = `INT-${datePart}-${String(seq).padStart(3, '0')}`
          seq++

          const insertRes = await client.query(
            `INSERT INTO batches (
              id, store_id, product_id, vendor_id, batch_ref, supplier_lot_number,
              qty_received, qty_remaining, pack_size, total_purchase_cost, cost_per_unit,
              selling_price_override, expiry_date, is_consignment, notes,
              received_at, received_by_id, intake_session_id
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            ) RETURNING *`,
            [
              user.store_id,
              line.productId,
              line.vendorId ?? null,
              batchRef,
              line.supplierLotNumber?.trim() || null,
              actualUnits,
              actualUnits,
              packSize,
              line.totalPurchaseCost,
              costPerUnit,
              line.sellingPriceOverride ?? null,
              line.expiryDate ?? null,
              isConsignment,
              formData.notes?.trim() || null,
              formData.receivedAt,
              user.id,
              sessionId,
            ],
          )
          createdBatches.push(insertRes.rows[0] as Batch)

          if (!product.track_inventory) {
            await client.query(
              `UPDATE products
               SET track_inventory = true
               WHERE id = $1 AND store_id = $2`,
              [line.productId, user.store_id],
            )
          }
        }

        await client.query('COMMIT')
        return { sessionId, batches: createdBatches }
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    })

    return { success: true, data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── createBatch ─────────────────────────────────────────────────────────────
// Thin single-line convenience wrapper around createBatchSession, kept for
// any call site that only ever needs to record one batch at a time.

export async function createBatch(
  formData: { receivedAt?: Date; notes?: string | null } & IntakeLineInput,
): Promise<{ success: true; data: Batch } | { success: false; error: string }> {
  const { receivedAt, notes, ...line } = formData
  const result = await createBatchSession({
    receivedAt: receivedAt ?? new Date(),
    notes,
    lines: [line],
  })
  if (!result.success) return result
  return { success: true, data: result.data.batches[0] }
}


// ─── getBatches ───────────────────────────────────────────────────────────────

export async function getBatches(
  filters: GetBatchesFilters = {},
): Promise<{ success: true; data: GetBatchesResult } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    const page = Math.max(1, filters.page ?? 1)
    const offset = (page - 1) * PAGE_SIZE

    const conditions: string[] = ['b.store_id = $1']
    const params: unknown[] = [user.store_id]
    let idx = 2

    if (filters.productId) {
      conditions.push(`b.product_id = $${idx}`)
      params.push(filters.productId)
      idx++
    }

    if (filters.vendorId) {
      conditions.push(`b.vendor_id = $${idx}`)
      params.push(filters.vendorId)
      idx++
    }

    if (filters.dateFrom) {
      conditions.push(`b.received_at >= $${idx}`)
      params.push(filters.dateFrom)
      idx++
    }

    if (filters.dateTo) {
      conditions.push(`b.received_at <= $${idx}`)
      params.push(filters.dateTo)
      idx++
    }

    if (filters.search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`)
      params.push(`%${filters.search}%`)
      idx++
    }

    if (filters.consignmentOnly) {
      conditions.push('b.is_consignment = true')
    }

    if (filters.sessionId) {
      conditions.push(`b.intake_session_id = $${idx}`)
      params.push(filters.sessionId)
      idx++
    }

    const whereClause = conditions.join(' AND ')

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM batches b
       JOIN products p ON p.id = b.product_id
       WHERE ${whereClause}`,
      params,
    )
    const totalCount = parseInt(countResult.rows[0].total as string, 10)
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    const dataResult = await query(
      `SELECT
         b.*,
         p.name  AS product_name,
         p.sku   AS product_sku,
         v.name  AS vendor_name
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE ${whereClause}
       ORDER BY b.received_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, PAGE_SIZE, offset],
    )

    return {
      success: true,
      data: {
        batches: dataResult.rows as BatchWithRefs[],
        totalCount,
        totalPages,
      },
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getBatchById ─────────────────────────────────────────────────────────────

export async function getBatchById(
  batchId: string,
): Promise<
  | { success: true; data: BatchWithRefs & { product: Product; vendor: Vendor | null } }
  | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `SELECT
         b.*,
         p.name           AS product_name,
         p.sku            AS product_sku,
         p.unit           AS product_unit,
         p.selling_price  AS product_selling_price,
         p.reorder_level  AS product_reorder_level,
         p.track_inventory AS product_track_inventory,
         v.name           AS vendor_name,
         v.type           AS vendor_type,
         v.contact        AS vendor_contact
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.id = $1 AND b.store_id = $2
       LIMIT 1`,
      [batchId, user.store_id],
    )

    if (result.rows.length === 0) {
      return { success: false, error: 'Batch not found or access denied.' }
    }

    const row = result.rows[0] as Record<string, unknown>

    const batch: BatchWithRefs = {
      id: row.id as string,
      store_id: row.store_id as string,
      product_id: row.product_id as string,
      vendor_id: row.vendor_id as string | null,
      batch_ref: row.batch_ref as string | null,
      supplier_lot_number: row.supplier_lot_number as string | null,
      intake_session_id: row.intake_session_id as string | null,
      qty_received: row.qty_received as number,
      qty_remaining: row.qty_remaining as number,
      pack_size: row.pack_size as number,
      total_purchase_cost: row.total_purchase_cost as string,
      cost_per_unit: row.cost_per_unit as string,
      selling_price_override: row.selling_price_override as string | null,
      expiry_date: row.expiry_date as string | null,
      is_consignment: row.is_consignment as boolean,
      notes: row.notes as string | null,
      received_at: row.received_at as string,
      received_by_id: row.received_by_id as string | null,
      product_name: row.product_name as string,
      product_sku: row.product_sku as string,
      vendor_name: row.vendor_name as string | null,
    }

    const product = {
      id: row.product_id as string,
      store_id: row.store_id as string,
      category_id: null,
      sku: row.product_sku as string,
      name: row.product_name as string,
      description: null,
      barcode: null,
      unit: row.product_unit as Product['unit'],
      selling_price: row.product_selling_price as string,
      reorder_level: row.product_reorder_level as number,
      track_inventory: row.product_track_inventory as boolean,
      is_active: true,
      created_at: '',
    } satisfies Product

    const vendor: Vendor | null = row.vendor_id
      ? {
          id: row.vendor_id as string,
          store_id: row.store_id as string,
          name: row.vendor_name as string,
          contact: row.vendor_contact as string | null,
          address: null,
          type: row.vendor_type as Vendor['type'],
          notes: null,
          is_active: true,
          created_at: '',
        }
      : null

    return { success: true, data: { ...batch, product, vendor } }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getStockSummary ──────────────────────────────────────────────────────────

export async function getStockSummary(): Promise<
  { success: true; data: StockSummaryRow[] } | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `SELECT
         p.id            AS product_id,
         p.name          AS product_name,
         p.sku,
         p.reorder_level,
         COALESCE(SUM(b.qty_remaining), 0)::int AS current_stock
       FROM products p
       LEFT JOIN batches b ON b.product_id = p.id
       WHERE p.store_id = $1 AND p.is_active = true AND p.track_inventory = true
       GROUP BY p.id, p.name, p.sku, p.reorder_level
       ORDER BY p.name ASC`,
      [user.store_id],
    )

    const rows: StockSummaryRow[] = result.rows.map((row) => {
      const stock = row.current_stock as number
      const reorder = row.reorder_level as number
      const status: StockSummaryRow['status'] =
        stock === 0
          ? 'out_of_stock'
          : stock <= reorder
          ? 'low_stock'
          : 'in_stock'

      return {
        productId: row.product_id as string,
        productName: row.product_name as string,
        sku: row.sku as string,
        currentStock: stock,
        reorderLevel: reorder,
        status,
      }
    })

    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
