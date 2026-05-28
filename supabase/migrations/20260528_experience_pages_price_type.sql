-- Add price_type column to experience_pages and experience_page_options
-- Supported values: 'per_person' | 'flat' | 'request'

ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'per_person';

ALTER TABLE experience_page_options
  ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'per_person';
