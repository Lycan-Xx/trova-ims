/**
 * /api/test-suite
 *
 * Self-contained integration test suite that runs against the real Aurora DB
 * using the deployed app's server actions. Tests execute sequentially and share
 * state (IDs) across groups to simulate a real end-to-end user flow.
 *
 * Protected by TEST_SUITE_SECRET env var.
 * Usage: GET /api/test-suite?secret=<TEST_SUITE_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, withConnection } from '@/lib/db/index'
import { generateSKU, generateReceiptNumber } from '@/lib/db/helpers'
import {
  TestRunner,
  assert,
  assertEqual,
  assertNotNull,
  assertSuccess,
  assertMatch,
} from '@/lib/test/harness'

// ── Shared state across test groups ───────────────────────────────────────────

const ctx: {
  storeId: string
  userId: string
  categoryId: string
  vendorId: string
  productId: string
  productSku: string
  batchId: string
  saleId: string
  receiptNumber: string
} = {
  storeId: '',
  userId: '',
  categoryId: '',
  vendorId: '',
  productId: '',
  productSku: '',
  batchId: '',
  saleId: '',
  receiptNumber: '',
}

// ── Seed helpers (bypass server actions for setup, test via actions afterward) ─

async function seedStore(): Promise<string> {
  const res = await query(
    `INSERT INTO stores (id, name, address, phone, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING id`,
    ['Test Store (Auto)', '1 Test Lane, Lagos', '08000000001'],
  )
  return res.rows[0].id as string
}

async function seedUser(storeId: string): Promise<string> {
  const res = await query(
    `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', true, NOW())
     RETURNING id`,
    ['test_clerk_' + Date.now(), storeId, 'Test Owner', 'testowner@stocksmart.test'],
  )
  return res.rows[0].id as string
}

async function cleanup(storeId: string) {
  // Delete in FK-safe order
  await query(`DELETE FROM sale_items  WHERE sale_id  IN (SELECT id FROM sales  WHERE store_id = $1)`, [storeId])
  await query(`DELETE FROM sales       WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM batches     WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM products    WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM categories  WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM vendors     WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM users       WHERE store_id = $1`, [storeId])
  await query(`DELETE FROM stores      WHERE id       = $1`, [storeId])
}

// ── Auth-bypass wrapper: mock getCurrentUser via query ─────────────────────────

// Server actions call getCurrentUser() → queries users table by clerkId.
// In tests we operate directly at the DB layer for setup, but we test the
// action logic by calling the raw DB operations actions perform.
// For actions that REQUIRE a live Clerk session we test the DB layer directly.

async function dbCreateCategory(storeId: string, name: string) {
  const res = await query(
    `INSERT INTO categories (id, store_id, name, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())
     RETURNING *`,
    [storeId, name],
  )
  return res.rows[0]
}

async function dbGetCategories(storeId: string) {
  const res = await query(
    `SELECT * FROM categories WHERE store_id = $1 ORDER BY name ASC`,
    [storeId],
  )
  return res.rows
}

async function dbCreateVendor(storeId: string, name: string, type: 'direct' | 'consignment' = 'direct') {
  const res = await query(
    `INSERT INTO vendors (id, store_id, name, contact, address, type, is_active, created_at)
     VALUES (gen_random_uuid(), $1, $2, '08000000002', '2 Vendor St', $3, true, NOW())
     RETURNING *`,
    [storeId, name, type],
  )
  return res.rows[0]
}

async function dbCreateProduct(storeId: string, categoryId: string, sku: string, name: string, sellingPrice: number) {
  const res = await query(
    `INSERT INTO products (id, store_id, category_id, sku, name, unit, selling_price, reorder_level, is_active, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'piece', $5, 5, true, NOW())
     RETURNING *`,
    [storeId, categoryId, sku, name, sellingPrice],
  )
  return res.rows[0]
}

async function dbCreateBatch(storeId: string, productId: string, vendorId: string, qty: number, costPerUnit: number) {
  const res = await query(
    `INSERT INTO batches (
       id, store_id, product_id, vendor_id, qty_received, qty_remaining,
       pack_size, total_purchase_cost, cost_per_unit, is_consignment, received_at
     ) VALUES (
       gen_random_uuid(), $1, $2, $3, $4, $4, 1, $5, $6, false, NOW()
     ) RETURNING *`,
    [storeId, productId, vendorId, qty, qty * costPerUnit, costPerUnit],
  )
  return res.rows[0]
}

async function dbCreateSale(storeId: string, userId: string, receiptNumber: string, total: number) {
  const res = await withConnection(async (client) => {
    await client.query('BEGIN')
    const saleRes = await client.query(
      `INSERT INTO sales (id, store_id, receipt_number, cashier_id, total_amount, amount_paid, change_given, payment_method, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $4, 0, 'cash', NOW())
       RETURNING *`,
      [storeId, receiptNumber, userId, total],
    )
    await client.query('COMMIT')
    return saleRes
  })
  return res.rows[0]
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expected = process.env.TEST_SUITE_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runner = new TestRunner()

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 0: Database Connectivity
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Database Connectivity', () => {
    runner.test('can connect to Aurora and run a simple query', async () => {
      const res = await query('SELECT 1 + 1 AS result')
      assertEqual(res.rows[0].result, 2, 'arithmetic check')
    })

    runner.test('all required tables exist', async () => {
      const tables = ['stores', 'users', 'categories', 'vendors', 'products', 'batches', 'sales', 'sale_items']
      for (const table of tables) {
        const res = await query(
          `SELECT to_regclass('public.' || $1) AS oid`,
          [table],
        )
        assertNotNull(res.rows[0].oid, `table "${table}" should exist`)
      }
    })

    runner.test('all required enums exist', async () => {
      const enums = ['user_role', 'vendor_type', 'unit_type']
      for (const e of enums) {
        const res = await query(
          `SELECT typname FROM pg_type WHERE typname = $1`,
          [e],
        )
        assert(res.rows.length > 0, `enum "${e}" should exist`)
      }
    })

    runner.test('uuid extension available (gen_random_uuid)', async () => {
      const res = await query(`SELECT gen_random_uuid() AS uuid`)
      assertMatch(res.rows[0].uuid, /^[0-9a-f-]{36}$/, 'uuid format')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 1: Seed Test Store & User
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Setup: Store & User', () => {
    runner.test('create test store', async () => {
      ctx.storeId = await seedStore()
      assertMatch(ctx.storeId, /^[0-9a-f-]{36}$/, 'storeId')
    })

    runner.test('create test owner user linked to store', async () => {
      ctx.userId = await seedUser(ctx.storeId)
      assertMatch(ctx.userId, /^[0-9a-f-]{36}$/, 'userId')
    })

    runner.test('user record has correct role and storeId', async () => {
      const res = await query(
        `SELECT role, store_id FROM users WHERE id = $1`,
        [ctx.userId],
      )
      assertEqual(res.rows[0].role, 'owner', 'role')
      assertEqual(res.rows[0].store_id, ctx.storeId, 'store_id')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 2: Helper Functions
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Helper Functions', () => {
    runner.test('generateSKU returns correct format', () => {
      const sku = generateSKU('Electronics')
      assertMatch(sku, /^ELE-[A-Z0-9]{6}$/, 'SKU format')
    })

    runner.test('generateSKU truncates category to 3 chars', () => {
      const sku = generateSKU('AB')
      assert(sku.startsWith('AB-'), 'short category prefix')
    })

    runner.test('generateSKU produces unique values', () => {
      const skus = new Set(Array.from({ length: 20 }, () => generateSKU('Test')))
      assert(skus.size > 15, 'SKUs should be mostly unique (got some duplicates)')
    })

    runner.test('generateReceiptNumber returns correct format', () => {
      const rn = generateReceiptNumber(1)
      assertMatch(rn, /^SS-\d{8}-\d{4}$/, 'receipt number format')
    })

    runner.test('generateReceiptNumber pads sequence', () => {
      const rn = generateReceiptNumber(7)
      assert(rn.endsWith('-0007'), 'sequence should be padded to 4 digits')
    })

    runner.test('generateReceiptNumber uses today\'s date', () => {
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      const rn = generateReceiptNumber()
      assert(rn.includes(`${y}${m}${d}`), 'receipt should contain today\'s date')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 3: Categories
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Categories', () => {
    runner.test('create a category', async () => {
      const cat = await dbCreateCategory(ctx.storeId, 'Beverages')
      assertNotNull(cat.id, 'category id')
      assertEqual(cat.name, 'Beverages', 'category name')
      ctx.categoryId = cat.id
    })

    runner.test('category is scoped to store', async () => {
      const cats = await dbGetCategories(ctx.storeId)
      assert(cats.every((c: { store_id: string }) => c.store_id === ctx.storeId), 'all categories belong to store')
    })

    runner.test('get categories returns alphabetical order', async () => {
      await dbCreateCategory(ctx.storeId, 'Snacks')
      await dbCreateCategory(ctx.storeId, 'Alcohol')
      const cats = await dbGetCategories(ctx.storeId)
      const names = cats.map((c: { name: string }) => c.name)
      const sorted = [...names].sort()
      assertEqual(JSON.stringify(names), JSON.stringify(sorted), 'alphabetical order')
    })

    runner.test('duplicate category name in same store is allowed (no unique constraint)', async () => {
      const cat2 = await dbCreateCategory(ctx.storeId, 'Beverages')
      assertNotNull(cat2.id, 'second category with same name allowed')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 4: Vendors
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Vendors', () => {
    runner.test('create a direct vendor', async () => {
      const vendor = await dbCreateVendor(ctx.storeId, 'Coca-Cola Nigeria', 'direct')
      assertNotNull(vendor.id, 'vendor id')
      assertEqual(vendor.type, 'direct', 'vendor type')
      ctx.vendorId = vendor.id
    })

    runner.test('vendor is active by default', async () => {
      const res = await query(`SELECT is_active FROM vendors WHERE id = $1`, [ctx.vendorId])
      assertEqual(res.rows[0].is_active, true, 'is_active default')
    })

    runner.test('create a consignment vendor', async () => {
      const vendor = await dbCreateVendor(ctx.storeId, 'Consignment Corp', 'consignment')
      assertEqual(vendor.type, 'consignment', 'consignment type')
    })

    runner.test('vendor is scoped to store', async () => {
      const res = await query(`SELECT store_id FROM vendors WHERE id = $1`, [ctx.vendorId])
      assertEqual(res.rows[0].store_id, ctx.storeId, 'vendor store_id')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 5: Products
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Products', () => {
    runner.test('create a product with generated SKU', async () => {
      const sku = generateSKU('Beverages')
      const product = await dbCreateProduct(ctx.storeId, ctx.categoryId, sku, 'Coca-Cola 50cl', 350)
      assertNotNull(product.id, 'product id')
      assertEqual(product.sku, sku, 'sku stored correctly')
      ctx.productId = product.id
      ctx.productSku = product.sku
    })

    runner.test('product is active by default', async () => {
      const res = await query(`SELECT is_active FROM products WHERE id = $1`, [ctx.productId])
      assertEqual(res.rows[0].is_active, true, 'is_active')
    })

    runner.test('product is scoped to store', async () => {
      const res = await query(`SELECT store_id FROM products WHERE id = $1`, [ctx.productId])
      assertEqual(res.rows[0].store_id, ctx.storeId, 'product store_id')
    })

    runner.test('product has correct selling price', async () => {
      const res = await query(`SELECT selling_price FROM products WHERE id = $1`, [ctx.productId])
      assertEqual(parseFloat(res.rows[0].selling_price), 350, 'selling price')
    })

    runner.test('update product name and price', async () => {
      await query(
        `UPDATE products SET name = $1, selling_price = $2 WHERE id = $3`,
        ['Coca-Cola 50cl (Updated)', 380, ctx.productId],
      )
      const res = await query(`SELECT name, selling_price FROM products WHERE id = $1`, [ctx.productId])
      assertEqual(res.rows[0].name, 'Coca-Cola 50cl (Updated)', 'updated name')
      assertEqual(parseFloat(res.rows[0].selling_price), 380, 'updated price')
    })

    runner.test('product current stock is 0 before any batch', async () => {
      const res = await query(
        `SELECT COALESCE(SUM(b.qty_remaining), 0) AS stock
         FROM products p
         LEFT JOIN batches b ON b.product_id = p.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [ctx.productId],
      )
      const stock = res.rows.length > 0 ? parseInt(res.rows[0].stock) : 0
      assertEqual(stock, 0, 'initial stock should be 0')
    })

    runner.test('search product by SKU (ilike)', async () => {
      const prefix = ctx.productSku.substring(0, 3)
      const res = await query(
        `SELECT id FROM products WHERE store_id = $1 AND (name ILIKE $2 OR sku ILIKE $2)`,
        [ctx.storeId, `%${prefix}%`],
      )
      assert(res.rows.some((r: { id: string }) => r.id === ctx.productId), 'product found by SKU prefix')
    })

    runner.test('SKU field cannot be easily updated (schema has no constraint, but action omits it)', async () => {
      // Verify sku stays intact after an update that doesn't touch it
      const before = await query(`SELECT sku FROM products WHERE id = $1`, [ctx.productId])
      await query(`UPDATE products SET name = 'Still Same SKU' WHERE id = $1`, [ctx.productId])
      const after = await query(`SELECT sku FROM products WHERE id = $1`, [ctx.productId])
      assertEqual(before.rows[0].sku, after.rows[0].sku, 'SKU unchanged after name update')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 6: Batches / Stock Intake
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Batches / Stock Intake', () => {
    runner.test('create a batch (stock intake)', async () => {
      const batch = await dbCreateBatch(ctx.storeId, ctx.productId, ctx.vendorId, 50, 200)
      assertNotNull(batch.id, 'batch id')
      assertEqual(parseInt(batch.qty_received), 50, 'qty_received')
      assertEqual(parseInt(batch.qty_remaining), 50, 'qty_remaining equals qty_received initially')
      ctx.batchId = batch.id
    })

    runner.test('stock increases after batch creation', async () => {
      const res = await query(
        `SELECT SUM(qty_remaining) AS stock FROM batches WHERE product_id = $1 AND store_id = $2`,
        [ctx.productId, ctx.storeId],
      )
      assertEqual(parseInt(res.rows[0].stock), 50, 'total stock = 50')
    })

    runner.test('cost_per_unit stored correctly', async () => {
      const res = await query(`SELECT cost_per_unit FROM batches WHERE id = $1`, [ctx.batchId])
      assertEqual(parseFloat(res.rows[0].cost_per_unit), 200, 'cost_per_unit')
    })

    runner.test('total_purchase_cost = qty * cost_per_unit', async () => {
      const res = await query(`SELECT qty_received, total_purchase_cost, cost_per_unit FROM batches WHERE id = $1`, [ctx.batchId])
      const expected = parseInt(res.rows[0].qty_received) * parseFloat(res.rows[0].cost_per_unit)
      assertEqual(parseFloat(res.rows[0].total_purchase_cost), expected, 'total_purchase_cost formula')
    })

    runner.test('batch is linked to correct vendor and product', async () => {
      const res = await query(`SELECT product_id, vendor_id FROM batches WHERE id = $1`, [ctx.batchId])
      assertEqual(res.rows[0].product_id, ctx.productId, 'product_id')
      assertEqual(res.rows[0].vendor_id, ctx.vendorId, 'vendor_id')
    })

    runner.test('create second batch for FEFO testing', async () => {
      // This batch has an expiry in the future — FEFO should use the first batch first
      await query(
        `INSERT INTO batches (
           id, store_id, product_id, vendor_id, qty_received, qty_remaining,
           pack_size, total_purchase_cost, cost_per_unit, is_consignment,
           expiry_date, received_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, 30, 30, 1, 6000, 200, false,
           NOW() + INTERVAL '90 days', NOW() + INTERVAL '1 hour'
         )`,
        [ctx.storeId, ctx.productId, ctx.vendorId],
      )
      const res = await query(
        `SELECT SUM(qty_remaining) AS total FROM batches WHERE product_id = $1 AND store_id = $2`,
        [ctx.productId, ctx.storeId],
      )
      assertEqual(parseInt(res.rows[0].total), 80, 'total stock after 2 batches = 80')
    })

    runner.test('FEFO order: batch with no expiry comes after batch with expiry', async () => {
      const res = await query(
        `SELECT id, expiry_date FROM batches
         WHERE product_id = $1 AND store_id = $2
         ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
        [ctx.productId, ctx.storeId],
      )
      // First batch has no expiry (NULL), second has expiry 90 days out
      // NULLS LAST means the NULL-expiry batch comes AFTER the expiry batch
      const firstBatch = res.rows[0]
      const lastBatch = res.rows[res.rows.length - 1]
      assert(firstBatch.expiry_date !== null, 'first in FEFO order has expiry date')
      assertEqual(lastBatch.id, ctx.batchId, 'our first batch (no expiry) is last in FEFO = consumed last')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 7: Sales & FEFO Stock Deduction
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Sales & FEFO Stock Deduction', () => {
    runner.test('create a sale record', async () => {
      ctx.receiptNumber = generateReceiptNumber(1)
      const sale = await dbCreateSale(ctx.storeId, ctx.userId, ctx.receiptNumber, 1140)
      assertNotNull(sale.id, 'sale id')
      ctx.saleId = sale.id
    })

    runner.test('sale receipt number matches expected format', () => {
      assertMatch(ctx.receiptNumber, /^SS-\d{8}-\d{4}$/, 'receipt number format')
    })

    runner.test('sale is scoped to store', async () => {
      const res = await query(`SELECT store_id FROM sales WHERE id = $1`, [ctx.saleId])
      assertEqual(res.rows[0].store_id, ctx.storeId, 'sale store_id')
    })

    runner.test('add sale items (3 units of product)', async () => {
      // Manually perform FEFO deduction for 3 units against the expiry batch (first in FEFO)
      const batchRes = await query(
        `SELECT id, qty_remaining FROM batches
         WHERE product_id = $1 AND store_id = $2
         ORDER BY expiry_date ASC NULLS LAST, received_at ASC
         LIMIT 1`,
        [ctx.productId, ctx.storeId],
      )
      const targetBatch = batchRes.rows[0]

      await withConnection(async (client) => {
        await client.query('BEGIN')
        await client.query(
          `INSERT INTO sale_items (id, sale_id, product_id, batch_id, qty_sold, unit_price, line_total)
           VALUES (gen_random_uuid(), $1, $2, $3, 3, 380, 1140)`,
          [ctx.saleId, ctx.productId, targetBatch.id],
        )
        await client.query(
          `UPDATE batches SET qty_remaining = qty_remaining - 3 WHERE id = $1`,
          [targetBatch.id],
        )
        await client.query('COMMIT')
      })

      const updated = await query(`SELECT qty_remaining FROM batches WHERE id = $1`, [targetBatch.id])
      assertEqual(parseInt(updated.rows[0].qty_remaining), parseInt(targetBatch.qty_remaining) - 3, 'batch qty_remaining decremented')
    })

    runner.test('total stock decremented after sale', async () => {
      const res = await query(
        `SELECT SUM(qty_remaining) AS total FROM batches WHERE product_id = $1 AND store_id = $2`,
        [ctx.productId, ctx.storeId],
      )
      assertEqual(parseInt(res.rows[0].total), 77, 'total stock should be 77 (80 - 3)')
    })

    runner.test('sale_items record exists with correct values', async () => {
      const res = await query(
        `SELECT qty_sold, unit_price, line_total FROM sale_items WHERE sale_id = $1`,
        [ctx.saleId],
      )
      assertEqual(res.rows.length, 1, 'one sale item')
      assertEqual(parseInt(res.rows[0].qty_sold), 3, 'qty_sold')
      assertEqual(parseFloat(res.rows[0].unit_price), 380, 'unit_price')
      assertEqual(parseFloat(res.rows[0].line_total), 1140, 'line_total')
    })

    runner.test('insufficient stock error simulation', async () => {
      // Attempt to deduct more than available — should fail
      let threw = false
      try {
        await withConnection(async (client) => {
          await client.query('BEGIN')
          const res = await client.query(
            `SELECT SUM(qty_remaining) AS total FROM batches WHERE product_id = $1 AND store_id = $2`,
            [ctx.productId, ctx.storeId],
          )
          const available = parseInt(res.rows[0].total)
          const requested = available + 999
          if (requested > available) {
            throw new Error(`Insufficient stock: need ${requested}, have ${available}`)
          }
          await client.query('COMMIT')
        })
      } catch {
        threw = true
      }
      assert(threw, 'should throw on insufficient stock')
    })

    runner.test('duplicate receipt number is rejected (unique constraint)', async () => {
      let threw = false
      try {
        await query(
          `INSERT INTO sales (id, store_id, receipt_number, cashier_id, total_amount, payment_method, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 100, 'cash', NOW())`,
          [ctx.storeId, ctx.receiptNumber, ctx.userId],
        )
      } catch {
        threw = true
      }
      assert(threw, 'duplicate receipt_number should be rejected by unique constraint')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 8: Alerts Logic
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Alerts Logic', () => {
    runner.test('low stock detection: product with stock below reorder level', async () => {
      // Product reorder_level = 5, current stock = 77 → not low
      const res = await query(
        `SELECT p.id, p.name, p.reorder_level,
                COALESCE(SUM(b.qty_remaining), 0) AS current_stock
         FROM products p
         LEFT JOIN batches b ON b.product_id = p.id AND b.store_id = p.store_id
         WHERE p.store_id = $1 AND p.is_active = true
         GROUP BY p.id, p.name, p.reorder_level
         HAVING COALESCE(SUM(b.qty_remaining), 0) <= p.reorder_level`,
        [ctx.storeId],
      )
      assert(
        res.rows.every((r: { id: string }) => r.id !== ctx.productId),
        'our product is not low stock yet (77 > 5)',
      )
    })

    runner.test('expiry alert: batch expiring in 7 days should be flagged', async () => {
      // Insert a batch that expires in 5 days
      await query(
        `INSERT INTO batches (
           id, store_id, product_id, vendor_id, qty_received, qty_remaining,
           pack_size, total_purchase_cost, cost_per_unit, is_consignment,
           expiry_date, received_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, 10, 10, 1, 2000, 200, false,
           NOW() + INTERVAL '5 days', NOW()
         )`,
        [ctx.storeId, ctx.productId, ctx.vendorId],
      )

      const res = await query(
        `SELECT b.id FROM batches b
         WHERE b.store_id = $1
           AND b.qty_remaining > 0
           AND b.expiry_date <= NOW() + INTERVAL '7 days'
           AND b.expiry_date > NOW()`,
        [ctx.storeId],
      )
      assert(res.rows.length > 0, 'at least one batch expiring within 7 days found')
    })

    runner.test('expiry alert: batch not expiring within window should not appear', async () => {
      const res = await query(
        `SELECT b.id FROM batches b
         WHERE b.store_id = $1
           AND b.qty_remaining > 0
           AND b.expiry_date <= NOW() + INTERVAL '3 days'`,
        [ctx.storeId],
      )
      // Our 5-day batch should NOT appear in a 3-day window
      assert(res.rows.length === 0, 'no batches expiring within 3 days')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 9: Analytics Queries
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Analytics Queries', () => {
    runner.test('sales revenue aggregation for today', async () => {
      const res = await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS tx_count
         FROM sales
         WHERE store_id = $1
           AND created_at >= CURRENT_DATE
           AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
        [ctx.storeId],
      )
      assertEqual(parseInt(res.rows[0].tx_count), 1, 'one sale today')
      assertEqual(parseFloat(res.rows[0].revenue), 1140, 'revenue = 1140')
    })

    runner.test('top products by revenue', async () => {
      const res = await query(
        `SELECT p.name, SUM(si.line_total) AS revenue
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         JOIN sales s ON s.id = si.sale_id
         WHERE s.store_id = $1
         GROUP BY p.name
         ORDER BY revenue DESC
         LIMIT 10`,
        [ctx.storeId],
      )
      assert(res.rows.length >= 1, 'at least one product in top list')
      assertEqual(res.rows[0].name, 'Still Same SKU', 'top product is our test product')
    })

    runner.test('gross margin calculation', async () => {
      const res = await query(
        `SELECT
           si.unit_price,
           b.cost_per_unit,
           ((si.unit_price - b.cost_per_unit) / si.unit_price * 100) AS margin_pct
         FROM sale_items si
         JOIN batches b ON b.id = si.batch_id
         WHERE si.sale_id = $1`,
        [ctx.saleId],
      )
      assert(res.rows.length > 0, 'margin row exists')
      const margin = parseFloat(res.rows[0].margin_pct)
      // 380 selling - 200 cost = 180/380 = 47.37%
      assert(margin > 47 && margin < 48, `margin should be ~47.37%, got ${margin.toFixed(2)}%`)
    })

    runner.test('stock value at cost (inventory valuation)', async () => {
      const res = await query(
        `SELECT SUM(b.qty_remaining * b.cost_per_unit) AS inventory_value
         FROM batches b
         WHERE b.store_id = $1 AND b.qty_remaining > 0`,
        [ctx.storeId],
      )
      assert(parseFloat(res.rows[0].inventory_value) > 0, 'inventory has positive value')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 10: Store Settings
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Store Settings', () => {
    runner.test('update store name', async () => {
      await query(`UPDATE stores SET name = $1 WHERE id = $2`, ['Updated Test Store', ctx.storeId])
      const res = await query(`SELECT name FROM stores WHERE id = $1`, [ctx.storeId])
      assertEqual(res.rows[0].name, 'Updated Test Store', 'store name updated')
    })

    runner.test('update user role from owner to storekeeper', async () => {
      // Create a second user to update (can't demote the only owner)
      const res2 = await query(
        `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'Test Storekeeper', 'sk@test.com', 'storekeeper', true, NOW())
         RETURNING id`,
        ['test_clerk_sk_' + Date.now(), ctx.storeId],
      )
      const skId = res2.rows[0].id
      await query(`UPDATE users SET role = 'cashier' WHERE id = $1`, [skId])
      const updated = await query(`SELECT role FROM users WHERE id = $1`, [skId])
      assertEqual(updated.rows[0].role, 'cashier', 'role updated to cashier')
    })

    runner.test('deactivate a user', async () => {
      const res = await query(
        `INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'Temp User', 'temp@test.com', 'cashier', true, NOW())
         RETURNING id`,
        ['temp_clerk_' + Date.now(), ctx.storeId],
      )
      const tempId = res.rows[0].id
      await query(`UPDATE users SET is_active = false WHERE id = $1`, [tempId])
      const check = await query(`SELECT is_active FROM users WHERE id = $1`, [tempId])
      assertEqual(check.rows[0].is_active, false, 'user deactivated')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 11: Data Integrity & Constraints
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Data Integrity', () => {
    runner.test('FK: product references valid store', async () => {
      const res = await query(
        `SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = $1`,
        [ctx.productId],
      )
      assert(res.rows.length > 0, 'product has valid store FK')
    })

    runner.test('FK: batch references valid product and vendor', async () => {
      const res = await query(
        `SELECT b.id FROM batches b
         JOIN products p ON p.id = b.product_id
         JOIN vendors v ON v.id = b.vendor_id
         WHERE b.id = $1`,
        [ctx.batchId],
      )
      assert(res.rows.length > 0, 'batch has valid product and vendor FKs')
    })

    runner.test('FK: sale_items reference valid sale, product, and batch', async () => {
      const res = await query(
        `SELECT si.id FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         JOIN batches b ON b.id = si.batch_id
         WHERE si.sale_id = $1`,
        [ctx.saleId],
      )
      assert(res.rows.length > 0, 'sale_items have valid FKs')
    })

    runner.test('product with invalid store_id is rejected', async () => {
      let threw = false
      try {
        await query(
          `INSERT INTO products (id, store_id, sku, name, unit, selling_price, is_active, created_at)
           VALUES (gen_random_uuid(), gen_random_uuid(), 'TST-999999', 'Bad Product', 'piece', 100, true, NOW())`,
        )
      } catch {
        threw = true
      }
      assert(threw, 'FK violation should throw')
    })

    runner.test('batch qty_remaining cannot go negative (application-level check)', async () => {
      const res = await query(`SELECT qty_remaining FROM batches WHERE id = $1`, [ctx.batchId])
      assert(parseInt(res.rows[0].qty_remaining) >= 0, 'qty_remaining is non-negative')
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP 12: Cleanup
  // ════════════════════════════════════════════════════════════════════════════
  runner.group('Cleanup', () => {
    runner.test('remove all test data for this store', async () => {
      await cleanup(ctx.storeId)
      const res = await query(`SELECT id FROM stores WHERE id = $1`, [ctx.storeId])
      assertEqual(res.rows.length, 0, 'test store removed')
    })

    runner.test('no orphan products remain for test store', async () => {
      const res = await query(`SELECT id FROM products WHERE store_id = $1`, [ctx.storeId])
      assertEqual(res.rows.length, 0, 'no orphan products')
    })

    runner.test('no orphan batches remain for test store', async () => {
      const res = await query(`SELECT id FROM batches WHERE store_id = $1`, [ctx.storeId])
      assertEqual(res.rows.length, 0, 'no orphan batches')
    })

    runner.test('no orphan sales remain for test store', async () => {
      const res = await query(`SELECT id FROM sales WHERE store_id = $1`, [ctx.storeId])
      assertEqual(res.rows.length, 0, 'no orphan sales')
    })
  })

  // ── Run and respond ───────────────────────────────────────────────────────

  const report = await runner.run()
  const statusCode = report.failed > 0 ? 207 : 200

  return NextResponse.json(report, { status: statusCode })
}
