# Three-Mode Architecture Investigation

**Date:** August 23, 2026  
**Scope:** Desktop-first repositioning with public demo + private dev + production  
**Status:** Investigation (no implementation yet)

---

## A. Understanding — The Three Modes

Your requirement is to support one codebase across three distinct runtime modes:

### 1. **Public Web (Browser Demo)**
- Accessed via `https://trova-ims.vercel.app/demo` (or similar)
- No authentication required
- Interactive, fully-featured demo with preconfigured data
- User actions (add/edit/delete products, record sales, etc.) are **temporary and isolated**
- Data persists in **browser-local storage only**
- Refresh or explicit "Reset Demo" restores original demo state
- Conceptually: immutable demo seed → ephemeral browser DB → user interactions → reset

### 2. **Private Dev Web (Authenticated)**
- Accessed via hidden/private URL (e.g., `https://dev.trova-ims.vercel.app` or `/dev` route)
- Requires Better Auth login
- Connected to **real PostgreSQL database** (Aurora)
- Real store data from your development environment
- May contain prototype features ahead of public demo
- For your own development and testing
- **Must not be removed or weakened**

### 3. **Desktop Application (Production)**
- Tauri-bundled native application (Windows, macOS, Linux installers)
- Launches directly into dashboard (no login)
- Works fully offline
- Uses **local PGlite database** in app-data directory
- Persistent data between launches
- Complete, production-ready feature set
- Single-user/single-store (hardcoded store ID)

---

## B. Feasibility — Browser-Local Interactive Demo

**Verdict: YES, fully feasible.**

### Why Browser-Local PGlite Works

Your existing architecture already demonstrates this is practical:

1. **PGlite is already a dependency** (`@electric-sql/pglite@0.5.5` in package.json)
   - Currently used only in Node.js/desktop context
   - Version 0.5.5+ includes browser worker mode
   - Same Postgres SQL dialect across environments (no dialect switching needed)

2. **Database abstraction is already in place** (`lib/db/index.ts`)
   - Conditional routing: `IS_DESKTOP ? desktopQuery : pool.query`
   - All action files are database-backend-agnostic
   - Query signatures are identical across modes
   - **Can add a third condition: `IS_BROWSER_DEMO ? browserQuery : ...`**

3. **All business logic is query-based, not ORM-dependent**
   - Action files use raw SQL or simple parameterized statements
   - No complex Drizzle relationships or complex ORM features
   - Desktop mode already does this with raw SQL—browser demo would too

4. **Storage strategy works in browser**
   - Browser IndexedDB can store entire PGlite database (50-100MB quota typical)
   - Sufficient for demo data (products, vendors, batches, sales, analytics)
   - No server-side persistence needed for demo

### Browser PGlite Initialization

```typescript
// lib/db-browser.ts (new)
import { PGlite } from '@electric-sql/pglite/worker'

let _db: PGlite | null = null

export async function getBrowserDemoDb(): Promise<PGlite> {
  if (_db) return _db
  
  // Initialize PGlite in IndexedDB
  _db = new PGlite('idb://trova-demo')
  
  // Run schema + demo seed
  const demoSchema = await fetch('/demo/schema-and-seed.sql').then(r => r.text())
  await _db.exec(demoSchema)
  
  return _db
}

export async function browserDemoQuery(text: string, params?: unknown[]) {
  const db = await getBrowserDemoDb()
  return db.query(text, params)
}

// Reset demo to original seed
export async function resetBrowserDemo() {
  if (_db) {
    _db.close()
    _db = null
    // IndexedDB will be cleared on next initialization
    // Or explicitly: await indexedDB.deleteDatabase('pglite')
  }
}
```

### Limitations (Transparent to Users)

- **Storage quota**: ~50-100MB (browser-dependent)
  - Sufficient for realistic demo: ~10 products, ~50 sales, analytics
  - Display disclaimer: "Demo data expires on page refresh"
  
- **Cross-tab isolation**: IndexedDB is not real-time sync'd across browser tabs
  - Document: "Open demo in one tab for best experience"
  
