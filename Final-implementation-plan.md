# Trova Three-Mode Architecture — Implementation Specification

## 1. Objective

Refactor Trova into a **desktop-first product** powered by one maintainable codebase with three distinct runtime experiences:

```text
                         TROVA
                           │
                    SHARED CODEBASE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     PUBLIC DEMO      PRIVATE DEV       DESKTOP APP
          │                │                │
    Browser-local       Aurora/PG       Local PGlite
       PGlite             + Auth          + Tauri
          │                │                │
     Temporary data     Real data      Persistent data
```

The final architecture must preserve shared:

* UI components
* Screens
* Business rules
* Validation
* Data models
* SQL/query logic where practical
* Feature behavior

The differences between runtimes should primarily be:

1. Authentication
2. Database adapter
3. Persistence
4. Runtime-specific UI such as the Demo banner/reset controls

The public demo must **not become a separate fork of Trova**.

---

# 2. Runtime Definitions

## 2.1 Public Demo

Public entry:

```text
/
 ↓
Landing page
 ↓
Experience Demo
 ↓
/demo/dashboard
```

Characteristics:

* No authentication
* Publicly accessible
* Uses browser-local PGlite
* Starts with a sanitized predefined store
* Fully interactive
* Changes are isolated to the visitor
* Changes are temporary
* Refresh resets the application to its original demo state
* Dedicated Reset Demo button does the same
* No Aurora/PostgreSQL connection
* No cloud persistence
* No server-side database mutation for demo operations

The goal is to make this feel like a temporary browser-hosted instance of the real desktop product.

---

## 2.2 Private Development Web

This is the existing authenticated web application.

Characteristics:

* Better Auth remains enabled
* Uses real Aurora/PostgreSQL
* Uses real development store data
* Persistent
* Accessible through the existing authenticated route or a deliberately non-public development entry
* May contain prototype features ahead of desktop/demo

Do not remove or weaken this environment.

---

## 2.3 Desktop Production

The Tauri application remains the real product.

Characteristics:

* `DESKTOP_MODE=true`
* Opens directly into the application/dashboard
* No login
* Uses local persistent PGlite
* Works offline
* Stores database under the OS application-data location
* Data persists between launches
* Existing Tauri build/release architecture should remain intact

Do not rewrite the existing desktop database architecture unless necessary.

---

# 3. Architectural Principle

The application should move toward:

```text
UI / Screens
     ↓
Domain Operations
     ↓
Database Interface
     ↓
Runtime Adapter
```

Rather than:

```text
Component
    ↓
Server Action containing business logic
    ↓
Database
```

The target architecture is:

```text
                         SHARED UI
                            │
                      DOMAIN LAYER
                            │
                  DATABASE INTERFACE
                            │
            ┌───────────────┼───────────────┐
            │               │               │
     Browser Adapter    Server Adapter   Desktop Adapter
            │               │               │
     Browser PGlite       Aurora        Local PGlite
```

Server Actions remain useful, but they become **thin server adapters**, not the primary location of application business logic.

---

# 4. Critical Refactoring Rule

Shared domain functions must NOT depend directly on:

* `headers()`
* cookies
* Better Auth
* `requireStoreAccess()`
* Next.js Server Actions
* Tauri
* browser globals
* environment-specific authentication

Instead, runtime-specific code resolves the current user/store first.

For example:

```text
PRIVATE WEB

Server Action
    ↓
requireStoreAccess()
    ↓
{ userId, storeId }
    ↓
createProduct(...)
```

```text
DESKTOP

Desktop runtime
    ↓
Local owner/store
    ↓
{ userId, storeId }
    ↓
createProduct(...)
```

```text
PUBLIC DEMO

Demo adapter
    ↓
DEMO_USER_ID
DEMO_STORE_ID
    ↓
{ userId, storeId }
    ↓
createProduct(...)
```

A domain function should conceptually receive:

```typescript
createProduct(
  input,
  context,
  database
)
```

Where:

```typescript
context = {
  userId,
  storeId,
  role
}
```

This keeps authentication separate from business logic.

---

# 5. Phase 1 — Introduce the Shared Database Contract

Create a database interface that both cloud PostgreSQL and PGlite implementations can satisfy.

Suggested structure:

```text
lib/
  db/
    database-interface.ts
    server-database.ts
    browser-database.ts
```

