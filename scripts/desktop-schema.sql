-- Desktop schema for Trova IMS (PGlite local database).
--
-- This is a consolidated, single-file version of all migrations
-- (000 through 006). It is idempotent — safe to run on every launch,
-- since PGlite only runs it when the db file doesn't exist yet.
--
-- Auth tables (user, session, account, verification) are intentionally
-- omitted. In DESKTOP_MODE the app bypasses Better Auth entirely and
-- returns a hardcoded local user — no session management needed.

BEGIN;

-- ── Types ────────────────────────────────────────────────────────────────────

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

-- ── Core tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  address               TEXT,
  phone                 TEXT,
  -- Required by getStoreSettings() / StoreSettingsForm
  currency              TEXT NOT NULL DEFAULT 'NGN',
  onboarding_dismissed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id    TEXT,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       user_role NOT NULL DEFAULT 'owner',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- Named `contact` (not contact_person) to match app/actions/vendors.ts
  -- and lib/db/schema.ts, which are the authoritative API layer.
  contact         TEXT,
  address         TEXT,
  -- Named `type` to match the actions layer; vendor_type is the enum *type*.
  type            vendor_type NOT NULL DEFAULT 'direct',
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  sku             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  barcode         TEXT,
  unit            unit_type NOT NULL DEFAULT 'piece',
  selling_price   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level   INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  vendor_id             UUID REFERENCES vendors(id) ON DELETE SET NULL,
  batch_ref             TEXT,
  supplier_lot_number   TEXT,
  intake_session_id     UUID,
  qty_received          INTEGER NOT NULL,
  qty_remaining         INTEGER NOT NULL,
  -- Columns required by createBatchSession() in app/actions/batches.ts
  pack_size             INTEGER NOT NULL DEFAULT 1,
  total_purchase_cost   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_per_unit         NUMERIC(12, 2),
  cost_price            NUMERIC(12, 2),
  selling_price_override NUMERIC(12, 2),
  selling_price         NUMERIC(12, 2),
  is_consignment        BOOLEAN NOT NULL DEFAULT FALSE,
  notes                 TEXT,
  received_by_id        UUID,
  expiry_date           DATE,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  receipt_number  TEXT NOT NULL,
  -- Columns required by createSale() in app/actions/sales.ts
  cashier_id      UUID,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(12, 2),
  change_given    NUMERIC(12, 2),
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id        UUID REFERENCES batches(id) ON DELETE SET NULL,
  qty_sold        INTEGER NOT NULL,
  unit_price      NUMERIC(12, 2) NOT NULL,
  line_total      NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'cashier',
  token       TEXT NOT NULL UNIQUE,
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Forward migrations for databases created by older desktop builds.
-- CREATE TABLE IF NOT EXISTS does not alter an existing table, so these
-- statements preserve existing local data while adding current columns.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

ALTER TABLE batches ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_lot_number TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS intake_session_id UUID;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS total_purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12, 2);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS selling_price_override NUMERIC(12, 2);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_by_id UUID;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_id UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_given NUMERIC(12, 2);

-- Align databases created by early desktop builds with the canonical sales
-- contract used by app/actions/sales.ts. The conditional renames preserve
-- existing sale quantities and totals without deleting local sales history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'quantity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'qty_sold'
  ) THEN
    ALTER TABLE sale_items RENAME COLUMN quantity TO qty_sold;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'total_price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'line_total'
  ) THEN
    ALTER TABLE sale_items RENAME COLUMN total_price TO line_total;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_store_id     ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku          ON products(sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batches_product_id    ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_store_id      ON batches(store_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry        ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_intake_session
  ON batches(store_id, intake_session_id)
  WHERE intake_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_store_id        ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uc_users_auth_id_store
  ON users(auth_id, store_id) WHERE auth_id IS NOT NULL;

-- ── Seed: local store + local owner user ─────────────────────────────────────
-- Fixed UUIDs so they're stable across re-inits (which shouldn't happen,
-- but makes debugging predictable). These match the DESKTOP_LOCAL_STORE_ID
-- and DESKTOP_LOCAL_USER_ID constants in lib/db/desktop-init.ts.

INSERT INTO stores (id, name, currency, onboarding_dismissed, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'My Store', 'NGN', FALSE, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, store_id, name, email, role, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Store Owner',
  'owner@local',
  'owner',
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
