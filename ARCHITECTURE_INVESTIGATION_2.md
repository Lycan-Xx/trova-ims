# Follow-Up Investigation: Shared Application vs Duplicated Routes

**Date:** August 23, 2026  
**Focus:** Can the public demo be a shared application with only the data layer changing?  
**Status:** Deep technical investigation of execution paths

---

## Executive Summary

**VERDICT: YES — shared application is technically feasible, but with a critical caveat.**

The application CAN execute mutations against browser-local PGlite if you solve the Server Action boundary problem. However, the current architecture has a fundamental issue that requires refactoring to make this work cleanly.

### The Core Problem

All application operations are **Server Actions** (`'use server'` directive). Server Actions execute on the Next.js server, not in the browser. When you call a Server Action from a client component, the following happens:

```
Client Component (browser)
  ↓
Server Action (Next.js server)
  ↓
query() or withConnection() (Node.js process)
  ↓
Database (wherever it's configured)
```

The browser-local PGlite database exists inside the browser's IndexedDB, not accessible from the Next.js server process. **Server Actions cannot directly access browser-local PGlite.**

Therefore: **You cannot call the existing Server Actions from `/demo` and have them automatically work against browser-local data.**

This is not a limitation of the database abstraction. It's a fundamental architectural boundary: **Server Actions run on the server, not in the browser.**

---

## 1. Shared UI Feasibility

### Can the existing dashboard/application be reused for /demo without duplicating all routes?

**Short answer:** Technically yes, but with caveats.

**Long answer:**

The **UI/presentation layer** is completely generic and can be reused:
- All page files (`dashboard/page.tsx`, `products/page.tsx`, `sales/page.tsx`, etc.)
- All component files (`ProductList`, `ProductSlideOver`, `IntakeForm`, etc.)
- All styling and layout logic

These are 100% reusable between `/demo` and `/(dashboard)`.

However, they **must be** invoked via different **data access patterns**:

**Current pattern (works for private dev + desktop):**
```typescript
// components/products/product-slide-over.tsx
const result = await createProduct(payload)  // Server Action
```

This Server Action runs on the server and accesses `query()`, which is configured per runtime:
- Private dev: `query()` → Aurora
- Desktop: `query()` → Local PGlite (works because both are Node.js processes)
- **Demo (FAILS)**: `query()` → Aurora (because the action runs on the server, not browser)

**What you'd need for demo:**
```typescript
// For browser execution:
const result = await createProductLocally(payload)  // Browser-side function
  ↓
  Directly uses browser PGlite instance
  ↓
  No server round-trip
```

### Duplication Required?

**No route duplication is strictly necessary,** but you must solve the Server Action problem. Two approaches:

**Approach 1: Keep single route tree, but switch execution path at component level**
```typescript
// components/products/product-slide-over.tsx (shared)
const result = IS_BROWSER_DEMO
  ? await createProductLocally(payload)      // Browser-side, direct DB
  : await createProduct(payload)             // Server Action
```

Requires extracting business logic from Server Actions into reusable functions that can run in both contexts.

**Approach 2: Duplicate route structure, different data adapters**
```
/(dashboard)/products/page.tsx  → uses Server Actions → Aurora
/demo/products/page.tsx         → uses client data adapter → Browser PGlite
```

Duplicates the route tree but allows you to keep Server Actions unchanged in private dev.

---

## 2. Browser-Local Execution: Critical Finding

### Can the actual CRUD workflows execute against browser-local PGlite?

**No, not with the current architecture.**

Let me trace the actual execution paths:

### Operation 1: Product Creation

