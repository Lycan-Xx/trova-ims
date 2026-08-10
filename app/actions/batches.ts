'use server'

import { query } from '@/lib/db'
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

const PAGE_SIZE = 20

// ─── createBatch ─────────────────────────────────────────────────────────────

export async function createBatch(formData: {
  productId: string
  vendorId?: string | null
  purchaseMode: 'unit' | 'pack'
  qtyReceived: number
  packSize?: number
  totalPurchaseCost: number
  sellingPriceOverride?: number | null
  expiryDate?: Date | null
  supplierLotNumber?: string | null
  notes?: string | null
  isConsignment?: boolean
}): Promise<{ success: true; data: Batch } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    // Verify product belongs to this store
    const productResult = await query(
      'SELECT id FROM products WHERE id = $1 AND store_id = $2 AND is_active = true LIMIT 1',
      [formData.productId, user.store_id],
    )
    if (productResult.rows.length === 0) {
      return { success: false, error: 'Product not found or access denied.' }
    }

    // Verify vendor belongs to this store (if provided)
    let isConsignment = formData.isConsignment ?? false
    if (formData.vendorId) {
      const vendorResult = await query(
        'SELECT id, type FROM vendors WHERE id = $1 AND store_id = $2 AND is_active = true LIMIT 1',
        [formData.vendorId, user.store_id],
      )
      if (vendorResult.rows.length === 0) {
        return { success: false, error: 'Vendor not found or access denied.' }
      }
      // Auto-set consignment if vendor type is consignment
      if ((vendorResult.rows[0] as Vendor).type === 'consignment') {
        isConsignment = true
      }
    }

    // Compute unit quantities and cost
    const packSize = formData.packSize ?? 1
    const actualUnits =
      formData.purchaseMode === 'pack'
        ? formData.qtyReceived * packSize
        : formData.qtyReceived

    if (actualUnits <= 0) {
      return { success: false, error: 'Quantity must be greater than zero.' }
    }
    if (formData.totalPurchaseCost < 0) {
      return { success: false, error: 'Total purchase cost cannot be negative.' }
    }

    const costPerUnit =
      formData.totalPurchaseCost > 0
        ? formData.totalPurchaseCost / actualUnits
        : 0

    // Auto-generate the internal batch reference: INT-YYYYMMDD-### where ###
    // is that store's running count of batches received today. This used to
    // be a free-text field the user had to fill in by hand every time — now
    // it's always present without asking, and the supplier's own lot code
    // (if the delivery has one) is captured separately below.
    const today = new Date()
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
    const todayCountResult = await query(
      `SELECT COUNT(*)::int AS count FROM batches
       WHERE store_id = $1 AND received_at::date = CURRENT_DATE`,
      [user.store_id],
    )
    const seq = (todayCountResult.rows[0].count as number) + 1
    const batchRef = `INT-${datePart}-${String(seq).padStart(3, '0')}`

    const result = await query(
      `INSERT INTO batches (
        id,
        store_id,
        product_id,
        vendor_id,
        batch_ref,
        supplier_lot_number,
        qty_received,
        qty_remaining,
        pack_size,
        total_purchase_cost,
        cost_per_unit,
        selling_price_override,
        expiry_date,
        is_consignment,
        notes,
        received_at,
        received_by_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15
      ) RETURNING *`,
      [
        user.store_id,
        formData.productId,
        formData.vendorId ?? null,
        batchRef,
        formData.supplierLotNumber?.trim() || null,
        actualUnits,           // qty_received stored as actual units
        actualUnits,           // qty_remaining starts equal to qty_received
        packSize,
        formData.totalPurchaseCost,
        costPerUnit,
        formData.sellingPriceOverride ?? null,
        formData.expiryDate ?? null,
        isConsignment,
        formData.notes ?? null,
        user.id,
      ],
    )

    return { success: true, data: result.rows[0] as Batch }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
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
      unit: row.product_unit as Product['unit'],
      selling_price: row.product_selling_price as string,
      reorder_level: row.product_reorder_level as number,
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
       WHERE p.store_id = $1 AND p.is_active = true
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
