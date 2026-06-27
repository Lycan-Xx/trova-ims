-- ============================================================
-- stocksmart: full schema for Aurora PostgreSQL
-- Migration 002 — idempotent, safe to re-run
-- Covers: all app tables, auth_id column, Better Auth tables,
--         store-scoped user isolation
-- ============================================================

-- ENUMS -------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'storekeeper', 'cashier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_type AS ENUM ('direct', 'consignment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('piece', 'pack', 'kg', 'litre', 'carton', 'dozen', 'bag');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STORES ------------------------------------------------------

CREATE TABLE IF NOT EXISTS stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USERS -------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id   TEXT,
  auth_id    TEXT,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       user_role NOT NULL DEFAULT 'cashier',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add auth_id column if table already exists from 001 migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id TEXT;

-- Make clerk_id nullable (was NOT NULL in original schema)
ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL;

-- Copy clerk_id to auth_id for any legacy rows
UPDATE users SET auth_id = clerk_id WHERE auth_id IS NULL AND clerk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id  ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

-- CATEGORIES --------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);

-- VENDORS -----------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  contact    TEXT,
  address    TEXT,
  type       vendor_type NOT NULL DEFAULT 'direct',
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_store_id ON vendors(store_id);

-- PRODUCTS ----------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
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
);

CREATE INDEX IF NOT EXISTS idx_products_store_id    ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku         ON products(sku);

-- BATCHES -----------------------------------------------------

CREATE TABLE IF NOT EXISTS batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id              UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id               UUID REFERENCES vendors(id) ON DELETE SET NULL,
  batch_ref               TEXT,
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
);

CREATE INDEX IF NOT EXISTS idx_batches_store_id   ON batches(store_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_vendor_id  ON batches(vendor_id);

-- SALES -------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales (
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
);

CREATE INDEX IF NOT EXISTS idx_sales_store_id       ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id     ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at     ON sales(created_at DESC);

-- SALE ITEMS --------------------------------------------------

CREATE TABLE IF NOT EXISTS sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id    UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  qty_sold    INTEGER NOT NULL,
  unit_price  DECIMAL(12,2) NOT NULL,
  line_total  DECIMAL(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id   ON sale_items(batch_id);

-- BETTER AUTH TABLES ------------------------------------------
-- Required by the better-auth library for session management.
-- Column names are camelCase to match Better Auth's internal expectations.

CREATE TABLE IF NOT EXISTS "user" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image           TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
  id            TEXT PRIMARY KEY,
  "expiresAt"   TIMESTAMPTZ NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "userId"      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
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
);

CREATE TABLE IF NOT EXISTS verification (
  id           TEXT PRIMARY KEY,
  identifier   TEXT NOT NULL,
  value        TEXT NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ,
  "updatedAt"  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_user_id    ON session("userId");
CREATE INDEX IF NOT EXISTS idx_account_user_id    ON account("userId");
CREATE INDEX IF NOT EXISTS idx_verification_ident ON verification(identifier);