```
app/components/products/product-slide-over.tsx (Client Component)
  ↓ 'use client'
  handleSubmit() calls createProduct(payload)
  ↓
app/actions/products.ts:createProduct() (Server Action)
  ↓ 'use server' → runs on Next.js server process
  requireStoreAccess() → checks Better Auth session (requires server cookies)
  ↓
  query(INSERT ...) → calls lib/db/index.ts:query()
  ↓
  if IS_DESKTOP: desktopQuery()  [✓ works: local PGlite]
  else: pool.query()             [✓ works: Aurora]
  
  IS_BROWSER_DEMO? UNDEFINED BEHAVIOR
  Attempt to query Aurora (server will fail if no cloud DB configured)
```

**Problem**: `query()` routing is decided at **runtime** based on env vars set when the Next.js server starts. For `/demo` to work, you'd need:
1. Start the server with a flag indicating demo mode
2. But demo mode isn't known at build/server startup time — it's a **route**

**Result**: Server Actions cannot be made to route to browser PGlite without either:
- Refactoring to pass database context through every action
- OR moving database logic out of Server Actions

### Operation 2: Sale Creation (Most Complex)

```
components/checkout/checkout-form.tsx (Client)
  ↓
app/actions/sales.ts:createSale(cartItems, paymentMethod, amountPaid)
  ↓ Server Action (runs on server)
  await withConnection(async (client) => { ... })
  ↓ Expects client to be a PostgreSQL connection (from lib/db/index.ts)
  
  // Current code:
  if (IS_DESKTOP) throw Error("withConnection not available in desktop mode")
  const client = await pool.connect()
  
  FOR UPDATE locks, transactions, COMMIT/ROLLBACK
  ↓
  All happen on server against remote PostgreSQL
```

**The transaction logic is hardcoded to assume a remote PostgreSQL server.**

**Problem**: `withConnection()` is not implemented for browser PGlite. You cannot do `FOR UPDATE` locks in a browser SQLite context anyway (different concurrency model).

**Result**: Complex multi-statement transactions (sales, batch intake sessions) cannot run in browser without complete rewrite.

### Operation 3: Product Read (Simple)

```
app/(dashboard)/products/page.tsx
  ↓
app/actions/products.ts:getProducts(filters)
  ↓ Server Action
  query(SELECT ...)
  ↓
  Routes to Aurora or local PGlite based on IS_DESKTOP
  ↓
  ✓ Works
```

**Reads generally work** because they're simple `query()` calls with no transaction semantics.

### Summary: Which Operations Can Run in Browser?

| Operation | Current | Browser Demo | Notes |
|-----------|---------|--------------|-------|
| **getProducts()** | ✓ Query | ✓ Can work | Simple SELECT |
| **createProduct()** | ✓ Server Action | ✗ Cannot work | Requires Server Action |
| **updateProduct()** | ✓ Server Action | ✗ Cannot work | Requires Server Action |
| **deactivateProduct()** | ✓ Server Action | ✗ Cannot work | Requires Server Action |
| **createSale()** | ✓ Server Action + withConnection | ✗ Cannot work | Uses FOR UPDATE locks |
| **createBatchSession()** | ✓ Server Action + withConnection | ✗ Cannot work | Multi-statement transaction |
| **getSales()** | ✓ Query | ✓ Can work | Simple SELECT |
| **getAlerts()** | ✓ Query | ✓ Can work | SELECT + computed |
| **getAnalytics()** | ✓ Query | ✓ Can work | SELECT + computed |

**Result**: ~30% of operations can work unchanged. 70% require either Server Actions to change or a new data access layer.

---

## 3. Server Action Boundary — The Fundamental Issue

### Which existing actions are server-only?

**ALL OF THEM are server-only by design:**

1. **All 8 action files have `'use server'` directive at the top**
   - They execute on the Next.js server, not browser
   - They read server-side cookies (Better Auth session)
   - They call `requireStoreAccess()` which depends on server-side auth

