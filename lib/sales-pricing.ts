import type { ClientBase } from 'pg'

export interface CartItem { productId: string; qtySold: number }
export interface SaleDeduction {
  batchId: string | null
  productId: string
  productName: string
  qtyDeducted: number
  unitPrice: number
}
export interface SaleQuote {
  totalAmount: string
  items: { productId: string; productName: string; qtySold: number; unitPrice: string; lineTotal: string }[]
}

export function normalizeCart(items: CartItem[]): CartItem[] {
  if (!Array.isArray(items) || !items.length || items.length > 500) throw new Error('Invalid or empty cart.')
  const quantities = new Map<string, number>()
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.productId) ||
        !Number.isSafeInteger(item.qtySold) || item.qtySold <= 0) {
      throw new Error('Each cart item must have a valid product and a positive whole-number quantity.')
    }
    const productId = item.productId.toLowerCase()
    const qty = (quantities.get(productId) ?? 0) + item.qtySold
    if (qty > 2147483647) throw new Error('Quantity is too large.')
    quantities.set(productId, qty)
  }
  // Consistent row-lock order also avoids opposing basket orders deadlocking.
  return [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([productId, qtySold]) => ({ productId, qtySold }))
}

export function moneyCents(value: number): number {
  const cents = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents) || cents > 999999999999) {
    throw new Error('Invalid or excessive monetary amount.')
  }
  return cents
}

/** Called only with a transaction-scoped client. Quotes and checkout share this logic. */
export async function resolveSaleDeductions(client: ClientBase, storeId: string, items: CartItem[]): Promise<SaleDeduction[]> {
  const deductions: SaleDeduction[] = []
  for (const item of normalizeCart(items)) {
    const products = await client.query(
      `SELECT id, name, selling_price, track_inventory FROM products
       WHERE id = $1 AND store_id = $2 AND is_active = true FOR UPDATE`, [item.productId, storeId],
    )
    const product = products.rows[0]
    if (!product) throw new Error(`Product not found: ${item.productId}`)
    const defaultPrice = moneyCents(Number(product.selling_price)) / 100
    if (!product.track_inventory) {
      deductions.push({ batchId: null, productId: item.productId, productName: product.name, qtyDeducted: item.qtySold, unitPrice: defaultPrice })
      continue
    }
    const batches = await client.query(
      `SELECT id, qty_remaining, selling_price_override FROM batches
       WHERE product_id = $1 AND store_id = $2 AND qty_remaining > 0
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC, id ASC FOR UPDATE`, [item.productId, storeId],
    )
    let remaining = item.qtySold
    for (const batch of batches.rows) {
      if (!remaining) break
      const qty = Math.min(remaining, Number(batch.qty_remaining))
      const price = batch.selling_price_override === null ? defaultPrice : moneyCents(Number(batch.selling_price_override)) / 100
      deductions.push({ batchId: batch.id, productId: item.productId, productName: product.name, qtyDeducted: qty, unitPrice: price })
      remaining -= qty
    }
    if (remaining) throw new Error(`Insufficient stock for ${product.name}`)
  }
  return deductions
}

export function quoteFromDeductions(deductions: SaleDeduction[]): SaleQuote {
  const items = deductions.map(d => ({
    productId: d.productId, productName: d.productName, qtySold: d.qtyDeducted,
    unitPrice: d.unitPrice.toFixed(2), lineTotal: (moneyCents(d.unitPrice) * d.qtyDeducted / 100).toFixed(2),
  }))
  const totalCents = items.reduce((sum, item) => sum + moneyCents(Number(item.lineTotal)), 0)
  moneyCents(totalCents / 100)
  return { totalAmount: (totalCents / 100).toFixed(2), items }
}