- **Worker thread overhead**: Slightly slower than Node.js PGlite
  - Acceptable for demo use (not real production workload)
  - No perceptible lag for typical actions

---

## C. Data Architecture — Backend Selection

| Mode | Database | Connection | Auth | Multi-tenant | Data Source |
|------|----------|-----------|------|--------------|-------------|
| **Public Demo** | PGlite (WASM) | Browser worker | Hardcoded user + store | No (single store) | Seed snapshot |
| **Private Dev** | Aurora PostgreSQL | Cloud (RDS) | Better Auth + session | Yes (store_id scoping) | Real PostgreSQL |
| **Desktop Prod** | PGlite (Node.js) | Local file | Hardcoded user + store | No (single store) | Local file |

### Runtime Detection & Routing

```typescript
// lib/db/index.ts (modified)

export const IS_DESKTOP = process.env.DESKTOP_MODE === 'true'
export const IS_BROWSER_DEMO = process.env.BROWSER_DEMO_MODE === 'true'  // new

export async function query(text: string, params?: unknown[]) {
  if (IS_DESKTOP) {
    return desktopQuery(text, params)  // Node.js PGlite
  } else if (IS_BROWSER_DEMO) {
    return browserDemoQuery(text, params)  // Browser worker PGlite
  } else {
    return pool.query(text, params)  // Aurora PostgreSQL
  }
}
```

### Environment Variables

```bash
# .env.local (dev)
DATABASE_URL=postgresql://...  # Aurora
BETTER_AUTH_SECRET=...
# IS_BROWSER_DEMO not set (defaults to false)

# Next.js build with BROWSER_DEMO_MODE=true
# (done during build for /demo route, not at runtime)
# Result: dedicated build artifact or route handler that initializes browser DB
```

### Route-Based Initialization

Alternative: **use Next.js App Router structure**

```
app/
  (dashboard)/        ← Requires auth, connects to pool (Aurora)
    layout.tsx        ← getCurrentUser() → Better Auth
    products/
    sales/
    ...
  
  (demo)/             ← No auth required, uses browser DB
    layout.tsx        ← No auth, sets IS_BROWSER_DEMO flag
    products/
    sales/
    ...
  
  (dev)/              ← Private dev, same as (dashboard) but hidden
    layout.tsx
```

This way: **identical page logic**, different backends per route group.

---

## D. Demo Seed — Extract & Sanitize Real Store

### Extraction Strategy