2. **Some are more server-dependent than others:**

   **Tier 1: Can work with minimal changes** (just need data layer swap)
   - `getProducts()` — just SELECT
   - `getAllActiveProducts()` — just SELECT
   - `getProductByBarcode()` — just SELECT
   - `getProductById()` — just SELECT
   - `getCategories()` — just SELECT
   - `getSales()` — just SELECT (with filters)
   - `getSaleById()` — just SELECT
   - `getAlerts()` — SELECT + computed
   - `getAnalytics()` — SELECT + computed
   - `getVendors()` — just SELECT
   - `getVendorById()` — just SELECT
   - `getUsers()` — just SELECT
   - `getCashiers()` — just SELECT

   **Tier 2: Require transaction refactoring**
   - `createProduct()` — uses `query()` only, can work with data adapter
   - `updateProduct()` — uses `query()` only, can work with data adapter
   - `deactivateProduct()` — uses `query()` only, can work with data adapter
   - `createVendor()` — uses `query()` only, can work with data adapter
   - `updateVendor()` — uses `query()` only, can work with data adapter
   - `deactivateVendor()` — uses `query()` only, can work with data adapter
   - `updateStoreSettings()` — uses `query()` only, can work with data adapter
   - `createCategory()` — uses `query()` only, can work with data adapter
   - `updateUserProfile()` — uses `query()` only, can work with data adapter

   **Tier 3: Require complete rewrite**
   - `createSale()` — uses `withConnection()` + `FOR UPDATE` + transactions
   - `createBatchSession()` — uses `withConnection()` + multi-statement transaction
   - Auth-related actions — depend on Better Auth session management

### The Problem

**Server Actions cannot be made context-aware without major refactoring.**

Current Server Action pattern:
```typescript
// app/actions/products.ts
export async function createProduct(formData) {
  'use server'
  
  const user = await getCurrentUser()          // Gets from session
  const result = await query(INSERT ...)       // Decided by IS_DESKTOP env var
  return result
}
```

This action **always** runs on the Next.js server. There's no way to make it run in the browser instead. The `'use server'` directive is compile-time — it tells Next.js to only run this function on the server.

**You cannot:**
- Call a Server Action and have it execute in the browser
- Make a Server Action aware of what database backend to use per-request
- Pass a database connection object into a Server Action

**The only solution is to refactor.**

---

## 4. Three Possible Refactoring Approaches

### Option A: Shared Domain Functions + Dual Adapters (RECOMMENDED)

Extract all logic from Server Actions into pure domain functions, then create two adapters:

```typescript
// lib/domain/products.ts (pure, no database access)
export interface CreateProductInput { name, categoryId?, sellingPrice, ... }
export interface CreateProductOutput { success: boolean; data?: Product; error?: string }

export async function createProductLogic(
  input: CreateProductInput,
  db: Database  // interface, not implementation
): Promise<CreateProductOutput> {
  // All business logic, no Server Action decorator
  const sku = generateSKU(...)
  const result = await db.query(INSERT ..., params)
  return { success: true, data: result }
}
```

Then create two adapters:

```typescript
// app/actions/products.ts (Server adapter)
export async function createProduct(formData) {
  'use server'
  const user = await getCurrentUser()
  return createProductLogic(formData, serverDatabase)  // Database interface
}

// lib/db/browser-adapter.ts (Browser adapter)
export async function createProductBrowser(formData) {
  // No 'use server' — runs in browser
  const user = demoUser
  return createProductLogic(formData, browserDatabase)  // Browser DB interface
}
```

**Then in shared components:**
```typescript
const result = IS_BROWSER_DEMO
  ? await createProductBrowser(payload)     // Browser-side
  : await createProduct(payload)            // Server Action
```

**Pros:**
- Keep all application logic shared
- Server Actions remain mostly unchanged
- Clear separation: logic vs. adapters

**Cons:**
- Requires extracting every action into a domain function
- More code
- TypeScript interfaces needed for Database abstraction

### Option B: Duplicate Routes with Client Data Adapters (SIMPLER BUT LESS SHARED)

Create separate `/demo` route tree that uses a completely different data access pattern:

