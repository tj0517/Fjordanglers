-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: guide_photos — organised per-guide folder structure
--
-- WHAT CHANGED
-- Previously photos were stored at flat paths: guide-photos/{uuid}.ext
-- Now all NEW uploads are stored at:           guide-photos/{guide_id}/{uuid}.ext
--
-- This gives every guide their own virtual folder in the bucket, making it
-- trivial to see all photos for a given guide and preventing cross-guide clutter.
--
-- EXISTING PHOTOS
-- Already-uploaded files keep their old flat paths until an admin triggers the
-- JS migration from the guide detail page (/admin/guides/{id}).
-- The `migrateGuidePhotosToFolder(guideId)` server action moves each file and
-- updates all DB references (guide_photos.url, experience_pages.hero_image_url,
-- experience_pages.gallery_image_urls). It is idempotent — safe to run multiple
-- times.  Already-organised files (path starts with {guide_id}/) are skipped.
--
-- STORAGE BUCKET
-- Bucket name : guide-photos
-- Visibility  : public  (CDN serves all objects without auth)
-- Old path    : {uuid}.ext
-- New path    : {guide_id}/{uuid}.ext
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Storage bucket policies ────────────────────────────────────────────────
-- Applied to storage.objects (Supabase Storage RLS layer).

-- 1. Public read — anyone (including anonymous) can read any photo.
--    Required even on a "public" bucket to allow unauthenticated CDN reads via
--    the Storage API endpoint (not just the CDN direct URL).
DO $$ BEGIN
  CREATE POLICY "guide-photos public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'guide-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Authenticated upload — any signed-in user may upload.
--    Covers both:
--      a) Guide uploading their own photos from /dashboard/photos
--      b) FA admin uploading on behalf of a guide from ExperiencePageForm
--    Path enforcement (guide_id/ prefix) is done in application code.
--    Service-role key uploads bypass RLS automatically.
DO $$ BEGIN
  CREATE POLICY "guide-photos authenticated upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'guide-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Authenticated update — allows overwriting an existing file (upsert).
--    Needed when a guide re-uploads or re-crops a photo.
DO $$ BEGIN
  CREATE POLICY "guide-photos authenticated update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'guide-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Owner delete — guide can only delete files inside their own folder.
--    The first path segment (storage.foldername(name))[1] = guide_id.
--    Flat legacy files (no slash in name) can only be deleted by service_role.
--    FA admin uses service_role key and bypasses RLS entirely.
DO $$ BEGIN
  CREATE POLICY "guide-photos owner delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'guide-photos'
      AND (storage.foldername(name))[1] = (
        SELECT id::text FROM guides WHERE user_id = auth.uid() LIMIT 1
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Verify storage.objects has RLS enabled ─────────────────────────────────
-- Supabase enables this by default; included here for documentation.
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── How to run the file-level migration for existing guides ────────────────
-- Open /admin/guides/{id} in the admin dashboard.
-- Each guide's card shows their photo count.
-- Click "Move to guide folder" — this calls migrateGuidePhotosToFolder(guideId)
-- which:
--   1. Lists all photos in guide_photos for that guide
--   2. Skips any whose storage path already starts with {guide_id}/
--   3. Moves remaining files: storage.move('{uuid}.ext', '{guide_id}/{uuid}.ext')
--   4. Updates guide_photos.url in this table
--   5. Updates experience_pages.hero_image_url where it matches
--   6. Updates experience_pages.gallery_image_urls (array element replacement)
--
-- The button shows migrated/skipped/errors counts on completion.
-- Run once per guide. Idempotent — safe to click multiple times.
