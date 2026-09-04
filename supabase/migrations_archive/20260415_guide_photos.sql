-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: guide_photos
-- Per-guide photo gallery stored in Supabase Storage bucket `guide-photos`.
--
-- Guides upload photos from /dashboard/photos.
-- FA browses them when building experience_pages — the admin ExperiencePageForm
-- shows a "From gallery" picker on the hero + gallery image uploaders.
--
-- Storage:
--   Bucket  : guide-photos  (public, CDN-served)
--   Path    : {uuid}.{ext}  (flat — UUID ensures no collisions)
--   URL     : https://{project}.supabase.co/storage/v1/object/public/guide-photos/{path}
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guide_photos (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id    UUID         NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,         -- full public CDN URL
  caption     TEXT,                          -- optional alt text / caption
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_cover    BOOLEAN      NOT NULL DEFAULT false,  -- first photo = true
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary query pattern: fetch all photos for a guide ordered by position
CREATE INDEX IF NOT EXISTS guide_photos_guide_id_sort_idx
  ON guide_photos (guide_id, sort_order ASC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE guide_photos ENABLE ROW LEVEL SECURITY;

-- Guides can read their own photos (dashboard)
CREATE POLICY "Guide reads own photos"
  ON guide_photos FOR SELECT
  USING (
    guide_id = (
      SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Guides can insert their own photos
CREATE POLICY "Guide inserts own photos"
  ON guide_photos FOR INSERT
  WITH CHECK (
    guide_id = (
      SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Guides can delete their own photos
CREATE POLICY "Guide deletes own photos"
  ON guide_photos FOR DELETE
  USING (
    guide_id = (
      SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Guides can update their own photos (caption, sort_order, is_cover)
CREATE POLICY "Guide updates own photos"
  ON guide_photos FOR UPDATE
  USING (
    guide_id = (
      SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- NOTE: FA admin operations (SELECT across all guides, bulk INSERT/DELETE) use
-- the service_role key which bypasses RLS entirely — no extra policy needed.

-- ── Storage bucket policy reminder ───────────────────────────────────────────
-- Run this in Supabase Dashboard → Storage → guide-photos bucket → Policies:
--
-- 1. Public read (already set on public bucket — CDN serves all objects)
--
-- 2. Authenticated upload (via Dashboard or SQL):
--    CREATE POLICY "Authenticated upload to guide-photos"
--      ON storage.objects FOR INSERT
--      TO authenticated
--      WITH CHECK (bucket_id = 'guide-photos');
--
-- 3. Owner delete:
--    CREATE POLICY "Owner deletes own photos"
--      ON storage.objects FOR DELETE
--      TO authenticated
--      USING (bucket_id = 'guide-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
--    (Only needed if you switch to per-guide folder paths like {guide_id}/{uuid}.ext)
