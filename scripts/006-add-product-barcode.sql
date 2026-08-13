-- Barcode Lookup feature. Lets products be identified by their manufacturer
-- barcode (UPC/EAN) at intake and on the POS screen, instead of typing the
-- name every time. This is purely a faster way to select which product a
-- scan refers to — it identifies the product, not the batch, so all
-- existing batch/FEFO/expiry logic is untouched.
--
-- Nullable: most products may never get a barcode assigned, and existing
-- rows have none. Unique: two products can't share the same barcode, since
-- that would make a scan ambiguous about which product it means.

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode)
  WHERE barcode IS NOT NULL;
