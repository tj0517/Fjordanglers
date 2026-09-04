-- Add views_image_urls column to experience_pages for the scenic Views gallery section
ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS views_image_urls TEXT[] DEFAULT '{}';
