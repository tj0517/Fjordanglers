-- Add accommodations array to experience_pages (global, multi-item, like special_attractions)
ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS accommodations jsonb NOT NULL DEFAULT '[]'::jsonb;