```bash
# scripts/extract-demo-store.mjs
# Usage: node scripts/extract-demo-store.mjs --store-id <UUID>

import { pool } from '@/lib/db'
import * as fs from 'node:fs'

async function extractStore(storeId) {
  // 1. Fetch all tables for this store
  const store = await pool.query(
    'SELECT * FROM stores WHERE id = $1', [storeId]
  )
  const users = await pool.query(
    'SELECT id, store_id, name, email, role FROM users WHERE store_id = $1', [storeId]
  )
  const categories = await pool.query(
    'SELECT * FROM categories WHERE store_id = $1', [storeId]
  )
  const vendors = await pool.query(
    'SELECT * FROM vendors WHERE store_id = $1', [storeId]
  )
  const products = await pool.query(
    'SELECT * FROM products WHERE store_id = $1 AND is_active = true', [storeId]
  )
  const batches = await pool.query(
    `SELECT b.* FROM batches b
     JOIN products p ON b.product_id = p.id
     WHERE b.store_id = $1 AND p.is_active = true
     ORDER BY b.received_at DESC LIMIT 50`,
    [storeId]
  )
  const sales = await pool.query(
    `SELECT * FROM sales WHERE store_id = $1
     ORDER BY created_at DESC LIMIT 30`,
    [storeId]
  )
  const saleItems = await pool.query(
    `SELECT si.* FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE s.store_id = $1`,
    [storeId]
  )

  // 2. Sanitize sensitive data
  const sanitized = {
    store: sanitizeStore(store.rows[0]),
    users: users.rows.map(u => sanitizeUser(u)),
    categories: categories.rows,
    vendors: vendors.rows.map(v => sanitizeVendor(v)),
    products: products.rows,
    batches: batches.rows,
    sales: sales.rows.map(s => sanitizeSale(s)),
    saleItems: saleItems.rows,
  }

  // 3. Generate seed SQL + INSERT statements
  const seedSql = generateSeedSql(sanitized, storeId)
  
  // 4. Write to scripts/demo-seed.sql
  fs.writeFileSync('scripts/demo-seed.sql', seedSql)
  console.log('✓ Demo seed extracted to scripts/demo-seed.sql')
}

function sanitizeStore(store) {
  // Replace real store name with generic demo name
  return {
    ...store,
    id: '00000000-0000-0000-0000-000000000001',  // Fixed demo store ID
    name: 'Demo Store',
    address: '123 Main Street',
    phone: '+1 (555) 000-0000',
  }
}

function sanitizeUser(user) {
  // Remove auth info, use fixed demo user
  return {
    id: '00000000-0000-0000-0000-000000000002',  // Fixed demo user ID
    auth_id: null,  // No auth in demo
    store_id: '00000000-0000-0000-0000-000000000001',
    name: 'Demo User',
    email: 'demo@example.com',
    role: 'owner',  // Always owner for demo
  }
}

function sanitizeVendor(vendor) {
  // Keep vendor structure, anonymize contact details
  return {
    ...vendor,
    contact: 'Vendor Contact',  // Generic
    address: 'City, Country',
    phone: '+1 (555) 111-1111',  // Remove real phone
  }
}

function sanitizeSale(sale) {
  // Remove cashier name, keep transaction structure
  return {
    ...sale,
    cashier_id: null,
    cashier_name: null,
  }
}

function generateSeedSql(data, originalStoreId) {
  // Generate SQL INSERT statements
  // Use IF NOT EXISTS or ON CONFLICT DO NOTHING for idempotency
  return `
-- Demo Store Seed (extracted from ${originalStoreId} on ${new Date().toISOString()})

BEGIN;

INSERT INTO stores (id, name, address, phone, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Store', '123 Main Street', '+1 (555) 000-0000', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, store_id, name, email, role, is_active, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Demo User', 'demo@example.com', 'owner', true, NOW())
ON CONFLICT (id) DO NOTHING;

${data.categories.map(c => generateInsertCategory(c)).join('\n')}
${data.vendors.map(v => generateInsertVendor(v)).join('\n')}
${data.products.map(p => generateInsertProduct(p)).join('\n')}
${data.batches.map(b => generateInsertBatch(b)).join('\n')}
${data.sales.map(s => generateInsertSale(s)).join('\n')}
${data.saleItems.map(si => generateInsertSaleItem(si)).join('\n')}

COMMIT;
`
}
```

### Demo Seed SQL Deployment

Two options:

**Option A: Bundled with frontend**
- `scripts/demo-seed.sql` generated during extraction
- Bundled into `public/demo/schema-and-seed.sql`
- Frontend fetches on demo load: `GET /demo/schema-and-seed.sql`
- Loaded into PGlite worker on first demo page load
- **Pro**: Simple, no server-side logic
- **Con**: Public data visible in fetch (use a simple product/vendor structure, not sensitive)

**Option B: API endpoint**
- `app/api/demo/seed/route.ts`
- Returns SQL as JSON response
- More control over what's exposed
- Can be behind rate limiting

**Recommendation:** Option A (simpler, works offline)

### Reset Demo Functionality

```typescript
// components/demo/reset-button.tsx
'use client'

import { resetBrowserDemo } from '@/lib/db-browser'
import { useRouter } from 'next/navigation'

export function ResetDemoButton() {
  const router = useRouter()
  
  const handleReset = async () => {
    if (!confirm('This will reset demo data. Continue?')) return
    await resetBrowserDemo()
    router.refresh()
  }
  
  return (
    <button onClick={handleReset} className="...">
      Reset Demo Data
    </button>
  )
}
```

---

## E. Runtime Separation — Minimal Complexity

### Route Structure (Cleanest Pattern)

