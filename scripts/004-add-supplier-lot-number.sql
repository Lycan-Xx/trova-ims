-- Separate the internal, auto-generated batch reference from the supplier's
-- own lot/batch code. Previously both concepts were crammed into the single
-- free-text `batch_ref` column, which meant a user had to type an internal
-- reference by hand for every intake even when there was no supplier code to
-- record. `batch_ref` now becomes the auto-generated internal reference
-- (e.g. INT-20260810-001), and `supplier_lot_number` is the optional,
-- user-entered code that comes on the delivery itself (packaged goods,
-- pharma, etc.) when one exists.

ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_lot_number TEXT;
