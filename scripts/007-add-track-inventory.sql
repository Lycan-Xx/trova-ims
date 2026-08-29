-- Adds optional inventory tracking while preserving existing behavior.
-- Existing products remain stock-tracked; untracked products can create sale
-- items without consuming a batch.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE sale_items
  ALTER COLUMN batch_id DROP NOT NULL;