```
/(dashboard)/products/page.tsx     → Server component → getProducts() → Server Action → Aurora
/demo/products/page.tsx            → Client component → getProductsClient() → Direct PGlite
```

Same UI components, but imported differently:

```typescript
// app/(dashboard)/products/page.tsx
import { ProductList } from '@/components/products/product-list'
import { getProducts } from '@/app/actions/products'

export default async function ProductsPage() {
  const result = await getProducts()
  return <ProductList products={result.data} />
}

// app/demo/products/page.tsx
'use client'

import { ProductList } from '@/components/products/product-list'
import { getProductsClient } from '@/lib/db/browser-data'
import { useEffect, useState } from 'react'

export default function DemoProductsPage() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    getProductsClient().then(setProducts)
  }, [])
  return <ProductList products={products} />
}
```

**Pros:**
- Simpler implementation — no refactoring needed
- Keep Server Actions exactly as-is
- Clear separation: server routes vs demo routes

**Cons:**
- Duplicates entire route tree
- Components must be flexible (can be async server or client)
- More boilerplate

### Option C: Client-Side Server Actions (Most Complex, Not Recommended)

Use `useActionState()` or similar to make Server Actions aware of browser context... this is overly complex and defeats the purpose.

---

## 5. Recommended Data Abstraction

### Architecture Decision

**Recommendation: Option A (Shared Domain Functions) with selective refactoring.**

Here's why:

1. **You want shared UI** — accomplished by shared domain logic
2. **You want to avoid duplicating every route** — domain functions make this possible
3. **The refactoring is bounded** — only tier 2 and 3 operations need it
4. **Future flexibility** — domain functions are reusable (could build mobile app, CLI, etc.)

### Concrete Structure

```typescript
// lib/domain/index.ts (export all domain functions)
export * from './products'
export * from './sales'
export * from './batches'
export * from './vendors'
export * from './settings'

// lib/domain/products.ts
import type { Database } from '@/lib/db/database-interface'

export async function createProductLogic(
  input: {
    name: string
    categoryId?: string
    unit?: string
    sellingPrice: number | string
    reorderLevel?: number
    description?: string
    barcode?: string | null
  },
  db: Database,
): Promise<{ success: true; data: Product } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()  // Still need auth
    let categoryName = 'GEN'
    if (input.categoryId) {
      const catResult = await db.query(
        'SELECT name FROM categories WHERE id = $1 AND store_id = $2 LIMIT 1',
        [input.categoryId, user.store_id],
      )
      if (catResult.rows.length > 0) {
        categoryName = catResult.rows[0].name as string
      }
    }
    const sku = generateSKU(categoryName)
    const result = await db.query(
      `INSERT INTO products (...)
       VALUES (...)
       RETURNING *`,
      [...params]
    )
    return { success: true, data: result.rows[0] }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// app/actions/products.ts (Server adapter)
export async function createProduct(formData) {
  'use server'
  return createProductLogic(formData, serverDatabase)
}

// lib/db/browser-adapter.ts (Browser adapter)
export async function createProductBrowser(formData) {
  // Client-side execution — no 'use server' here
  return createProductLogic(formData, browserDatabase)
}
```

### Database Interface

```typescript
// lib/db/database-interface.ts
export interface Database {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  withConnection<T>(fn: (client: DatabaseConnection) => Promise<T>): Promise<T>
}

export interface DatabaseConnection {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

// lib/db/server-database.ts
import { query, withConnection, pool } from './index'
export const serverDatabase: Database = {
  query,
  withConnection,
}

// lib/db/browser-database.ts
import { browserQuery, browserWithConnection } from './browser-init'
export const browserDatabase: Database = {
  query: browserQuery,
  withConnection: browserWithConnection,
}
```

### Handling Complex Transactions

For operations that use `withConnection()` (sales, batch intake), you have two choices:

