'use server'

import { query } from '@/lib/db'
import { requireStoreAccess, requireOwner } from '@/lib/auth'
import type { Vendor, VendorType } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VendorWithStats extends Vendor {
  batch_count: number
  outstanding_qty: number  // sum of qty_remaining on consignment batches only
}

export interface VendorBatchRow {
  id: string
  product_id: string
  product_name: string
  received_at: string
  qty_received: number
  qty_remaining: number
  total_purchase_cost: string
  is_consignment: boolean
  batch_ref: string | null
}

export interface VendorDetail extends Vendor {
  batches: VendorBatchRow[]
  outstanding_consignment_qty: number
}

export interface GetVendorsFilters {
  type?: 'all' | 'direct' | 'consignment'
  search?: string
}

// ─── createVendor ─────────────────────────────────────────────────────────────

export async function createVendor(formData: {
  name: string
  type?: VendorType
  contact?: string
  address?: string
  notes?: string
}): Promise<{ success: true; data: Vendor } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `INSERT INTO vendors
         (id, store_id, name, contact, address, type, notes, is_active, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING *`,
      [
        user.store_id,
        formData.name.trim(),
        formData.contact?.trim() ?? null,
        formData.address?.trim() ?? null,
        formData.type ?? 'direct',
        formData.notes?.trim() ?? null,
      ],
    )

    return { success: true, data: result.rows[0] as Vendor }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── updateVendor ─────────────────────────────────────────────────────────────

export async function updateVendor(
  vendorId: string,
  formData: {
    name?: string
    type?: VendorType
    contact?: string | null
    address?: string | null
    notes?: string | null
  },
): Promise<{ success: true; data: Vendor } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    // Verify vendor belongs to this store before mutating
    const existing = await query(
      'SELECT id FROM vendors WHERE id = $1 AND store_id = $2 LIMIT 1',
      [vendorId, user.store_id],
    )
    if (existing.rows.length === 0) {
      return { success: false, error: 'Vendor not found or access denied.' }
    }

    const result = await query(
      `UPDATE vendors SET
         name    = COALESCE($1, name),
         type    = COALESCE($2, type),
         contact = $3,
         address = $4,
         notes   = $5
       WHERE id = $6 AND store_id = $7
       RETURNING *`,
      [
        formData.name?.trim() ?? null,
        formData.type ?? null,
        formData.contact !== undefined ? formData.contact : null,
        formData.address !== undefined ? formData.address : null,
        formData.notes !== undefined ? formData.notes : null,
        vendorId,
        user.store_id,
      ],
    )

    return { success: true, data: result.rows[0] as Vendor }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── deactivateVendor ─────────────────────────────────────────────────────────

export async function deactivateVendor(
  vendorId: string,
): Promise<{ success: true; data: Vendor } | { success: false; error: string }> {
  try {
    // Owner-only operation — soft delete, never hard delete
    const user = await requireOwner()

    const existing = await query(
      'SELECT id FROM vendors WHERE id = $1 AND store_id = $2 LIMIT 1',
      [vendorId, user.store_id],
    )
    if (existing.rows.length === 0) {
      return { success: false, error: 'Vendor not found or access denied.' }
    }

    const result = await query(
      `UPDATE vendors SET is_active = false
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      [vendorId, user.store_id],
    )

    return { success: true, data: result.rows[0] as Vendor }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getVendors ───────────────────────────────────────────────────────────────

export async function getVendors(
  filters: GetVendorsFilters = {},
): Promise<{ success: true; data: VendorWithStats[] } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    const conditions: string[] = ['v.store_id = $1', 'v.is_active = true']
    const params: unknown[] = [user.store_id]
    let paramIdx = 2

    if (filters.type && filters.type !== 'all') {
      conditions.push(`v.type = $${paramIdx}`)
      params.push(filters.type)
      paramIdx++
    }

    if (filters.search) {
      conditions.push(
        `(v.name ILIKE $${paramIdx} OR v.contact ILIKE $${paramIdx})`,
      )
      params.push(`%${filters.search}%`)
      paramIdx++
    }

    const whereClause = conditions.join(' AND ')

    const result = await query(
      `SELECT
         v.*,
         COUNT(DISTINCT b.id)::int                                         AS batch_count,
         COALESCE(
           SUM(b.qty_remaining) FILTER (WHERE b.is_consignment = true), 0
         )::int                                                             AS outstanding_qty
       FROM vendors v
       LEFT JOIN batches b ON b.vendor_id = v.id
       WHERE ${whereClause}
       GROUP BY v.id
       ORDER BY v.created_at DESC`,
      params,
    )

    return { success: true, data: result.rows as VendorWithStats[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getVendorById ────────────────────────────────────────────────────────────

export async function getVendorById(
  vendorId: string,
): Promise<{ success: true; data: VendorDetail } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    // Vendor row
    const vendorResult = await query(
      `SELECT * FROM vendors
       WHERE id = $1 AND store_id = $2 LIMIT 1`,
      [vendorId, user.store_id],
    )
    if (vendorResult.rows.length === 0) {
      return { success: false, error: 'Vendor not found or access denied.' }
    }

    // All batches supplied by this vendor with the product name joined in
    const batchResult = await query(
      `SELECT
         b.id,
         b.product_id,
         p.name            AS product_name,
         b.received_at,
         b.qty_received,
         b.qty_remaining,
         b.total_purchase_cost,
         b.is_consignment,
         b.batch_ref
       FROM batches b
       JOIN products p ON p.id = b.product_id
       WHERE b.vendor_id = $1 AND b.store_id = $2
       ORDER BY b.received_at DESC`,
      [vendorId, user.store_id],
    )

    // Outstanding consignment: batches that are consignment AND still have stock
    const outstandingQty = (batchResult.rows as VendorBatchRow[])
      .filter((row) => row.is_consignment && row.qty_remaining > 0)
      .reduce((sum, row) => sum + row.qty_remaining, 0)

    const vendor: VendorDetail = {
      ...(vendorResult.rows[0] as Vendor),
      batches: batchResult.rows as VendorBatchRow[],
      outstanding_consignment_qty: outstandingQty,
    }

    return { success: true, data: vendor }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