```
app/
  layout.tsx                    ← Root, theme provider
  page.tsx                      ← Landing page (always public)
  
  (dashboard)/                  ← Protected, Aurora DB
    layout.tsx                  ← AUTH: requireUser()
    dashboard/
    products/
    sales/
    ... (all existing routes)
    
  demo/                         ← Public, browser PGlite
    layout.tsx                  ← NO AUTH, sets IS_BROWSER_DEMO=true
    dashboard/                  ← Same components, different DB
    products/
    sales/
    reset/                       ← Reset button action
    
  dev/                          ← Hidden, Aurora DB
    layout.tsx                  ← AUTH: requireUser() + check role
    dashboard/
    products/
    ... (same as dashboard, but discovery=hidden)
```

### Implementation Points

**1. Middleware** (`middleware.ts`)
```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Desktop mode: always allow (desktop shell handles this)
  if (process.env.DESKTOP_MODE === 'true') {
    if (pathname === '/' || pathname.includes('/sign')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Public paths (landing, demo, privacy, auth)
  const publicPaths = [
    '/',
    '/sign-in',
    '/sign-up',
    '/join',
    '/landing',
    '/privacy',
    '/demo',  // ← NEW: demo doesn't require auth
    '/api/auth',
    '/api/migrate',
    '/api/purge',
  ]
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Dashboard + dev: require auth
  const sessionCookie = request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token')
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}
```

**2. Database Layer** (`lib/db/index.ts`)
```typescript
export const IS_DESKTOP = process.env.DESKTOP_MODE === 'true'
export const IS_BROWSER_DEMO = typeof window !== 'undefined' && 
  window.location.pathname.startsWith('/demo')  // Client-side detection

// Or use explicit env var set by Next.js per route
export const IS_BROWSER_DEMO = process.env.BROWSER_DEMO_MODE === 'true'

export async function query(text, params) {
  if (IS_DESKTOP) return desktopQuery(text, params)
  if (IS_BROWSER_DEMO) return browserDemoQuery(text, params)
  return pool.query(text, params)
}
```

**3. Dashboard Layout** (`app/(dashboard)/layout.tsx`)
```typescript
export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  // ... rest unchanged
}
```

**4. Demo Layout** (`app/demo/layout.tsx`)
```typescript
export default async function DemoLayout({ children }) {
  // NO AUTH CHECK — demo is always accessible
  return (
    <>
      <DemoNav />  {/* Different nav, with Reset button */}
      {children}
    </>
  )
}
```

### Auth Bypass for Demo

```typescript
// lib/auth.ts (modified getCurrentUser)

export const getCurrentUser = cache(async () => {
  // Demo mode: return hardcoded demo user
  if (IS_BROWSER_DEMO) {
    return {
      id: DEMO_USER_ID,
      store_id: DEMO_STORE_ID,
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'owner' as const,
      is_active: true,
    }
  }

  // Desktop mode: return hardcoded local user
  if (IS_DESKTOP) {
    return query(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [DESKTOP_LOCAL_USER_ID]
    ).then(r => r.rows[0] ?? null)
  }

  // Web/Vercel: use Better Auth session
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) return null
    // ... lookup user by auth_id
  } catch {
    return null
  }
})
```

---

## F. Landing Page Repositioning

### Current State
- Hero: "Know your store, always"
- Value prop: Track items, batches, unit prices from intake to receipt
- CTAs: "Start for free" (→ `/sign-up`), "Sign in to your store"
- Copy focus: Cloud SaaS subscription model

### Recommended Repositioning

**New narrative:** Desktop-native, offline-first, local data

#### Updated Hero (`app/landing/hero.tsx`)

**Before:**
```
Know your store, always.

Trova tracks every item, every batch, every [currency symbol] 
from the moment goods arrive to the moment a receipt prints.

[Start for free] [Sign in to your store]
No credit card required · Free to start
```

**After:**
```
Powerful inventory. Works offline.

Trova runs on your desktop — no internet, no cloud. 
Full control. Complete offline. Fast and local.

[Experience Demo] [Download for Desktop]
No account needed to try · Free to use
```