**Choice 1: Implement `browserWithConnection()` that handles pseudo-transactions**
- PGlite in browser doesn't support `FOR UPDATE` locks
- You can still get atomicity with explicit logic
- Less safe for concurrent operations, but demo doesn't need to handle concurrent users

```typescript
// lib/db/browser-init.ts
export async function browserWithConnection<T>(
  fn: (client: BrowserDatabaseConnection) => Promise<T>
): Promise<T> {
  // For browser, a "connection" is just the PGlite instance
  const db = await getBrowserDemoDb()
  
  // Manual transaction handling (no FOR UPDATE available)
  await db.exec('BEGIN')
  try {
    const result = await fn(db)
    await db.exec('COMMIT')
    return result
  } catch (err) {
    await db.exec('ROLLBACK')
    throw err
  }
}
```

**Choice 2: Skip the most complex operations in demo**
- Don't allow "Record Sale" or "Stock Intake" in the demo
- Only show read operations + basic CRUD
- Simpler to implement, but less representative

**Recommendation**: Choice 1 with a note: "Demo doesn't prevent concurrent oversell like production does."

---

## 6. Route Structure: Shared vs Duplicate

### Recommended Structure

```
app/
  (dashboard)/              ← Authenticated, Aurora DB, full features
    layout.tsx              ← requireUser()
    dashboard/page.tsx
    products/page.tsx       ← async server component
    sales/page.tsx
    intake/page.tsx
    analytics/page.tsx
    settings/page.tsx
    ...

  demo/                     ← Public demo, browser PGlite, limited features
    layout.tsx              ← NO auth required, no server-side data fetch
    page.tsx
    products/
      page.tsx              ← 'use client' component
    sales/
      page.tsx              ← 'use client' component
    intake/
      page.tsx              ← 'use client' component  (or read-only)
    analytics/
      page.tsx              ← 'use client' component
    ...

  (dev)/                    ← Optional explicit dev environment
    layout.tsx              ← Same as dashboard
    ...
```

### Key Differences

**Dashboard pages** (async server components):
```typescript
// app/(dashboard)/products/page.tsx
import { getProducts } from '@/app/actions/products'

export default async function ProductsPage() {
  const result = await getProducts()  // Server Action
  return <ProductList products={result.data} />
}
```

**Demo pages** (client components):
```typescript
// app/demo/products/page.tsx
'use client'

import { getProductsClient } from '@/lib/db/browser-adapter'
import { useEffect, useState } from 'react'

export default function DemoProductsPage() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    getProductsClient().then(r => setProducts(r.data))
  }, [])
  return <ProductList products={products} />
}
```

Both use the same `ProductList` component. The only difference is **how** they fetch data:
- Dashboard: Server Action (runs on server)
- Demo: Browser adapter (runs in browser)

**This is NOT full duplication.** You're duplicating the **page files** (thin wrappers), not the business logic or components.

---

## 7. Demo Seed Extraction (Concrete Implementation)

### Which Tables Are Required

Based on the actual schema (`scripts/desktop-schema.sql`):

**Required tables for demo:**
1. `stores` (1 row: demo store)
2. `users` (1 row: demo user)
3. `categories` (5-10 realistic categories)
4. `vendors` (3-5 suppliers)
5. `products` (20-50 products across categories)
6. `batches` (30-100 batches with realistic stock levels and expiry dates)
7. `sales` (20-50 sample transactions)
8. `sale_items` (line items for those sales)

**Optional (calculated, not stored):**
- `alerts` — calculated from products + batches
- `analytics` — calculated from sales

**Never extract:**
- `invitations` — auth-related, not applicable to demo
- Better Auth tables (session, account, verification) — demo has no auth

### Foreign Key Relationships

```
stores
  ↑
  └─ users (auth_id = NULL for demo)
  └─ categories (store_id)
  └─ vendors (store_id)
  └─ products (store_id, category_id)
  └─ batches (store_id, product_id, vendor_id)
  └─ sales (store_id)
     └─ sale_items (sale_id, product_id, batch_id)
```

