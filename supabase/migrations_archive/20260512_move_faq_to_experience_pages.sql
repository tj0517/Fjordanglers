-- Move faq from experience_page_options to experience_pages (global per experience)
ALTER TABLE experience_page_options
  DROP COLUMN IF EXISTS faq;

ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;