**Key changes:**
- "Works offline" → Primary value
- "Runs on your desktop" → Desktop-first positioning
- "No cloud" → Privacy + independence
- CTAs: "Experience Demo" (→ `/demo`), "Download for Desktop" (→ installation link)
- Trust note: "No account needed"

#### Updated CTA Section (`app/landing/cta.tsx`)

**Before:**
```
Run a tighter store. Starting today.

Create your free Trova account. First batch logged in under a minute.

[Create your store — it's free]
No credit card · No setup fee · Cancel anytime
```

**After:**
```
Try it first. Then take it home.

Experience the full app right now in your browser. 
No signup needed — just click and explore.

[Start the Demo]
Takes 30 seconds · Works offline · No data required

Or download the desktop app for your store:
[macOS] [Windows] [Linux]
```

#### New "Why Desktop-First" Section

Insert new section after features, before CTA:

```
Why Local & Offline?

🏪 No Internet Dependency
  Your store runs 24/7 even when the internet doesn't.

🔒 Your Data, Your Machine
  Everything stays on your device. No cloud syncing.
  Your choice what to back up or export.

⚡ Instant Performance
  No network latency. Queries are local. Zero wait.

💰 No Subscription
  No recurring fees. Own the app, own your data.
```

#### Updated Navigation (`app/landing/nav.tsx`)

**Before:**
```
Trova logo | [Sign in] [Get started]
```

**After:**
```
Trova logo | [Try Demo] [Download] [Sign in]
```

- "Try Demo" (prominent) → `/demo`
- "Download" → Release page or direct link
- "Sign in" (de-emphasized) → `/sign-in` (for existing users only)

#### Landing → Page Structure

Current `app/page.tsx` and `app/landing/page.tsx` are identical. Consider:
- Keep both pointing to same landing component (no change needed)
- OR create distinct landing components if you want app/page to differ later

### Homepage Copy Recommendations

| Element | Current | Recommended |
|---------|---------|-------------|
| Headline | "Know your store, always." | "Powerful inventory. Works offline." |
| Subheading | Track items/batches/prices | Full control, complete offline, fast & local |
| Hero CTA | "Start for free" | "Experience Demo" |
| CTA section | Account signup focus | Try demo first, then download |
| Trust note | "No credit card required" | "No account needed to try" |
| Feature highlight | Cloud/availability | Offline, local, no subscription |

---

## G. File-by-File Plan

### New Files to Create

```
scripts/
  extract-demo-store.mjs            ← Extract real store to seed SQL
  demo-seed.sql                      ← Generated demo data (gitignored after first extraction)

lib/db/
  browser-init.ts                   ← Browser PGlite initialization
  
lib/auth/
  demo-access.ts                    ← Demo user/store constants + helpers

app/demo/
  layout.tsx                         ← No auth, sets browser DB context
  page.tsx                           ← Demo dashboard/home
  dashboard/
    page.tsx                         ← Same as (dashboard)/dashboard/page.tsx
  products/
    page.tsx
  sales/
    page.tsx
  ... (mirror of (dashboard) structure)
  
  _components/
    demo-nav.tsx                     ← Demo-specific nav with Reset button
    demo-banner.tsx                  ← "This is a demo" disclaimer
    reset-button.tsx                 ← Reset demo data action

app/dev/                             ← Optional: explicitly hidden dev environment
  layout.tsx
  page.tsx
  ... (same as dashboard, discoverable only by URL)

public/demo/
  schema-and-seed.sql               ← Bundled seed file
```

### Modified Files