## `database-interface.ts`

Define a minimal common interface.

Conceptually:

```typescript
interface Database {
  query(...)
  transaction(...)
}
```

Do not design this interface around `pg.PoolClient`.

Design it around what Trova's business logic actually needs.

For example:

```typescript
interface Database {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>

  transaction<T>(
    callback: (tx: DatabaseTransaction) => Promise<T>
  ): Promise<T>
}
```

The transaction interface should expose query functionality without requiring callers to know whether the backend is:

* Aurora
* Desktop PGlite
* Browser PGlite

## Server adapter

Wrap the current PostgreSQL implementation.

It should support:

```text
query()
transaction()
```

using the existing pool/connection implementation.

## Desktop adapter

Reuse the existing desktop PGlite implementation.

Avoid unnecessary changes to the working desktop implementation.

If needed, adapt it to conform to the new shared interface.

## Browser adapter

Create browser-local PGlite support.

Suggested file:

```text
lib/db/browser-init.ts
```

Responsibilities:

* Initialize PGlite in the browser.
* Load the schema.
* Load the demo seed.
* Expose query functionality.
* Expose transaction functionality.
* Destroy/reset the demo database.
* Prevent initialization from occurring during SSR.

---

# 6. Phase 2 — Extract Domain Logic From Server Actions

Create:

```text
lib/
  domain/
    products.ts
    vendors.ts
    categories.ts
    sales.ts
    inventory.ts
    settings.ts
    analytics.ts
    types.ts
```

Do not blindly move entire Server Action files.

For each action:

1. Identify authentication logic.
2. Identify validation.
3. Identify business rules.
4. Identify database queries.
5. Extract reusable business/data behavior into a domain function.
6. Keep authentication/runtime-specific handling in the adapter.

Example transformation:

## Before

```text
Component
 ↓
createProduct() Server Action
 ↓
getCurrentUser()
 ↓
validation
 ↓
SQL INSERT
```

## After

```text
                    createProductDomain()
                           │
                 validation + queries
                           │
          ┌────────────────┴────────────────┐
          │                                 │
Web/Desktop Server Action              Demo Adapter
          │                                 │
requireStoreAccess()                  demo context
          │                                 │
          └────────────→ domain ←────────────┘
```

The existing Server Action may then become:

```typescript
export async function createProduct(input) {
  'use server'

  const context = await requireStoreAccess()

  return createProductDomain(
    input,
    context,
    serverDatabase
  )
}
```

The browser demo may call:

```typescript
return createProductDomain(
  input,
  demoContext,
  browserDatabase
)
```

---

# 7. Phase 3 — Refactor Feature Areas Incrementally

Do not attempt one enormous rewrite.

Refactor feature-by-feature.

Recommended order:

## Tier 1 — Reads

Move/readapt:

* Products
* Categories
* Vendors
* Alerts
* Analytics
* Sales history
* Individual sale details
* Store settings

Verify browser PGlite reads work correctly.

## Tier 2 — Simple CRUD

Then refactor:

* Create product
* Edit product
* Deactivate/delete product
* Create category
* Create vendor
* Edit vendor
* Deactivate vendor
* Edit store configuration/settings

These are the lowest-risk mutations.

## Tier 3 — Transactional Workflows

Then implement:

* Record sale
* Batch intake
* Inventory movement
* Any workflow involving multiple dependent writes

These are essential because the demo should represent the actual desktop application.

Do not permanently make them read-only simply because the current implementation uses server-specific transaction behavior.

---

# 8. Transaction Strategy

Current server workflows may use:

```text
BEGIN
SELECT ... FOR UPDATE
INSERT ...
UPDATE ...
COMMIT
```

`FOR UPDATE` exists primarily to protect a shared concurrent database.

The public demo has a fundamentally different concurrency model:

```text
One visitor
   ↓
One browser
   ↓
One local demo DB
```

Therefore the browser implementation does not need to reproduce every server locking mechanism.

Separate:

```text
BUSINESS TRANSACTION LOGIC
```

from:

```text
SERVER CONCURRENCY PROTECTION
```

For example, recording a sale should share:

1. Validate cart.
2. Validate quantities.
3. Calculate totals.
4. Create sale.
5. Create sale items.
6. Reduce batch quantities.
7. Commit transaction.