All relationships are **hierarchical under store_id**. Extract based on a single store.

### ID Remapping Strategy

To ensure demo is reproducible and seed is self-contained:

```typescript
// scripts/extract-demo-store.mjs

// Fixed demo IDs (same across all extractions)
const DEMO_STORE_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002'

// Extract and remap
async function extractStore(realStoreId) {
  const idMap = {
    stores: { [realStoreId]: DEMO_STORE_ID },
    users: {},
    categories: {},
    vendors: {},
    products: {},
    batches: {},
    sales: {},
    saleItems: {},
  }

  // Fetch and remap
  const realCategories = await fetchFromCloud('SELECT * FROM categories WHERE store_id = $1', [realStoreId])
  for (const cat of realCategories) {
    idMap.categories[cat.id] = generateUUID()
  }
  // ... repeat for each table

  // Generate SQL with new IDs
  const seedSql = generateSeedSql(idMap, realData)
  fs.writeFileSync('public/demo/schema-and-seed.sql', seedSql)
}
```

### Fields to Sanitize

```typescript
// Store
- Remove address (use generic)
- Remove phone (use generic)

// Users
- Remove auth_id (set to NULL)
- Remove email (use demo@example.com)
- Remove name (use "Demo User")
- Set role = 'owner' (full access)

// Vendors
- Remove contact person name (use "Vendor Contact")
- Remove address (use "City, Country")
- Remove phone (use generic)
- Remove email (use generic)
- Keep type (direct/consignment) — this is product metadata

// Products
- Keep name (e.g., "Coca-Cola", "Milk") — these are public
- Keep category — public metadata
- Generate new SKU (keep format but new seed)
- Generate new barcode (fake but realistic)
- Keep selling_price — public pricing
- Keep reorder_level — product metadata

// Batches
- Remove supplier_lot_number (use generic or NULL)
- Keep qty_received, qty_remaining — current stock
- Keep cost_price, selling_price — product data
- Remove expiry_date (regenerate as future date)
- Remove received_at (use recent date, not real timing)

// Sales
- Remove cashier_id, cashier_name (transactions are anonymous in demo)
- Keep receipt_number (but regenerate to avoid conflicts)
- Keep total_amount — transaction size
- Keep payment_method — public transaction type
- Keep created_at (but shift dates to be recent)

// SaleItems
- Remove personal info (none to remove)
- Keep qty_sold, unit_price — transaction structure
```

### Seed SQL Format

