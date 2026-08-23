'use server'

import { query } from '@/lib/db'
import { requireStoreAccess, requireOwner } from '@/lib/auth'
import { generateSKU } from '@/lib/db/helpers'
import type { Product, Category, Batch } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductWithStock extends Product {
  category_name: string | null
  current_stock: number
}

export interface ProductDetail extends ProductWithStock {
  batches: Batch[]
}

export interface GetProductsResult {
  products: ProductWithStock[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface GetProductsFilters {
  search?: string
  categoryId?: string
  stockStatus?: 'all' | 'low' | 'out'
  page?: number
}

const PAGE_SIZE = 20

// ─── createProduct ────────────────────────────────────────────────────────────

export async function createProduct(formData: {
  name: string
  categoryId?: string
  unit?: string
  sellingPrice: number | string
  reorderLevel?: number
  description?: string
  barcode?: string | null
}): Promise<{ success: true; data: Product } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    // Resolve category name for SKU generation
    let categoryName = 'GEN'
    if (formData.categoryId) {
      const catResult = await query(
        'SELECT name FROM categories WHERE id = $1 AND store_id = $2 LIMIT 1',
        [formData.categoryId, user.store_id],
      )
      if (catResult.rows.length > 0) {
        categoryName = catResult.rows[0].name as string
      }
    }

    const sku = generateSKU(categoryName)
    const barcode = formData.barcode?.trim() || null

    const result = await query(
      `INSERT INTO products
        (id, store_id, category_id, sku, name, description, barcode, unit, selling_price, reorder_level, is_active, created_at)
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       RETURNING *`,
      [
        user.store_id,
        formData.categoryId ?? null,
        sku,
        formData.name,
        formData.description ?? null,
        barcode,
        formData.unit ?? 'piece',
        formData.sellingPrice,
        formData.reorderLevel ?? 10,
      ],
    )

    return { success: true, data: result.rows[0] as Product }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { success: false, error: 'That barcode is already assigned to another product.' }
    }
    return { success: false, error: msg }
  }
}

// ─── updateProduct ────────────────────────────────────────────────────────────

export async function updateProduct(
  productId: string,
  formData: {
    name?: string
    categoryId?: string | null
    unit?: string
    sellingPrice?: number | string
    reorderLevel?: number
    description?: string | null
    barcode?: string | null
  },
): Promise<{ success: true; data: Product } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    // Verify ownership before mutating
    const existing = await query(
      'SELECT id FROM products WHERE id = $1 AND store_id = $2 LIMIT 1',
      [productId, user.store_id],
    )
    if (existing.rows.length === 0) {
      return { success: false, error: 'Product not found or access denied.' }
    }

    const result = await query(
      `UPDATE products SET
        name           = COALESCE($1, name),
        category_id    = $2,
        unit           = COALESCE($3, unit),
        selling_price  = COALESCE($4, selling_price),
        reorder_level  = COALESCE($5, reorder_level),
        description    = $6,
        barcode        = $7
       WHERE id = $8 AND store_id = $9
       RETURNING *`,
      [
        formData.name ?? null,
        formData.categoryId !== undefined ? formData.categoryId : null,
        formData.unit ?? null,
        formData.sellingPrice !== undefined ? formData.sellingPrice : null,
        formData.reorderLevel ?? null,
        formData.description !== undefined ? formData.description : null,
        formData.barcode !== undefined ? (formData.barcode?.trim() || null) : null,
        productId,
        user.store_id,
      ],
    )

    return { success: true, data: result.rows[0] as Product }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { success: false, error: 'That barcode is already assigned to another product.' }
    }
    return { success: false, error: msg }
  }
}

// ─── deactivateProduct ────────────────────────────────────────────────────────
// Soft delete — hides from catalog and POS but keeps history intact.

