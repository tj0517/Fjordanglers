-- Add multi-block boats to experience_pages (replaces single boat_description/boat_image_url)
ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS boats JSONB DEFAULT '[]';

-- Add multi-block boats + per-option season to experience_page_options
ALTER TABLE experience_page_options
  ADD COLUMN IF NOT EXISTS boats JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS season_months INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS peak_months   INTEGER[] DEFAULT '{}';
