-- Add is_hidden flag to guides table.
-- Default TRUE means every guide (new and existing) starts hidden.
-- Guides can toggle visibility from their dashboard Account page.

ALTER TABLE guides
  ADD COLUMN is_hidden boolean NOT NULL DEFAULT true;

-- Partial index — only non-hidden guides, used by public listing queries.
CREATE INDEX idx_guides_is_hidden_visible
  ON guides (id)
  WHERE is_hidden = false;
