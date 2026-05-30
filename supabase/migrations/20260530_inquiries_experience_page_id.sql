-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_experience_page_id
--
-- Allows inquiries submitted from experience pages that don't yet have a
-- linked guide (trip_id = null). Adds experience_page_id so FA can still
-- identify which page the inquiry came from.
-- ─────────────────────────────────────────────────────────────────────────────

-- Make trip_id nullable — inquiries may come from pages without a guide
ALTER TABLE inquiries ALTER COLUMN trip_id DROP NOT NULL;

-- Add experience_page_id — links inquiry to the editorial page it came from
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS experience_page_id UUID REFERENCES experience_pages(id) ON DELETE RESTRICT;

-- At least one of trip_id or experience_page_id must be set
ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_trip_or_page_check
  CHECK (trip_id IS NOT NULL OR experience_page_id IS NOT NULL);

-- Index for FA dashboard filtering by experience page
CREATE INDEX IF NOT EXISTS inquiries_experience_page_id_idx
  ON inquiries (experience_page_id);
