# Investigation Summary: Shared App vs Duplicate Routes

## The Critical Finding

**Server Actions execute on the Next.js server, not in the browser.**

Your application uses `'use server'` Server Actions for all mutations. When a client component calls a Server Action, it sends data to the Next.js server, which processes it. The browser never directly accesses the database.

Therefore: **Existing Server Actions cannot access browser-local PGlite without refactoring.**

---

## The Core Problem

```
Current Architecture:
  Component (browser)
    ↓
  Server Action (Next.js server)
    ↓
  query() → routed by IS_DESKTOP env var
    ↓
  Aurora OR local PGlite

Browser Demo Problem:
  Component (browser)
    ↓
  Server Action (Next.js server)  ← can only access server resources
    ↓
  query() can't know about browser IndexedDB
    ↓
  Fails to find browser database
```

---

## Can the Public Demo Be a Shared Application?

### Short Answer

**YES, but only if you refactor to extract business logic from Server Actions.**

### Why

1. **UI is completely reusable** — it's generic and receives data as props
2. **Business logic can be extracted** — into pure domain functions
3. **Two adapters can invoke the same logic** — one via Server Action (server), one directly (browser)
4. **Routes can be mostly shared** — only thin page-level wrappers differ

### Example

Instead of:
```typescript
// Server Action (only runs on server)
export async function createProduct(formData) {
  'use server'
  const result = await query(INSERT ...)
  return result
}
```

Extract to:
```typescript
// Domain function (can run anywhere)
export async function createProductLogic(formData, db: Database) {
  const result = await db.query(INSERT ...)
  return result
}

// Server adapter
export async function createProduct(formData) {
  'use server'
  return createProductLogic(formData, serverDatabase)
}

// Browser adapter
export async function createProductBrowser(formData) {
  // No 'use server' — runs in browser
  return createProductLogic(formData, browserDatabase)
}
```

Then components call the appropriate one:
```typescript
const result = IS_BROWSER_DEMO
  ? await createProductBrowser(payload)  // Runs in browser
  : await createProduct(payload)         // Runs on server
```

---

## Operational Reality Check

### Which operations can work in browser?

| Category | Examples | Browser | Notes |
|----------|----------|---------|-------|
| **Simple Reads** | getProducts, getSales, getAlerts | ✓ YES | Just SELECT queries |
| **Simple Writes** | createProduct, updateVendor, createCategory | ✓ YES | Single INSERT/UPDATE |
| **Complex Writes** | createSale, createBatchSession | ✗ NO | Use `FOR UPDATE` locks + transactions |
| **Auth Reads** | getCurrentUser, getTeamMembers | ✓ PARTIAL | Demo user is hardcoded |

**Result**: ~70% of operations can work in browser with minimal refactoring. ~30% (complex transactions) need special handling or simplified versions.

---

## Three Architectural Options

### Option A: Shared Domain Functions + Dual Adapters (RECOMMENDED)

```
Shared UI & Logic
    ↓
Domain Functions
    ├─ Server Adapter (Server Action)
    │   └─ Aurora/PostgreSQL
    └─ Browser Adapter (Direct)
        └─ Browser PGlite

Routes:
  /(dashboard)   ← Server pages, Server Actions, Aurora
  /demo          ← Client pages, Browser adapter, Browser PGlite
```

**Pros:**
- Single shared application
- No route duplication
- Future-proof (logic can be reused elsewhere)
- Clear separation of concerns

**Cons:**
- Requires refactoring Server Actions
- More complex than starting over
- ~1 week of work

**When to choose:** You want one application, not two.

### Option B: Duplicate Route Structure (SIMPLER SHORT-TERM)

```
/(dashboard)/
  products/page.tsx    ← async server component
  sales/page.tsx
  ...

/demo/
  products/page.tsx    ← 'use client' component
  sales/page.tsx
  ...
```

**Pros:**
- Simpler to implement
- Keep Server Actions unchanged
- No architectural changes needed
- ~3-4 days of work

**Cons:**
- Creates a permanent fork
- Every feature must be coded twice
- Demo and desktop diverge over time
- Violates your stated requirement

**When to choose:** You're willing to maintain two applications.

### Option C: Read-Only Demo (SIMPLEST)

Allow only viewing data, no mutations. Even simpler but completely misses your goal of "fully interactive."

---

## Recommended Path Forward

**Use Option A (Shared Domain Functions) because:**

1. **Your requirement is clear**: "The public demo should not become a separate fork"
2. **Refactoring is bounded**: You can do tier 2 operations (simple CRUD) first, defer tier 3 (complex transactions) later
3. **Business logic is your asset**: Extracting it makes it reusable for mobile app, API, CLI, etc.
4. **One week is acceptable**: Compared to maintaining two applications forever
5. **Product requirement is met**: Single application running in three contexts (demo, dev, desktop)

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (2 days)

- [ ] Create `lib/domain/` folder
- [ ] Create `lib/db/database-interface.ts` (shared interface)
- [ ] Create `lib/db/browser-database.ts` (browser PGlite wrapper)
- [ ] Create `lib/db/server-database.ts` (existing pool wrapper)
- [ ] Create `lib/db/browser-adapter.ts` (browser mutation helper)

### Phase 2: Refactor Tier 2 Operations (3 days)

Extract business logic for:
- Products (create, update, deactivate)
- Vendors (create, update, deactivate)
- Categories (create)
- Settings (update)

Create `lib/domain/products.ts`, `lib/domain/vendors.ts`, etc.

Modify `app/actions/products.ts`, etc. to call domain functions.

