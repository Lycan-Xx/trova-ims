# Trova Public Interactive Preview — Implementation Plan

## Objective

Build a public, interactive, read-only preview at `/demo` that lets visitors explore Trova without an account while keeping the production architecture simple.

The preview uses synthetic TypeScript fixture data. It does not initialize a database, call Server Actions, authenticate a user, persist visitor changes, or connect to Aurora.

## Runtime boundaries

Trova has two production data runtimes and one presentation-only preview:

1. Private web uses Better Auth and Aurora/PostgreSQL.
2. Desktop uses the bundled local Next.js server and persistent PGlite.
3. Public preview uses static synthetic data and local React state only.

The preview must never import application actions, authentication, database, or Tauri modules.

## Preview scope

The preview includes read-only representations of:

- Dashboard
- Products
- Vendors
- Intake history
- Sales history
- Receipt details
- Alerts
- Analytics
- Store settings

Visitors can navigate, search, filter, inspect details, change analytics ranges, and open sample receipts. Mutation controls explain that the capability is available in Trova Desktop and provide a download call to action.

The preview does not create, update, or delete records. It does not simulate successful writes.

## Architecture

```text
Landing page
  -> /demo
      -> DemoApp
          -> DemoShell and navigation
          -> typed synthetic fixtures
          -> pure selectors
          -> read-only preview screens

Production application
  -> existing Server Actions
  -> Aurora or desktop PGlite
```

Production application behavior remains authoritative. The preview shares visual primitives and pure formatting helpers where safe, but does not force production workflow components into a browser-specific abstraction.

## Data design

All sample records are fictional and generated in `lib/demo/create-demo-data.ts`.

The fixture set includes tracked and untracked products, direct and consignment vendors, multiple batches, low-stock products, expired and near-expiry batches, multiple payment methods, multi-item receipts, and enough sales history for dashboard and analytics views.

Dates are generated relative to a single preview session clock. Dashboard totals, sales history, receipts, alerts, and analytics are derived from the same fixture records through pure selectors.

## UX requirements

The preview must:

- Clearly identify itself as a read-only interactive preview.
- Keep all navigation inside `/demo`.
- Work on desktop and mobile layouts.
- Preserve search, filter, pagination, detail, and receipt interactions.
- Explain unavailable write operations rather than failing silently.
- Provide clear routes back to the website, private sign-in, and desktop download information.
- Restore its original fixture state on refresh.

## Implementation phases

### Phase 1 — Safety foundation

- Add neutral preview types.
- Add deterministic fixture generation.
- Add pure selectors for stock, sales, intake, alerts, and analytics.
- Add an automated isolation check for forbidden imports.

### Phase 2 — Public shell

- Add `/demo` as a public route.
- Build responsive sidebar and mobile navigation.
- Add the read-only banner and unavailable-action dialog.
- Use `?view=` navigation for shareable preview sections.

### Phase 3 — Primary value screens

- Dashboard
- Products
- Sales history
- Receipt details
- Analytics

### Phase 4 — Inventory coverage

- Vendors
- Intake history and details
- Low-stock and expiry alerts
- Store settings preview

### Phase 5 — Visitor journey

- Point landing-page demo calls to action to `/demo`.
- Keep private sign-in secondary.
- Present desktop download/release information consistently.

### Phase 6 — Validation

- Run the preview isolation check.
- Run TypeScript and lint checks.
- Build the production Next.js application.
- Verify `/demo` is public and protected routes remain protected.
- Confirm the demo bundle contains no database, auth, Server Action, or Tauri dependency.
- Verify responsive navigation, search, filters, receipts, dialogs, and keyboard behavior.
- Confirm production web and desktop code paths remain unchanged.

## Definition of done

The implementation is complete when a visitor can understand Trova's major workflows without an account, every preview metric is internally consistent, no visitor data is stored, no backend data path can be invoked, and existing private web and desktop behavior remains unaffected.