```
lib/db/index.ts
  ✓ Add IS_BROWSER_DEMO constant
  ✓ Add condition to query() router
  ✓ Import browserDemoQuery when needed

lib/db/desktop-init.ts
  ✓ Export DEMO_STORE_ID, DEMO_USER_ID constants

lib/auth.ts
  ✓ Handle IS_BROWSER_DEMO in getCurrentUser()
  ✓ Add demo user bypass

middleware.ts
  ✓ Add /demo to public paths
  ✓ No auth check for /demo routes

next.config.mjs
  ✓ Add @electric-sql/pglite to serverExternalPackages (may already be there)
  ✓ Ensure WASM files bundled

app/landing/nav.tsx
  ✓ Change "Get started" to "Try Demo"
  ✓ Add link to /demo
  ✓ Adjust sign-in prominence

app/landing/hero.tsx
  ✓ Update headline, copy, value props

app/landing/cta.tsx
  ✓ Update call-to-action messaging

app/page.tsx
  ✓ (No change needed if sharing landing components)

package.json
  ✓ (No new dependencies — already have @electric-sql/pglite)
```

### Preserved / Untouched

```
app/(dashboard)/              ← Private auth'd dashboard, unchanged
app/sign-in/, app/sign-up/    ← Auth flows, unchanged
app/actions/                  ← All action files, unchanged (work via query() abstraction)
src-tauri/                    ← Tauri desktop, unchanged
scripts/desktop-schema.sql    ← Desktop schema, unchanged
lib/db/desktop-init.ts        ← Desktop init, mostly unchanged
```

---

## H. Final Recommendation

### Recommended Architecture: **Route-Based Multi-Backend with Shared Components**

**Why this approach:**

1. **Minimal code duplication**
   - Reuse all action files, UI components across modes
   - Only database layer and auth bypass differ per mode

2. **Clear mental model**
   - `/` → Public landing page
   - `/demo` → Public browser-local demo (no auth)
   - `/(dashboard)` → Private authenticated web (Aurora + Better Auth)
   - `(Tauri app)` → Desktop application (desktop-mode=true)
   - `/dev` → Optional explicit dev environment (same as dashboard)

3. **Leverages existing abstraction**
   - Database layer already has conditional routing (`IS_DESKTOP`)
   - Auth already has bypass logic
   - Just extends both to include browser demo

4. **Technically straightforward**
   - No complex ORM gymnastics (all queries are simple)
   - PGlite worker mode is battle-tested
   - IndexedDB storage is web-standard

5. **Scales cleanly**
   - If browser demo needs different UI later, create `app/demo/` components
   - If private dev needs special features, add them without touching public demo
   - Desktop app remains completely independent

6. **Operational simplicity**
   - Single deployment (Vercel)
   - Demo seed is just a SQL file in public/
   - No separate demo server or database
   - Browser handles all demo logic

### Implementation Phases

**Phase 1: Browser PGlite Infrastructure** (1–2 days)
- Create `lib/db-browser.ts`
- Add `IS_BROWSER_DEMO` flag to database layer
- Test query routing works correctly

**Phase 2: Demo Routes & Layout** (1 day)
- Create `app/demo/layout.tsx` + `page.tsx`
- Mirror dashboard structure into `/demo` routes
- Add demo auth bypass

**Phase 3: Demo Data & Seed** (1 day)
- Create `scripts/extract-demo-store.mjs`
- Generate demo seed SQL
- Test seed loads correctly in browser

**Phase 4: Landing Page Messaging** (1 day)
- Update hero, CTA, nav components
- Add "why desktop-first" section
- Update CTAs to point to `/demo` and installation link

**Phase 5: Polish & Hardening** (1 day)
- Add demo mode banner ("This is a demo")
- Reset button functionality
- IndexedDB quota warning
- Performance testing

---

## I. Demo Data Extraction & Sanitization Deep Dive

### Which Tables & Relationships to Include

**Minimal (recommended for fast load & small IndexedDB footprint):**
- stores (1 row: demo store)
- users (1 row: demo user)
- categories (5-10 realistic examples)
- vendors (3-5 suppliers)
- products (15-30 active products across categories)
- batches (30-50 recent/active batches, with realistic expiry dates)
- sales (20-50 past sales to show analytics)
- sale_items (line items for those sales)

**Why exclude:**
- Don't extract alerts (calculated from products + batches)
- Don't extract analytics snapshots (calculated on-demand)
- Don't extract audit logs or old data (keep seed fresh)

### Sanitization Rules