```sql
-- Public Demo Seed for Trova IMS
-- Extracted from STORE_ID on DATE
-- Schema is idempotent and uses IF NOT EXISTS / ON CONFLICT DO NOTHING

BEGIN;

-- Store
INSERT INTO stores (id, name, address, phone, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Store', '123 Main Street, City', '+1 (555) 000-0000', NOW())
ON CONFLICT (id) DO NOTHING;

-- Users (demo user only)
INSERT INTO users (id, auth_id, store_id, name, email, role, is_active, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000001', 'Demo User', 'demo@example.com', 'owner', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Categories (with new UUIDs)
INSERT INTO categories (id, store_id, name, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Beverages', NOW()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Groceries', NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Vendors (with new UUIDs, sanitized contact)
INSERT INTO vendors (id, store_id, name, contact, address, type, is_active, created_at) VALUES
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Vendor A', 'Vendor Contact', 'City, Country', 'direct', true, NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Products (with new UUIDs, new SKUs, generated barcodes)
INSERT INTO products (id, store_id, category_id, sku, name, description, barcode, unit, selling_price, reorder_level, is_active, created_at) VALUES
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'BEV-ABC123', 'Coca-Cola 500ml', NULL, '5901234567890', 'piece', 2.50, 10, true, NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Batches (with new UUIDs, future expiry dates)
INSERT INTO batches (id, store_id, product_id, vendor_id, batch_ref, supplier_lot_number, qty_received, qty_remaining, cost_price, selling_price, expiry_date, received_at, created_at) VALUES
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'BATCH-001', NULL, 100, 47, 1.50, 2.50, '2026-12-31', NOW(), NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Sales (with new UUIDs, anonymized, recent dates)
INSERT INTO sales (id, store_id, receipt_number, total_amount, payment_method, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001', 'RCP-001', 25.00, 'cash', NOW() - INTERVAL '2 days'),
  ...
ON CONFLICT (id) DO NOTHING;

-- SaleItems (with new UUIDs, linking to remapped product/batch IDs)
INSERT INTO sale_items (id, sale_id, product_id, batch_id, quantity, unit_price, total_price) VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 10, 2.50, 25.00),
  ...
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

### Demo Data Characteristics (Realistic But Synthetic)

- **Products**: Real-world names (Coca-Cola, Milk, Rice, Beans, etc.)
- **Quantities**: Realistic store sizes (50–200 units per product)
- **Pricing**: Realistic range for currency (e.g., ₦500–₦50,000 for Nigerian Naira)
- **Sales transactions**: Recent (last 14 days), mix of payment methods (70% cash, 20% transfer, 10% POS)
- **Stock levels**: Some products in stock, some low, one or two out of stock
- **Expiry dates**: Mix of far future and near-future (to show alerts)
- **Batch history**: 3–5 batches per product, realistic received dates

### Seed Generation Script

```bash
# scripts/extract-demo-store.mjs

#!/usr/bin/env node

import { query } from '@/lib/db'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DEMO_STORE_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002'

async function extractDemoStore(realStoreId) {
  console.log(`Extracting demo seed from store ${realStoreId}...`)

  // Fetch all data
  const store = await query('SELECT * FROM stores WHERE id = $1', [realStoreId])
  const users = await query('SELECT * FROM users WHERE store_id = $1', [realStoreId])
  const categories = await query('SELECT * FROM categories WHERE store_id = $1', [realStoreId])
  const vendors = await query('SELECT * FROM vendors WHERE store_id = $1', [realStoreId])
  const products = await query(
    'SELECT * FROM products WHERE store_id = $1 AND is_active = true',
    [realStoreId]
  )
  const batches = await query(
    'SELECT * FROM batches WHERE store_id = $1 ORDER BY received_at DESC LIMIT 100',
    [realStoreId]
  )
  const sales = await query(
    'SELECT * FROM sales WHERE store_id = $1 ORDER BY created_at DESC LIMIT 50',
    [realStoreId]
  )
  const saleItems = await query(
    'SELECT si.* FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.store_id = $1',
    [realStoreId]
  )

  // Remap IDs
  const idMap = new Map()
  idMap.set(realStoreId, DEMO_STORE_ID)
  idMap.set(users[0]?.id, DEMO_USER_ID)

  for (const cat of categories.rows) {
    idMap.set(cat.id, generateUUID())
  }
  for (const vendor of vendors.rows) {
    idMap.set(vendor.id, generateUUID())
  }
  for (const product of products.rows) {
    idMap.set(product.id, generateUUID())
  }
  for (const batch of batches.rows) {
    idMap.set(batch.id, generateUUID())
  }
  for (const sale of sales.rows) {
    idMap.set(sale.id, generateUUID())
  }
  for (const item of saleItems.rows) {
    idMap.set(item.id, generateUUID())
  }

  // Generate SQL
  const sql = generateSeedSql(
    store.rows[0],
    categories.rows,
    vendors.rows,
    products.rows,
    batches.rows,
    sales.rows,
    saleItems.rows,
    idMap
  )

  // Write output
  const outputPath = path.join(process.cwd(), 'public', 'demo', 'schema-and-seed.sql')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, sql)

  console.log(`✓ Demo seed written to ${outputPath}`)
  console.log(`  Store: ${DEMO_STORE_ID}`)
  console.log(`  User: ${DEMO_USER_ID}`)
  console.log(`  Categories: ${categories.rows.length}`)
  console.log(`  Vendors: ${vendors.rows.length}`)
  console.log(`  Products: ${products.rows.length}`)
  console.log(`  Batches: ${batches.rows.length}`)
  console.log(`  Sales: ${sales.rows.length}`)
}