### Phase 3: Browser Adapters (1 day)

- [ ] Create client-side wrappers in `lib/db/browser-adapters/`
- [ ] Test that browser mutations work against browser PGlite
- [ ] Implement simplified transaction handling (no FOR UPDATE locks)

### Phase 4: Demo Routes (1 day)

- [ ] Create `app/demo/layout.tsx` (no auth)
- [ ] Create `app/demo/products/page.tsx` (client component)
- [ ] Create `app/demo/sales/page.tsx` (read-only or simplified)
- [ ] Create `app/demo/dashboard/page.tsx`
- [ ] Add reset button component

### Phase 5: Demo Seed (1 day)

- [ ] Create `scripts/extract-demo-store.mjs`
- [ ] Extract from a real store
- [ ] Generate and test `public/demo/schema-and-seed.sql`
- [ ] Verify PGlite loads seed correctly

### Phase 6: Polish (1-2 days)

- [ ] Update landing page copy
- [ ] Add demo mode banner
- [ ] Performance testing
- [ ] Browser storage quota warning
- [ ] Cross-browser testing

---

## Files to Create/Modify

### Create
```
lib/
  domain/
    index.ts                  ← export all domain functions
    products.ts               ← createProductLogic, updateProductLogic, etc.
    vendors.ts                ← createVendorLogic, etc.
    categories.ts             ← createCategoryLogic, etc.
    settings.ts               ← updateStoreSettingsLogic, etc.
    types.ts                  ← shared input/output types
  db/
    database-interface.ts     ← Database, DatabaseConnection interfaces
    server-database.ts        ← wrap existing pool
    browser-database.ts       ← browser PGlite wrapper
    browser-adapter.ts        ← client-side mutation helpers
    browser-adapters/
      products.ts             ← createProductBrowser, etc.
      vendors.ts
      categories.ts
      settings.ts

app/
  demo/
    layout.tsx                ← no auth, load demo seed
    page.tsx                  ← home
    dashboard/page.tsx        ← stats
    products/page.tsx         ← client component
    sales/page.tsx            ← client component (read-only)
    analytics/page.tsx        ← client component
    settings/page.tsx         ← read-only
    _components/
      demo-nav.tsx            ← with reset button
      demo-banner.tsx         ← disclaimer
      reset-button.tsx

scripts/
  extract-demo-store.mjs

public/demo/
  schema-and-seed.sql         ← generated
```

### Modify
```
lib/
  auth.ts                     ← add IS_BROWSER_DEMO logic
  db/index.ts                 ← export serverDatabase
  
app/
  actions/
    products.ts               ← call createProductLogic, etc.
    vendors.ts
    categories.ts
    settings.ts
  
  landing/
    nav.tsx                   ← add "Try Demo" link
    hero.tsx                  ← update messaging
    cta.tsx                   ← update messaging
```

### Keep Unchanged
```
app/
  (dashboard)/                ← works as-is
  sign-in/, sign-up/          ← unchanged
  api/auth/                   ← unchanged

lib/
  db/desktop-init.ts          ← unchanged (still used for Tauri)
  
src-tauri/                    ← unchanged

scripts/
  desktop-schema.sql          ← unchanged
```

---

## Key Decision Points

### Decision 1: Refactor All Actions Or Partial?

**Recommendation: Partial refactoring in phases**

Phase 2 does tier 2 operations (simple CRUD). Defer tier 3 (complex transactions) until later if demo doesn't need them.

For MVP demo: read-only sales + stock intake (tier 1 + 2). Add full mutations later.

### Decision 2: Transaction Handling in Browser

**Recommendation: Simplified pseudo-transactions**

Browser PGlite can't do `FOR UPDATE` locks. For demo, accept that concurrent oversell is theoretically possible (but unlikely in single-user demo).

```typescript
// browser pseudo-transaction
await db.exec('BEGIN')
try {
  // ... mutations
  await db.exec('COMMIT')
} catch (e) {
  await db.exec('ROLLBACK')
  throw e
}
```

**Not as safe as production** (no row locks), **but acceptable for demo** (single visitor at a time).

### Decision 3: Read-Only vs Full Demo

**Recommendation: Full mutations for core workflows**

Include:
- ✓ Create/edit/delete products
- ✓ Create/edit/delete vendors
- ✓ Create/edit store settings
- ✓ Record sales (simplified, no locks)
- ✓ Analytics (calculated)

Exclude (or read-only):
- △ Stock intake (complex transaction, show read-only for now)
- △ Team members (auth-related, not demo-focused)

---

## Success Criteria

When implementation is complete, you should have:

1. ✓ Public `/demo` route accessible without login
2. ✓ Demo loads browser-local PGlite with seed data
3. ✓ Users can create/edit/delete products in demo
4. ✓ Users can record sales in demo (simplified)
5. ✓ Users can view analytics in demo
6. ✓ Reset button restores original seed data
7. ✓ Same UI components used in both `/(dashboard)` and `/demo`
8. ✓ Business logic shared (no duplication)
9. ✓ Landing page repositioned toward desktop-first messaging
10. ✓ Desktop app unchanged
11. ✓ Private dev unchanged

---

## Next Steps

If you approve this approach:

1. **Review** the detailed investigation in `ARCHITECTURE_INVESTIGATION_2.md`
2. **Decide** on refactoring scope (partial vs full, tier 2 vs tier 3)
3. **Decide** on transaction handling strategy for browser
4. **Approve** the implementation plan
5. **I'll create** a detailed updated architecture document with concrete code examples

Then we move to implementation.

