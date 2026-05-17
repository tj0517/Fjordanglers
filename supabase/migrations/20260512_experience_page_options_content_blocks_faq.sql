-- Add content_blocks and faq columns to experience_page_options
ALTER TABLE experience_page_options
  ADD COLUMN IF NOT EXISTS content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faq            jsonb NOT NULL DEFAULT '[]'::jsonb;