function generateUUID() {
  // Implementation
}

function generateSeedSql(store, categories, vendors, products, batches, sales, saleItems, idMap) {
  // Implementation
}

const args = process.argv.slice(2)
const storeIdArg = args.find(arg => arg.startsWith('--store-id='))
if (!storeIdArg) {
  console.error('Usage: node scripts/extract-demo-store.mjs --store-id=<UUID>')
  process.exit(1)
}

const realStoreId = storeIdArg.split('=')[1]
await extractDemoStore(realStoreId)
```

---

## 8. Final Recommendation

### The Verdict on Shared Application vs Duplication

**SHARED APPLICATION IS POSSIBLE WITH REFACTORING.**

**Best approach:**
1. Extract business logic from Server Actions into domain functions
2. Create server and browser adapters for these domain functions
3. Reuse shared UI components in both `/(dashboard)` and `/demo` routes
4. `/demo` pages are thin client components that use browser adapter
5. Duplicate only the **page files** (thin wrappers), not logic or components

**Code impact:**
- Create: `lib/domain/` (extracted business logic)
- Create: `lib/db/browser-adapter.ts` (browser data layer)
- Create: `lib/db/database-interface.ts` (shared interface)
- Modify: `app/actions/*.ts` (now call domain functions)
- Create: `app/demo/` (thin client pages using browser adapter)
- Create: `public/demo/schema-and-seed.sql` (generated once)

**Result:**
- Single shared application (UI, logic, workflows)
- Three different data backends (Aurora, local PGlite server, browser PGlite)
- No meaningful duplication (only page-level routing, not business logic)
- Public demo is truly a temporary browser-local execution of the same app

### Why Not Option B (Duplicate Routes)?

Option B would be simpler in the short term (~1 week to implement), but:
- Creates a permanent fork of the application
- Makes future feature development twice as expensive (change dashboard, change demo)
- Demo and desktop eventually diverge
- Violates your stated requirement: "not become a separate fork"

### Why Not Option C (Read-Only Demo)?

A read-only demo would be even simpler to implement, but:
- Doesn't meet your requirement: "fully interactive"
- Doesn't demonstrate workflows like "record a sale"
- Not representative of desktop product

---

## Summary: Can Public Demo Be Shared Application?

| Question | Answer | Rationale |
|----------|--------|-----------|
| Can UI be shared? | ✓ YES | UI is generic, receives data as props |
| Can logic be shared? | ✓ YES with refactoring | Extract to domain functions |
| Can Server Actions work with browser DB? | ✗ NO | Server Actions run on server, not browser |
| Can operations execute in browser? | ✓ PARTIAL | Simple CRUD yes, transactions no |
| Do routes need duplication? | ~ PARTIALLY | Duplicate page files (thin), not logic |
| Should we duplicate entire application? | ✗ NO | Shared domain functions are better |
| Is shared approach worth the refactoring? | ✓ YES | Prevents permanent fork, enables future reuse |

---

## Next Steps If Approved

1. **Refactor tier 2 actions** into domain functions (products, vendors, categories, settings)
   - ~2-3 days of work
   
2. **Create browser adapter** with simplified transaction handling
   - ~1-2 days
   
3. **Create `/demo` route pages** as thin client components
   - ~1 day
   
4. **Generate demo seed** from a real store
   - ~1 day
   
5. **Test and polish**
   - ~1-2 days

**Total: ~1 week for full implementation**

Versus Option B (duplication):
- **Short-term**: 3-4 days (faster)
- **Long-term**: 2x cost for every feature change (much slower)

