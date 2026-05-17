-- Add content_blocks to experience_pages (page-level text blocks, displayed after Season section)
ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]';