Server/Aurora may additionally use row locks.

Browser PGlite can perform the same logical transaction without remote concurrency locking.

Use real database transactions where supported:

```text
BEGIN
 ↓
validate
 ↓
write sale
 ↓
write sale items
 ↓
update stock
 ↓
COMMIT
```

On error:

```text
ROLLBACK
```

The browser demo should therefore support recording sales, not merely display sales.

---

# 9. Phase 4 — Shared Screen Architecture

Do not duplicate major application screens.

Prefer:

```text
components/
  screens/
    dashboard-screen.tsx
    products-screen.tsx
    sales-screen.tsx
    inventory-screen.tsx
    analytics-screen.tsx
    settings-screen.tsx
```

or reuse equivalent existing components.

Thin route wrappers may differ.

Example:

```text
/(dashboard)/products/page.tsx
/demo/products/page.tsx
```

This is acceptable.

But both should render the same core screen/components.

Conceptually:

```text
Private route
    ↓
server data adapter
    ↓
<ProductScreen />
```

```text
Demo route
    ↓
browser data adapter
    ↓
<ProductScreen />
```

Never create permanent parallel components such as:

```text
DemoProductList
DesktopProductList
DemoCheckout
DesktopCheckout
```

unless the UX genuinely differs.

The goal is:

> duplicate runtime wiring, not application behavior.

---

# 10. Phase 5 — Public Demo Runtime

Create:

```text
app/
  demo/
    layout.tsx
    dashboard/
    products/
    vendors/
    inventory/
    sales/
    analytics/
    settings/
```

These should be thin browser-oriented route wrappers.

The demo layout should:

* Require no authentication.
* Initialize the browser database.
* Display a visible but unobtrusive Demo Mode indicator.
* Provide Reset Demo.
* Reuse the existing dashboard shell/sidebar/navigation wherever possible.
* Prevent links from accidentally escaping into private authenticated routes.

Example navigation:

```text
Dashboard
Products
Inventory
Sales
Analytics
Settings

----------------
Reset Demo
Download Desktop App
```

---

# 11. Browser Demo Persistence

The user's requirement is:

> Refresh = original demo restored.

Therefore DO NOT make IndexedDB persistence the default user-visible behavior unless it is explicitly cleared before initialization.

Preferred behavior:

```text
Open /demo
   ↓
Create fresh database/session
   ↓
Apply schema
   ↓
Apply demo seed
   ↓
Use application
```

When the browser reloads:

```text
Reload
   ↓
Discard previous demo database
   ↓
Reinitialize
   ↓
Apply original seed
```

The Reset Demo button should explicitly perform:

```text
Destroy current demo DB
   ↓
Initialize new DB
   ↓
Apply schema
   ↓
Apply seed
   ↓
Return to dashboard
```

If PGlite requires IndexedDB for technical reasons, implement explicit reset-on-session-load behavior.

Do not allow mutations to survive refresh unless this requirement is intentionally changed later.

---

# 12. Phase 6 — Demo Seed Extraction

Create:

```text
scripts/extract-demo-store.mjs
```

Expose a command such as:

```bash
npm run demo:seed -- --store-id=<STORE_ID>
```

The script should connect only to the real development/cloud database.

It must:

1. Validate the store exists.
2. Extract required store records.
3. Extract related entities.
4. Remap IDs.
5. Sanitize private information.
6. Generate demo-safe dates/data.
7. Validate foreign-key integrity.
8. Produce the final demo seed.
9. Write it directly to the location consumed by the browser demo.

Suggested output:

```text
public/demo/schema-and-seed.sql
```

Do not require a manual copy step.

---

# 13. Demo Seed Data

Derive the final table list from the real schema, but expected core data includes:

```text
stores
users
categories
vendors
products
batches
sales
sale_items
```

Do not export Better Auth data.

Do not export:

* sessions
* account credentials
* verification tokens
* invitations
* secrets
* API keys

Calculated entities such as analytics and alerts should preferably be generated from underlying seeded data rather than exported as static snapshots.

---

# 14. Sanitization Requirements

Never publish a raw copy of a real store.

Use a deterministic sanitization layer.

## Store

Replace:

* address
* phone
* sensitive business identifiers

Store name may either:

* remain if explicitly safe, or
* become a demo brand.

