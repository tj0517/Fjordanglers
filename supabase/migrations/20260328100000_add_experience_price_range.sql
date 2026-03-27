-- Add optional price range hint columns for "Price on request" (icelandic) experiences.
-- Guides can optionally set a min/max price hint that is shown to anglers on the trip page.
-- Both columns are nullable — not required even for icelandic listings.

ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS price_range_min_eur numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_range_max_eur numeric(10,2) DEFAULT NULL;
