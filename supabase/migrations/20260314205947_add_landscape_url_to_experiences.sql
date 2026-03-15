-- Migration: 20260314205947_add_landscape_url_to_experiences.sql
-- Description: Adds a nullable landscape_url column to experiences for storing
--              a wide-format hero/landscape image URL (e.g. Supabase Storage CDN).
-- Affected tables: public.experiences

BEGIN;

-- ─── COLUMNS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS landscape_url TEXT;

COMMIT;
