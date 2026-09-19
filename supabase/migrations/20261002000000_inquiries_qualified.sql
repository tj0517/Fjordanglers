-- FA-1.04: inquiries.qualified — three-state classification flag
--
-- qualified:     yes | no | unknown (default)
-- qualified_set_by: 'agent' | 'admin' | NULL
--   NULL means "not yet evaluated" (same as unknown initial state).
--   Agent sets it to 'agent'; admin sets it to 'admin' (for yes/no) or NULL (for reset).
--   Agent only overwrites when qualified_set_by IS DISTINCT FROM 'admin'.
-- qualified_set_at: when the value was last written; NULL means never set.
--
-- No backfill — all existing rows default to 'unknown'. The agent will set values
-- on next classification; historical data is intentionally left as unknown.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS qualified        TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (qualified IN ('yes', 'no', 'unknown')),
  ADD COLUMN IF NOT EXISTS qualified_set_by TEXT        NULL,
  ADD COLUMN IF NOT EXISTS qualified_set_at TIMESTAMPTZ NULL;

-- Partial index for counting yes/no without scanning unknowns.
CREATE INDEX IF NOT EXISTS idx_inquiries_qualified_non_unknown
  ON inquiries (qualified)
  WHERE qualified <> 'unknown';