```typescript
function sanitizeForDemo(data) {
  return {
    // Stores
    store: {
      id: DEMO_STORE_ID,  // '00000000-0000-0000-0000-000000000001'
      name: 'Demo Store',
      address: '123 Main Street, City',
      phone: '+1 (555) 000-0000',  // Generic
      currency: 'USD',  // Or detect from real store
    },

    // Users
    users: [{
      id: DEMO_USER_ID,  // '00000000-0000-0000-0000-000000000002'
      auth_id: null,  // No auth in demo
      store_id: DEMO_STORE_ID,
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'owner',  // Full access
      is_active: true,
    }],

    // Categories (keep real structure, generic names OK)
    categories: realCategories.map(c => ({
      ...c,
      id: generateUUID(),  // New ID
      store_id: DEMO_STORE_ID,
      // name: keep real (e.g., "Beverages", "Groceries")
    })),

    // Vendors (anonymize contact, keep structure)
    vendors: realVendors.map(v => ({
      ...v,
      id: generateUUID(),
      store_id: DEMO_STORE_ID,
      name: `Vendor ${n}` || v.name.split(' ')[0],  // Generic or first word
      contact: 'Vendor Contact',
      address: 'City, Country',
      phone: null,
      email: null,
      // type: keep real (direct/consignment)
    })),

    // Products (keep real structure, slightly generic names)
    products: realProducts.map(p => ({
      ...p,
      id: generateUUID(),
      store_id: DEMO_STORE_ID,
      category_id: mapOldCategoryToNew(p.category_id),
      sku: generateSKU(p.category_name),  // Realistic new SKU
      name: p.name,  // Keep real product names (e.g., "Coca-Cola", "Milk")
      barcode: generateBarcode(),  // New fake barcode
      selling_price: p.selling_price,  // Keep real pricing
      reorder_level: p.reorder_level,
      is_active: true,
    })),

    // Batches (realistic, recent, with realistic expirations)
    batches: realBatches
      .filter(b => !b.is_expired)
      .slice(0, 50)  // Most recent 50
      .map(b => ({
        ...b,
        id: generateUUID(),
        store_id: DEMO_STORE_ID,
        product_id: mapOldProductToNew(b.product_id),
        vendor_id: mapOldVendorToNew(b.vendor_id),
        batch_ref: generateBatchRef(),  // New ref
        supplier_lot_number: generateLotNumber(),
        qty_received: b.qty_received,
        qty_remaining: b.qty_remaining,  // Current stock level
        cost_price: b.cost_price,
        expiry_date: futureDate(),  // Ensure not expired
        received_at: recentDate(),
      })),

    // Sales (anonymize cashier, keep transactions)
    sales: realSales.slice(0, 50).map(s => ({
      ...s,
      id: generateUUID(),
      store_id: DEMO_STORE_ID,
      receipt_number: generateReceiptNumber(),
      cashier_id: null,  // Remove personal info
      cashier_name: null,
      total_amount: s.total_amount,
      payment_method: s.payment_method,  // Keep realistic (cash/transfer/pos)
      created_at: recentDate(),
    })),

    // Sale Items (link to new product/batch IDs)
    saleItems: realSaleItems.map(si => ({
      ...si,
      id: generateUUID(),
      sale_id: mapOldSaleToNew(si.sale_id),
      product_id: mapOldProductToNew(si.product_id),
      batch_id: mapOldBatchToNew(si.batch_id),
      qty_sold: si.qty_sold,
      unit_price: si.unit_price,
    })),
  }
}
```

### Seed SQL Generation

