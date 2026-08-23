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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  batch_ref           TEXT,
  supplier_lot_number TEXT,
  intake_session_id   UUID,
  qty_received        INTEGER NOT NULL,
  qty_remaining       INTEGER NOT NULL,
  cost_price          NUMERIC(12, 2),
  selling_price       NUMERIC(12, 2),
  expiry_date         DATE,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  receipt_number  TEXT NOT NULL,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id        UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity        INTEGER NOT NULL,
  unit_price      NUMERIC(12, 2) NOT NULL,
  total_price     NUMERIC(12, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

INSERT INTO stores (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'My Store', NOW())
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
