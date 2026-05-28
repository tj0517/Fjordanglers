-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_photos_location
--
-- Adds photo gallery, location, and what-to-bring to the offer.
-- Also creates the offer-photos Supabase Storage bucket.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS offer_photos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS offer_location       TEXT,
  ADD COLUMN IF NOT EXISTS offer_what_to_bring  JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Supabase Storage bucket ────────────────────────────────────────────────────
-- Public bucket — photos are accessible via public URL on the offer page.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offer-photos',
  'offer-photos',
  true,
  5242880,   -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ───────────────────────────────────────────────────────

-- Service role (used by uploadOfferPhoto server action) can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'offer-photos service role upload'
  ) THEN
    CREATE POLICY "offer-photos service role upload"
      ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = 'offer-photos');
  END IF;
END $$;

-- Service role can also delete (for future "remove photo" support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'offer-photos service role delete'
  ) THEN
    CREATE POLICY "offer-photos service role delete"
      ON storage.objects FOR DELETE
      TO service_role
      USING (bucket_id = 'offer-photos');
  END IF;
END $$;

-- Public can read (bucket is public, policy is belt-and-suspenders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'offer-photos public read'
  ) THEN
    CREATE POLICY "offer-photos public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'offer-photos');
  END IF;
END $$;