```sql
-- Demo Store Seed (Extracted from [original store] on 2025-08-23)
-- This seed runs on demo page load and initializes a fresh IndexedDB-backed PGlite database.
-- Safe to run repeatedly (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).

BEGIN;

-- Store
INSERT INTO stores (id, name, address, phone, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Store', '123 Main Street, City', '+1 (555) 000-0000', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo User (no auth)
INSERT INTO users (id, auth_id, store_id, name, email, role, is_active, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000001', 
   'Demo User', 'demo@example.com', 'owner', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Categories
INSERT INTO categories (id, store_id, name, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Beverages', NOW()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Groceries', NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Vendors
INSERT INTO vendors (id, store_id, name, contact, address, type, is_active, created_at) VALUES
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001',
   'Vendor A', 'Vendor Contact', 'City, Country', 'direct', true, NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO products (id, store_id, category_id, sku, name, barcode, unit, selling_price, reorder_level, is_active, created_at) VALUES
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'BEV-ABC123', 'Coca-Cola 500ml', '1234567890123',
   'piece', 2.50, 10, true, NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Batches (realistic current stock)
INSERT INTO batches (id, store_id, product_id, vendor_id, batch_ref, qty_received, qty_remaining, 
                     cost_price, selling_price, expiry_date, received_at) VALUES
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'BATCH-001', 100, 47, 1.50, 2.50, '2026-12-31', NOW()),
  ...
ON CONFLICT (id) DO NOTHING;

-- Sales (recent transactions for analytics)
INSERT INTO sales (id, store_id, receipt_number, total_amount, payment_method, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001',
   'RCP-001', 25.00, 'cash', NOW() - INTERVAL '1 day'),
  ...
ON CONFLICT (id) DO NOTHING;

-- Sale Items
INSERT INTO sale_items (id, sale_id, product_id, batch_id, qty_sold, unit_price) VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666',
   '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555',
   10, 2.50),
  ...
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

### Demo Data Characteristics (Realistic but Sanitized)

- **Products**: Real-world names (Coca-Cola, Milk, etc.) but generic categories
- **Vendors**: Anonymous (Vendor A, Vendor B) but realistic supplier relationships
- **Batches**: Realistic quantities and pricing, current/future expiry dates only
- **Sales**: Recent transactions (last 30 days) with realistic payment mix (70% cash, 20% transfer, 10% POS)
- **Quantities**: Realistic stock levels and sales volumes
- **Prices**: Real-world realistic for given currencies (Nigerian Naira example: ₦500–₦50,000 range)

### Extraction & Update Workflow

```bash
# 1. First time setup: extract a real store
node scripts/extract-demo-store.mjs --store-id <UUID>
# → Generates scripts/demo-seed.sql

# 2. Copy to public for bundling
cp scripts/demo-seed.sql public/demo/schema-and-seed.sql

# 3. Commit both
git add public/demo/schema-and-seed.sql
git commit -m "chore: update demo seed"

# 4. Vercel auto-deploys, demo page fetches latest seed
# → On every demo page load, browser fetches and runs seed SQL
```

---

## Summary: Three-Mode Architecture

| Aspect | Public Demo | Private Dev | Desktop App |
|--------|------------|------------|-------------|
| **URL** | `https://trova-ims.vercel.app/demo` | `https://dev.trova-ims.vercel.app` or `/dev` | Native desktop app |
| **Database** | Browser PGlite (IndexedDB) | Aurora PostgreSQL | Local PGlite (file) |
| **Auth** | None (hardcoded user) | Better Auth | None (hardcoded user) |
| **Persistence** | Ephemeral (reset on refresh) | Persistent (real cloud) | Persistent (file) |
| **Data** | Sanitized seed snapshot | Real store data | User's local data |
| **Use Case** | Try before download | Development & prototyping | Production |
| **Implementation** | New `app/demo/` routes | Existing `app/(dashboard)` | No changes (already working) |
| **Query Backend** | `browserDemoQuery()` | `pool.query()` | `desktopQuery()` |
| **Maintenance** | Extract seed once, update yearly | Ongoing (real data) | User owns data |

---

## Next Steps

1. **Review & Approve** this architecture plan
2. **Greenlight implementation** with priority order (I recommend: Phase 1 → 2 → 3 → 4)
3. **Extraction**: Run first `extract-demo-store.mjs` to select a real store as demo seed
4. **Testing**: Verify demo works locally with browser PGlite
5. **Deploy**: Roll out `/demo` routes and updated landing page messaging
6. **Monitor**: Track demo engagement, adjust seed data if needed

