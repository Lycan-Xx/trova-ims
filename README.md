# Trova — Inventory Management System

Trova is a full-stack inventory management application built for small-to-medium retail stores. It handles the complete retail lifecycle: supplier intake, product cataloguing, point-of-sale, vendor relationships, expiry/stock alerts, and owner-level analytics. The entire system is multi-tenant by design — each store is isolated, and every user belongs to exactly one store with a defined role.

---

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Framework   | Next.js 16 (App Router)                             |
| Database    | Amazon Aurora PostgreSQL (IAM auth via RDS Signer)  |
| Auth        | Better Auth (email + password, session-based)       |
| UI          | Tailwind CSS v4 + shadcn/ui                         |
| Fonts       | Inter (UI), JetBrains Mono (SKUs / numbers)         |
| Hosting     | Vercel                                              |

---

## Project Structure

```
app/
  page.tsx                    # Root page (redirects to /landing)
  layout.tsx                  # Root layout (fonts, metadata, providers)
  globals.css                 # Design tokens, Tailwind theme, utilities
  landing/                    # Public landing page (Trova marketing)
    page.tsx                  # Landing page entry point
    nav.tsx                   # Navigation header
    hero.tsx                  # Hero section
    pain.tsx                  # Problem statement section
    built-for.tsx             # Target audience section
    features.tsx              # Feature showcase with interactive tabs
    product-peek.tsx          # Product preview section
    how-it-works.tsx          # Step-by-step guide
    cta.tsx                   # Call-to-action section
    footer.tsx                # Footer with links
  sign-in/                    # Auth pages
  sign-up/
  join/                       # Invitation acceptance flow
  (dashboard)/                # Protected app — requires active session
    layout.tsx                # Sidebar + topbar shell
    dashboard/                # Home page with stats + weekly chart
    products/                 # Product catalogue + detail slide-over
    intake/                   # Stock intake (batch logging)
    sales/                    # POS + sale history + PDF receipts
    vendors/                  # Supplier management
    alerts/                   # Low stock + expiry alerts
    analytics/                # Revenue, trends, top products
    settings/                 # Store settings + team management
  api/
    auth/                     # Better Auth handler
    migrate/                  # Schema migration endpoint (idempotent)
    purge/                    # Database purge endpoint (dev/reset only)

components/
  layout/
    sidebar.tsx               # Collapsible icon-only / full-label sidebar (desktop)
    mobile-nav.tsx            # Bottom tab bar with More drawer (mobile)
    topbar.tsx                # App header — wordmark, alerts, sign-out, avatar
  auth/auth-form.tsx
  dashboard/weekly-chart.tsx
  products/ vendors/ sales/ intake/ analytics/ settings/
  ui/                         # Shared primitives (stat-card, badge, button…)

lib/
  auth.ts                     # Better Auth server config — reuses Aurora pool
  auth-client.ts              # Better Auth browser client
  auth/first-run.ts           # Auto store creation on first ever sign-up
  db/
    index.ts                  # Aurora pool with automatic IAM token rotation
    schema.ts                 # TypeScript types for all database tables
    helpers.ts                # Typed query helpers
  utils.ts
```

---

## Database Schema

The application uses 8 domain tables plus 4 Better Auth system tables:

```
stores        — one row per store (name, currency, low_stock_threshold)
users         — app users linked to a store, role: owner | staff
categories    — product groupings scoped per store
vendors       — supplier records, type: direct | consignment
products      — SKUs with cost, price, stock_qty, reorder_level
batches       — stock intake records linked to product + vendor + expiry
sales         — transaction headers (total, payment method, served_by)
sale_items    — line items per sale (product, qty, unit_price)

"user"        — Better Auth identity (email, hashed password)
session       — active user sessions
account       — credential storage (OAuth-compatible)
verification  — email verification tokens
```

---

## Environment Variables

| Variable             | Required | Purpose                                                    |
|----------------------|----------|------------------------------------------------------------|
| `BETTER_AUTH_SECRET` | Yes      | Session signing key (`openssl rand -base64 32`)            |
| `MIGRATION_SECRET`   | Yes      | Protects `/api/migrate` and `/api/purge`                   |
| `AWS_REGION`         | Yes      | Aurora region — set by Aurora integration                  |
| `AWS_ROLE_ARN`       | Yes      | IAM role ARN — set by Aurora integration                   |
| `PGHOST`             | Yes      | Aurora cluster hostname — set by Aurora integration        |
| `PGUSER`             | Yes      | Database username — set by Aurora integration              |
| `PGDATABASE`         | Yes      | Database name — set by Aurora integration                  |
| `PGSSLMODE`          | Yes      | Must be `require` — set by Aurora integration              |

---

## Running the Migration

After deploying, apply the schema by visiting:

```
GET https://your-domain.vercel.app/api/migrate?secret=YOUR_MIGRATION_SECRET
```

The endpoint is fully idempotent — it uses `CREATE TABLE IF NOT EXISTS` and
`CREATE INDEX IF NOT EXISTS` throughout, so it is safe to re-run at any time.

---

## Local Development

```bash
pnpm install
pnpm dev
```

The dev server starts on `http://localhost:3000`. You will need either the Aurora
integration credentials or a local PostgreSQL instance configured in `.env.local`.
Run the migration before first use:

```
GET http://localhost:3000/api/migrate?secret=YOUR_MIGRATION_SECRET
```

---

## User Flow

### 1. Owner Sign-Up (First Run)

1. Visit `https://trova-ims.vercel.app` and click **Get started**, or navigate directly to `/sign-up`
2. Enter full name, email, and a password (minimum 8 characters)
3. On the very first sign-up, Trova automatically:
   - Creates a new store named after the owner
   - Creates the owner user record linked to that store
   - Assigns the `owner` role
4. Redirects to `/dashboard`

---

### 2. Owner Onboarding (Recommended Order)

Once inside the dashboard, complete setup in this sequence:

**a. Store Settings** → `/settings`
- Set the official store name, trading currency, and low-stock threshold
- Optionally add store address and contact details

**b. Add Vendors** → `/vendors`
- Create at least one vendor before logging any intake
- Set vendor type: `direct` (store purchases outright) or `consignment` (vendor retains ownership until sold)

**c. Create Categories** → `/products` (via the category selector)
- Categories organise the product catalogue
- Examples: Beverages, Snacks, Stationery, Pharmaceuticals

**d. Add Products** → `/products`
- Create products with: name, SKU, category, unit of measure, selling price, cost price, and reorder level
- Stock quantity starts at `0` — it is populated entirely via Intake

---

### 3. Logging Stock Intake → `/intake`

1. Click **New Intake**
2. Select the product and the delivering vendor
3. Enter quantity received, unit cost, and expiry date (optional but recommended)
4. Submit — the product's `stock_qty` increments by the entered quantity
5. A batch record is created for full traceability (vendor, cost, date, expiry)

Intake history is listed on `/intake` with the ability to drill into any batch record.

---

### 4. Processing a Sale → `/sales/new`

1. Click **New Sale**
2. Search for products and add them with quantities
3. The system shows real-time stock availability and auto-calculates the total
4. Select the payment method: cash, card, or bank transfer
5. Submit — inventory is decremented immediately across all affected products
6. A receipt is generated; it can be downloaded as a PDF from the sale detail page

---

### 5. Monitoring Alerts → `/alerts`

Trova surfaces two alert categories proactively:

- **Low Stock** — products at or below their configured reorder level
- **Expiring Soon** — batches with an expiry date within the alert window (default 7 days)

The alert count appears on the dashboard home page for all users. Owners and staff can navigate to `/alerts` to view every affected item and act on it directly (reorder, pull stock, etc.).

---

### 6. Team Management (Owner only) → `/settings`

1. Navigate to Settings and open the Team tab
2. Enter the email address of a new team member and click **Send Invite**
3. The invitee receives a unique join link at `/join?token=...`
4. They create their account through the join page and are automatically linked to the owner's store with the `staff` role
5. Staff can process sales, log intake, and manage products — but cannot view owner analytics or change store settings

To remove a team member, the owner can revoke their access from the team management table.

---

### 7. Analytics (Owner only) → `/analytics`

- Filter by any custom date range
- View total revenue, number of transactions, and average order value for the period
- See a ranked list of top-selling products by units and revenue
- Review the daily revenue chart to identify trends and peak days
- Compare current period against previous for growth tracking

---

## Role Permissions

| Feature                    | Owner | Staff          |
|----------------------------|:-----:|:--------------:|
| Process sales              | Yes   | Yes            |
| Log stock intake           | Yes   | Yes            |
| Manage products            | Yes   | Yes            |
| Manage vendors             | Yes   | Yes            |
| View & action alerts       | Yes   | Yes            |
| View dashboard stats       | Yes   | Alerts only    |
| View full analytics        | Yes   | No             |
| Manage store settings      | Yes   | No             |
| Invite / remove team       | Yes   | No             |

---

## Design System

All colours, spacing, and radii are CSS custom properties defined in `app/globals.css`.

| Token                  | Value       | Usage                              |
|------------------------|-------------|------------------------------------|
| `--bg-base`            | `#111111`   | Page background                    |
| `--bg-nav`             | `#0D0D0D`   | Sidebar, topbar, bottom nav        |
| `--bg-card`            | `#1E1E1E`   | Card and panel backgrounds         |
| `--accent-primary`     | `#F5610A`   | Brand orange — CTAs, active states |
| `--text-primary`       | `#FFFFFF`   | Primary body text                  |
| `--text-secondary`     | `#A3A3A3`   | Supporting text, labels            |
| `--text-muted`         | `#666666`   | Placeholders, disabled states      |
| `--positive`           | `#4ADE80`   | Success, positive trend            |
| `--danger`             | `#F87171`   | Error, critical state              |
| `--warning`            | `#FBBF24`   | Alert, caution state               |

Typography uses two families only: **Inter** for all UI text and **JetBrains Mono** for
SKUs, receipt numbers, batch references, and any tabular numeric data.

---

## Deployment

Trova is deployed on Vercel. Every push to the head branch triggers a preview deployment.
Merging to `main` triggers a production deployment automatically.

The Amazon Aurora PostgreSQL integration is connected at the Vercel project level and
injects all `PG*` and `AWS_*` environment variables into the runtime automatically.
No manual credential management is required after the initial integration setup.