export async function deactivateProduct(
  productId: string,
): Promise<{ success: true; data: Product } | { success: false; error: string }> {
  try {
    const user = await requireOwner()

    const existing = await query(
      'SELECT id FROM products WHERE id = $1 AND store_id = $2 LIMIT 1',
      [productId, user.store_id],
    )
    if (existing.rows.length === 0) {
      return { success: false, error: 'Product not found or access denied.' }
    }

    const result = await query(
      `UPDATE products SET is_active = false
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      [productId, user.store_id],
    )

    return { success: true, data: result.rows[0] as Product }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── deleteProduct ─────────────────────────────────────────────────────────────
// Hard delete. Blocked by the database if the product has any batches or
// sale_items (ON DELETE RESTRICT foreign keys), which is the right behaviour —
// you can't delete a product that's part of existing stock or sales history.
// The UI should only expose this for products with no recorded batches.

export async function deleteProduct(
  productId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireOwner()

    const existing = await query(
      'SELECT id FROM products WHERE id = $1 AND store_id = $2 LIMIT 1',
      [productId, user.store_id],
    )
    if (existing.rows.length === 0) {
      return { success: false, error: 'Product not found or access denied.' }
    }

    // Check for existing batches before attempting the delete — gives a
    // cleaner error message than letting the FK constraint fire.
    const batchCheck = await query(
      'SELECT id FROM batches WHERE product_id = $1 LIMIT 1',
      [productId],
    )
    if (batchCheck.rows.length > 0) {
      return {
        success: false,
        error:
          'This product has stock intake records and cannot be deleted. ' +
          'Use Deactivate to hide it from the catalog instead.',
      }
    }

    await query(
      'DELETE FROM products WHERE id = $1 AND store_id = $2',
      [productId, user.store_id],
    )

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getProducts ──────────────────────────────────────────────────────────────

export async function getProducts(
  filters: GetProductsFilters = {},
): Promise<{ success: true; data: GetProductsResult } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    const page = Math.max(1, filters.page ?? 1)
    const offset = (page - 1) * PAGE_SIZE

    // Build dynamic WHERE clauses
    const conditions: string[] = ['p.store_id = $1', 'p.is_active = true']
    const params: unknown[] = [user.store_id]
    let paramIdx = 2

    if (filters.search) {
      conditions.push(
        `(p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`,
      )
      params.push(`%${filters.search}%`)
      paramIdx++
    }

    if (filters.categoryId) {
      conditions.push(`p.category_id = $${paramIdx}`)
      params.push(filters.categoryId)
      paramIdx++
    }

    const whereClause = conditions.join(' AND ')

    // Stock status filter is applied as a HAVING clause on the aggregated CTE
    let havingClause = ''
    if (filters.stockStatus === 'out') {
      havingClause = 'HAVING COALESCE(SUM(b.qty_remaining), 0) = 0'
    } else if (filters.stockStatus === 'low') {
      havingClause = 'HAVING COALESCE(SUM(b.qty_remaining), 0) > 0 AND COALESCE(SUM(b.qty_remaining), 0) <= p.reorder_level'
    }

    // Count query (uses same CTE pattern for accurate stock-filtered counts)
    const countSql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN batches b ON b.product_id = p.id
        WHERE ${whereClause}
        GROUP BY p.id, p.reorder_level
        ${havingClause}
      ) sub
    `
    const countResult = await query(countSql, params)
    const totalCount = parseInt(countResult.rows[0].total as string, 10)
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    // Data query
    const dataSql = `
      SELECT
        p.*,
        c.name AS category_name,
        COALESCE(SUM(b.qty_remaining), 0)::int AS current_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN batches b ON b.product_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id, c.name
      ${havingClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `
    params.push(PAGE_SIZE, offset)

    const dataResult = await query(dataSql, params)

    return {
      success: true,
      data: {
        products: dataResult.rows as ProductWithStock[],
        totalCount,
        totalPages,
        currentPage: page,
      },
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getAllActiveProducts ───────────────────────────────────────────────────
//
// getProducts() is paginated (PAGE_SIZE = 20) for the Products page's table
// view. That's the wrong shape for pickers like the Stock Intake form's
// product select — it silently truncated the dropdown to the 20 most
// recently created products, hiding every older product entirely once a
// store passed 20 SKUs. This returns the full active catalog, unpaginated,
// for use anywhere a complete list is needed instead of a page of it.

export async function getAllActiveProducts(): Promise<
  { success: true; data: ProductWithStock[] } | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `SELECT
        p.*,
        c.name AS category_name,
        COALESCE(SUM(b.qty_remaining), 0)::int AS current_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN batches b ON b.product_id = p.id
      WHERE p.store_id = $1 AND p.is_active = true
      GROUP BY p.id, c.name
      ORDER BY p.name ASC`,
      [user.store_id],
    )

    return { success: true, data: result.rows as ProductWithStock[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getProductByBarcode ─────────────────────────────────────────────────────
// Exact-match lookup used by the barcode scan flow (POS, Stock Intake, and
// the product form's own scan-to-prefill field). Barcodes are exact codes,
// not free text, so this is a plain equality match rather than the ILIKE
// substring search getProducts() uses for typed queries.

export async function getProductByBarcode(
  barcode: string,
): Promise<{ success: true; data: ProductWithStock | null } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    const trimmed = barcode.trim()
    if (!trimmed) {
      return { success: true, data: null }
    }

    const result = await query(
      `SELECT
         p.*,
         c.name AS category_name,
         COALESCE(SUM(b.qty_remaining), 0)::int AS current_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN batches b ON b.product_id = p.id
       WHERE p.barcode = $1 AND p.store_id = $2 AND p.is_active = true
       GROUP BY p.id, c.name
       LIMIT 1`,
      [trimmed, user.store_id],
    )

    return { success: true, data: (result.rows[0] as ProductWithStock) ?? null }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── getProductById ───────────────────────────────────────────────────────────

export async function getProductById(
  productId: string,
): Promise<{ success: true; data: ProductDetail } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()

    const productResult = await query(
      `SELECT
         p.*,
         c.name AS category_name,
         COALESCE(SUM(b.qty_remaining), 0)::int AS current_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN batches b ON b.product_id = p.id
       WHERE p.id = $1 AND p.store_id = $2
       GROUP BY p.id, c.name`,
      [productId, user.store_id],
    )

    if (productResult.rows.length === 0) {
      return { success: false, error: 'Product not found or access denied.' }
    }

    const batchResult = await query(
      `SELECT * FROM batches
       WHERE product_id = $1 AND store_id = $2
       ORDER BY received_at DESC`,
      [productId, user.store_id],
    )

    const product: ProductDetail = {
      ...(productResult.rows[0] as ProductWithStock),
      batches: batchResult.rows as Batch[],
    }

    return { success: true, data: product }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── createCategory ───────────────────────────────────────────────────────────

export async function createCategory(
  name: string,
): Promise<{ success: true; data: Category } | { success: false; error: string }> {
  try {
    const user = await requireOwner()

    const result = await query(
      `INSERT INTO categories (id, store_id, name, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       RETURNING *`,
      [user.store_id, name.trim()],
    )

    return { success: true, data: result.rows[0] as Category }
  } catch (err) {
    // Catch potential duplicate name violations gracefully
    const msg = (err as Error).message
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { success: false, error: `A category named "${name}" already exists.` }
    }
    return { success: false, error: msg }
  }
}

// ─── getCategories ────────────────────────────────────────────────────────────

export async function getCategories(): Promise<
  { success: true; data: Category[] } | { success: false; error: string }
> {
  try {
    const user = await requireStoreAccess()

    const result = await query(
      `SELECT * FROM categories
       WHERE store_id = $1
       ORDER BY name ASC`,
      [user.store_id],
    )

    return { success: true, data: result.rows as Category[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
