ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS content_photo_urls TEXT[] NOT NULL DEFAULT '{}';
