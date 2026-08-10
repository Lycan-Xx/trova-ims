-- Adds a lightweight, optional grouping tag to batches so a single Stock
-- Intake submission that spans multiple products and/or vendors (e.g. one
-- monthly restock trip) can be viewed and totaled as one event later,
-- without changing the one-batch-equals-one-product-one-vendor invariant
-- that FEFO deduction and vendor settlement math depend on.
--
-- Nullable and never required: a one-off, single-line intake simply doesn't
-- set it, and behaves exactly as it always has. See
-- docs/intake-sessions.md for the full design rationale, scenarios, and
-- what would justify moving beyond this lightweight approach.

ALTER TABLE batches ADD COLUMN IF NOT EXISTS intake_session_id UUID;

CREATE INDEX IF NOT EXISTS idx_batches_intake_session
  ON batches(store_id, intake_session_id)
  WHERE intake_session_id IS NOT NULL;
