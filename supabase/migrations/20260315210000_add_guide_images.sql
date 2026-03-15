-- Migration: 20260315210000_add_guide_images.sql
-- Description: Adds guide_images table for one-to-many gallery photos per guide,
--              mirroring the existing experience_images pattern.
-- Affected tables: guide_images

BEGIN;

-- ─── TABLES ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guide_images (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id    UUID        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  is_cover    BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_guide_images_guide_id
  ON public.guide_images(guide_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE public.guide_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read guide images (public listings)
CREATE POLICY "guide_images_public_read"
  ON public.guide_images FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (server actions use service client)
CREATE POLICY "guide_images_service_insert"
  ON public.guide_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "guide_images_service_update"
  ON public.guide_images FOR UPDATE
  USING (true);

CREATE POLICY "guide_images_service_delete"
  ON public.guide_images FOR DELETE
  USING (true);

COMMIT;