## User

Always replace with:

```text
Demo User
demo@example.com
owner
```

No `auth_id`.

## Vendors

Replace:

* contact names
* phone numbers
* emails
* addresses

Vendor/product relationships may remain.

## Products

Generally safe to retain:

* product names
* categories
* prices
* units
* reorder levels

Regenerate:

* barcodes
* internal SKUs when appropriate

## Batches

Regenerate:

* supplier lot numbers
* dates where privacy/history matters
* batch references if necessary

Preserve realistic:

* cost
* selling price
* quantities
* stock levels

## Sales

Regenerate:

* receipt identifiers
* transaction dates
* cashier information

Preserve realistic:

* totals
* payment types
* quantities
* item relationships

The final dataset should look realistic while containing no identifiable private information.

---

# 15. Demo ID Strategy

Use fixed IDs for the main demo entities.

Example:

```text
DEMO_STORE_ID
DEMO_USER_ID
```

For extracted dependent records, generate new UUIDs and maintain an ID map:

```text
real category ID → demo category ID
real vendor ID   → demo vendor ID
real product ID  → demo product ID
real batch ID    → demo batch ID
real sale ID     → demo sale ID
```

All foreign keys must be rewritten using this mapping.

Validate the final seed before writing it.

---

# 16. Phase 7 — Authentication Separation

## Public demo

Never call Better Auth.

Use:

```typescript
demoContext = {
  userId: DEMO_USER_ID,
  storeId: DEMO_STORE_ID,
  role: 'owner'
}
```

## Private web

Continue existing Better Auth behavior unchanged.

## Desktop

Continue using the local owner/store behavior already implemented.

The domain layer should not care where these contexts came from.

---

# 17. Phase 8 — Public Landing Page Pivot

Reposition the public homepage from:

```text
Sign up → run Trova online
```

to:

```text
Discover Trova
   ↓
Experience Demo
   ↓
Download Desktop App
```

Remove or hide public-facing:

```text
Sign Up
Sign In
Start Free
Create Account
```

Do not remove the underlying authentication routes because private development still needs them.

Primary CTA:

```text
Experience Demo
```

Secondary CTA:

```text
Download Desktop App
```

if public releases/downloads are ready.

Landing messaging should emphasize:

* Desktop application
* Offline-first operation
* Local storage
* Fast local performance
* No internet required for normal store operations

Avoid making unsupported commercial claims such as:

```text
No subscription
Free forever
No cloud ever
```

unless those are confirmed product policies.

---

# 18. Phase 9 — Private Development Access

Preserve the real authenticated application.

Do not depend on obscurity alone if it contains real information.

If adding a dedicated development entry:

```text
/dev
```

or a development subdomain, ensure it still requires authentication.

The public navigation should simply not advertise it.

The hidden/private environment may remain technically accessible to someone who knows its URL, but Better Auth must continue protecting the application itself.

---

# 19. Phase 10 — Feature Parity Rule

The production desktop application is the source of truth.

Whenever a feature reaches desktop production:

```text
Desktop Production Feature
          ↓
Public Demo equivalent
```

should normally exist.

Private development may be ahead:

```text
Private Dev
    ≥
Desktop Production
    ≈
Public Demo
```

This prevents the demo from becoming outdated.

When building new features, prefer implementing them first in shared domain/UI code so they automatically benefit all compatible runtimes.

---

# 20. Phase 11 — Validation

Do not consider implementation complete until all three environments pass validation.

## Public Demo

Verify:

* `/` loads public landing page.
* Sign In/Sign Up are not publicly promoted.
* Experience Demo opens `/demo`.
* Demo requires no account.
* Demo loads predefined data.
* Product CRUD works.
* Vendor/category CRUD works.
* Settings changes work.
* Sale creation works.
* Stock changes correctly.
* Analytics update based on demo activity.
* No mutation reaches Aurora.
* Two browser users cannot affect each other.
* Reset Demo restores seed.
* Refresh restores seed.
* No private information appears in seed/network responses.
* Demo works in current Chrome, Firefox, and Edge.

## Private Development

Verify:

* Existing sign-in works.
* Better Auth works.
* Real Aurora database remains connected.
* Existing store remains intact.
* CRUD remains functional.
* Transaction-heavy workflows still behave correctly.
* Demo refactoring did not introduce regressions.

