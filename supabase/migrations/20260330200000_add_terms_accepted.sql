-- Add terms acceptance timestamp to guides table.
-- NULL = guide has not yet accepted the terms.
-- Non-null = timestamp when they accepted.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
