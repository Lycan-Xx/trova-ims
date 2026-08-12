import { NextRequest, NextResponse } from 'next/server'
import { withConnection } from '@/lib/db'

// Each entry is one statement. Splitting here avoids Aurora's
// "cannot insert multiple commands into a prepared statement" error.
const STATEMENTS = [
  // Enums — wrapped in DO blocks so they are idempotent
  `DO $$ BEGIN CREATE TYPE user_role AS ENUM ('owner','storekeeper','cashier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE vendor_type AS ENUM ('direct','consignment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE unit_type AS ENUM ('piece','pack','kg','litre','carton','dozen','bag'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // App tables
  `CREATE TABLE IF NOT EXISTS stores (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    address              TEXT,
    phone                TEXT,
    currency             TEXT NOT NULL DEFAULT 'NGN',
    onboarding_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id   TEXT,
    auth_id    TEXT,
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    role       user_role NOT NULL DEFAULT 'cashier',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // Safe ALTER for tables that may already exist from a previous migration
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id TEXT`,
  `ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL`,
  `UPDATE users SET auth_id = clerk_id WHERE auth_id IS NULL AND clerk_id IS NOT NULL`,
  
  `ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN'`,
  `ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_auth_id  ON users(auth_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)`,

  `CREATE TABLE IF NOT EXISTS categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id)`,

  `CREATE TABLE IF NOT EXISTS vendors (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    contact    TEXT,
    address    TEXT,
    type       vendor_type NOT NULL DEFAULT 'direct',
    notes      TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vendors_store_id ON vendors(store_id)`,

  `CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku             TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    unit            unit_type NOT NULL DEFAULT 'piece',
    selling_price   DECIMAL(12,2) NOT NULL,
    reorder_level   INTEGER NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_store_id    ON products(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_products_sku         ON products(sku)`,

  `CREATE TABLE IF NOT EXISTS batches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id              UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id               UUID REFERENCES vendors(id) ON DELETE SET NULL,
    batch_ref               TEXT,
    supplier_lot_number     TEXT,
    intake_session_id       UUID,
    qty_received            INTEGER NOT NULL,
    qty_remaining           INTEGER NOT NULL,
    pack_size               INTEGER NOT NULL DEFAULT 1,
    total_purchase_cost     DECIMAL(12,2) NOT NULL,
    cost_per_unit           DECIMAL(12,2) NOT NULL,
    selling_price_override  DECIMAL(12,2),
    expiry_date             TIMESTAMPTZ,
    is_consignment          BOOLEAN NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by_id          UUID REFERENCES users(id) ON DELETE SET NULL
  )`,
  // Safe ALTERs for a batches table that already existed before these columns
  // were introduced — CREATE TABLE IF NOT EXISTS above is a no-op on prod,
  // so these are what actually apply the change to the live database.
  `ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_lot_number TEXT`,
  `ALTER TABLE batches ADD COLUMN IF NOT EXISTS intake_session_id UUID`,
  `CREATE INDEX IF NOT EXISTS idx_batches_store_id   ON batches(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_vendor_id  ON batches(vendor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_intake_session
    ON batches(store_id, intake_session_id)
    WHERE intake_session_id IS NOT NULL`,

  `CREATE TABLE IF NOT EXISTS sales (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    receipt_number TEXT UNIQUE NOT NULL,
    cashier_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    total_amount   DECIMAL(12,2) NOT NULL,
    amount_paid    DECIMAL(12,2),
    change_given   DECIMAL(12,2),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sales_store_id       ON sales(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_cashier_id     ON sales(cashier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_created_at     ON sales(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id    UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    qty_sold    INTEGER NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    line_total  DECIMAL(12,2) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id    ON sale_items(sale_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id   ON sale_items(batch_id)`,

  // Invitations table for team member management
  `CREATE TABLE IF NOT EXISTS invitations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    role       user_role NOT NULL DEFAULT 'cashier',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    token      TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_store_id ON invitations(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status)`,

  // Better Auth tables (camelCase column names required by the library)
  `CREATE TABLE IF NOT EXISTS "user" (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    image           TEXT,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id           TEXT PRIMARY KEY,
    "expiresAt"  TIMESTAMPTZ NOT NULL,
    token        TEXT NOT NULL UNIQUE,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "userId"     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS account (
    id                       TEXT PRIMARY KEY,
    "accountId"              TEXT NOT NULL,
    "providerId"             TEXT NOT NULL,
    "userId"                 TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken"            TEXT,
    "refreshToken"           TEXT,
    "idToken"                TEXT,
    "accessTokenExpiresAt"   TIMESTAMPTZ,
    "refreshTokenExpiresAt"  TIMESTAMPTZ,
    scope                    TEXT,
    password                 TEXT,
    "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS verification (
    id           TEXT PRIMARY KEY,
    identifier   TEXT NOT NULL,
    value        TEXT NOT NULL,
    "expiresAt"  TIMESTAMPTZ NOT NULL,
    "createdAt"  TIMESTAMPTZ,
    "updatedAt"  TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_session_user_id    ON session("userId")`,
  `CREATE INDEX IF NOT EXISTS idx_account_user_id    ON account("userId")`,
  `CREATE INDEX IF NOT EXISTS idx_verification_ident ON verification(identifier)`,
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { stmt: string; ok: boolean; error?: string }[] = []

  try {
    await withConnection(async (client) => {
      for (const stmt of STATEMENTS) {
        try {
          await client.query(stmt)
          results.push({ stmt: stmt.trim().slice(0, 60), ok: true })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          results.push({ stmt: stmt.trim().slice(0, 60), ok: false, error: msg })
          // Swallow non-fatal errors (e.g. duplicate index) but log them
          console.warn('[migrate] non-fatal:', msg)
        }
      }
    })

    const failed = results.filter((r) => !r.ok)
    return NextResponse.json({
      ok: true,
      message: `Migration complete. ${results.length - failed.length}/${results.length} statements succeeded.`,
      failed: failed.length > 0 ? failed : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[migrate] Fatal error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