## Desktop

Verify:

* Tauri launches directly into dashboard.
* No authentication required.
* PGlite initializes locally.
* Data persists between launches.
* App operates offline.
* Products work.
* Stock intake works.
* Sales work.
* Analytics work.
* Existing release/build workflow still succeeds.

---

# 21. Safety Guardrails

The implementation agent must NOT:

* Delete the existing PostgreSQL migrations.
* Replace the working Tauri architecture unnecessarily.
* Remove Better Auth.
* Expose the private development environment publicly through navigation.
* Allow public demo mutations to hit Aurora.
* Store public demo modifications in the real database.
* Duplicate complete feature implementations.
* Duplicate business rules between demo and production.
* Put Better Auth dependencies into shared domain functions.
* Treat a public SQL seed as private.
* Export raw customer/store/vendor personal information.
* Implement cloud sync during this project.
* Simplify important demo workflows into read-only views without a concrete technical reason.

---

# 22. Suggested File Structure

The final codebase may evolve toward:

```text
lib/
  domain/
    products.ts
    vendors.ts
    categories.ts
    inventory.ts
    sales.ts
    settings.ts
    analytics.ts
    types.ts

  db/
    database-interface.ts
    server-database.ts
    browser-database.ts
    browser-init.ts
    desktop-init.ts

  runtime/
    context.ts
    demo-context.ts

app/
  actions/
    products.ts
    vendors.ts
    categories.ts
    inventory.ts
    sales.ts
    settings.ts

  (dashboard)/
    ...

  demo/
    layout.tsx
    dashboard/
    products/
    vendors/
    inventory/
    sales/
    analytics/
    settings/

components/
  ...
  demo/
    demo-banner.tsx
    reset-demo-button.tsx

scripts/
  extract-demo-store.mjs
  desktop-schema.sql
  ...

public/
  demo/
    schema-and-seed.sql

src-tauri/
  ...
```

Adapt names to the existing project conventions rather than forcing this exact structure unnecessarily.

---

# 23. Execution Order

The agent should implement in this sequence:

```text
1. Audit existing actions and workflows
          ↓
2. Introduce Database interface
          ↓
3. Implement browser PGlite
          ↓
4. Extract shared domain logic
          ↓
5. Convert simple reads
          ↓
6. Convert simple CRUD
          ↓
7. Refactor transactional workflows
          ↓
8. Build thin /demo routes
          ↓
9. Build store extraction/sanitization
          ↓
10. Seed demo DB
          ↓
11. Add reset behavior
          ↓
12. Update landing page
          ↓
13. Validate Demo
          ↓
14. Regression-test Private Web
          ↓
15. Regression-test Desktop
```

Do not update the landing page first.

The demo architecture should be functional before advertising it publicly.

---

# 24. Implementation Reporting

The agent should work autonomously through the plan, but after each major phase, record:

```text
Completed:
Files changed:
Architectural decisions:
Tests performed:
Problems discovered:
Deviations from spec:
```

Do not stop for approval on routine implementation decisions.

If an unexpected architectural constraint appears, choose the solution that best preserves:

1. Shared business logic
2. Desktop stability
3. Private web compatibility
4. Browser-demo isolation
5. Minimal duplication

Document the decision and continue unless it would require destructive changes or fundamentally contradict this specification.

---

# 25. Definition of Done

The project is complete when:

### Public visitor

```text
Landing Page
    ↓
Experience Demo
    ↓
Fully populated Trova
    ↓
Add/edit products
Record sales
Change inventory
Explore analytics
Change settings
    ↓
Refresh
    ↓
Original demo store restored
```

### Developer

```text
Private authenticated web app
    ↓
Better Auth
    ↓
Real PostgreSQL
    ↓
Real prototype environment
```

### Customer

```text
Install Trova Desktop
    ↓
Launch
    ↓
Dashboard
    ↓
Persistent local store
    ↓
Works offline
```

All three must share the same core application logic and UI wherever practical.

## Final Architectural Goal

The result should not be three independent applications.

It should be:

> **One Trova application with shared UI and business logic, running against three intentionally different runtime adapters: disposable browser PGlite for the public demo, cloud PostgreSQL for private development, and persistent local PGlite for the production Tauri desktop application.**
