-- Migration: 20260313125203_add_guide_profile_columns.sql
-- Description: Adds guide profile columns from listing-booking-spec.md §1.1–1.7.
--              Covers: slug (SEO URL routing), tagline, certifications type upgrade
--              (TEXT → TEXT[]), specialties tags, Google review integration fields,
--              cancellation policy preset, and boat details section.
-- Affected tables: guides
--
-- ⚠️  BREAKING CHANGE — certifications column:
--     The existing `certifications TEXT` column is converted to `TEXT[]`.
--     Any application code that treats certifications as a plain string must be
--     updated to work with an array.  Files that need updating:
--       • src/actions/guide-apply.ts         (certifications: string  → string[])
--       • src/components/guides/apply-form.tsx (text input → tag/array input)
--       • src/app/(public)/guides/[id]/page.tsx (render array, not string)
--       • src/lib/mock-data.ts               (string literals → string[])

BEGIN;

-- ─── COLUMNS: Profile header (§ 1.1) ─────────────────────────────────────────

-- SEO-friendly URL segment: /guides/[country]/[slug]
-- e.g. "erik-hansen-tromso"
-- Populated by admin during onboarding; auto-generated from full_name + city.
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS slug     TEXT,
  ADD COLUMN IF NOT EXISTS tagline  TEXT
    CONSTRAINT guides_tagline_max_length
      CHECK (tagline IS NULL OR char_length(tagline) <= 120);

-- Unique constraint on slug (separate statement so IF NOT EXISTS on the column
-- above does not conflict with a pre-existing unique index on re-runs).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.guides'::regclass
      AND conname   = 'guides_slug_unique'
  ) THEN
    ALTER TABLE public.guides
      ADD CONSTRAINT guides_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- years_experience already present in schema — ADD COLUMN IF NOT EXISTS is a no-op.
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS years_experience INT;

-- ─── COLUMNS: Bio & Specialties (§ 1.3) ──────────────────────────────────────

-- ⚠️  certifications: TEXT → TEXT[]
-- Idempotent DO block handles three cases:
--   (a) column missing entirely  → create as TEXT[]
--   (b) column exists as TEXT    → convert, wrapping existing value in ARRAY[…]
--   (c) column already TEXT[]    → no-op
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type
    INTO col_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'guides'
     AND column_name  = 'certifications';

  IF col_type IS NULL THEN
    -- (a) Column does not exist yet
    ALTER TABLE public.guides ADD COLUMN certifications TEXT[];

  ELSIF col_type = 'text' THEN
    -- (b) Convert plain TEXT → TEXT[], preserving existing single-value data
    ALTER TABLE public.guides
      ALTER COLUMN certifications TYPE TEXT[]
      USING CASE
        WHEN certifications IS NULL THEN NULL::TEXT[]
        ELSE ARRAY[certifications]::TEXT[]
      END;

  END IF;
  -- (c) data_type = 'ARRAY' (already TEXT[]) → nothing to do
END $$;

-- Specialties: free-text tags, e.g. ["Fly fishing expert", "Trophy salmon"]
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS specialties TEXT[];

-- ─── COLUMNS: External Reviews (§ 1.5) ───────────────────────────────────────

-- google_rating valid range: 1.0–5.0 (same scale as Google Maps)
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS google_rating       NUMERIC(3,1)
    CONSTRAINT guides_google_rating_range
      CHECK (google_rating IS NULL OR google_rating BETWEEN 1.0 AND 5.0),
  ADD COLUMN IF NOT EXISTS google_review_count INT
    CONSTRAINT guides_google_review_count_nonneg
      CHECK (google_review_count IS NULL OR google_review_count >= 0),
  ADD COLUMN IF NOT EXISTS google_profile_url  TEXT,
  -- JSONB array of other external sources:
  -- [{source: "FishingBooker", rating: 4.7, count: 31, url: "https://..."}]
  ADD COLUMN IF NOT EXISTS external_reviews    JSONB;

-- ─── COLUMNS: Cancellation Policy (§ 2.7) ────────────────────────────────────

-- Policy is set at guide level — all of a guide's trips share the same preset.
-- Flexible  = free cancellation up to 7 days before
-- Moderate  = free cancellation up to 14 days before (default)
-- Strict    = free cancellation up to 30 days before
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT NOT NULL DEFAULT 'moderate'
    CONSTRAINT guides_cancellation_policy_values
      CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'));

-- ─── COLUMNS: Boat Details (§ 1.4) ───────────────────────────────────────────

-- Only surfaced on the guide profile when at least one of their trips is
-- boat-based. Hidden for pure river/shore guides.
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS boat_name     TEXT,
  ADD COLUMN IF NOT EXISTS boat_type     TEXT
    CONSTRAINT guides_boat_type_values
      CHECK (boat_type IS NULL OR
             boat_type IN ('center_console', 'cabin', 'rib', 'drift_boat', 'kayak')),
  ADD COLUMN IF NOT EXISTS boat_length_m NUMERIC(4,1)
    CONSTRAINT guides_boat_length_pos
      CHECK (boat_length_m IS NULL OR boat_length_m > 0),
  ADD COLUMN IF NOT EXISTS boat_engine   TEXT,
  ADD COLUMN IF NOT EXISTS boat_capacity INT
    CONSTRAINT guides_boat_capacity_pos
      CHECK (boat_capacity IS NULL OR boat_capacity > 0);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Primary lookup for /guides/[country]/[slug] routing
-- (UNIQUE constraint already implies an index; this partial index is faster
--  for "all verified guides with a slug" queries used in sitemaps & directories)
CREATE INDEX IF NOT EXISTS idx_guides_slug
  ON public.guides (slug)
  WHERE slug IS NOT NULL;

-- Compound index for /guides/[country] directory pages & SEO sitemap generation
CREATE INDEX IF NOT EXISTS idx_guides_country_slug
  ON public.guides (country, slug)
  WHERE slug IS NOT NULL
    AND verified_at IS NOT NULL;

-- Sorting / filtering guides by Google rating ("top guides in Norway")
CREATE INDEX IF NOT EXISTS idx_guides_google_rating
  ON public.guides (google_rating DESC NULLS LAST)
  WHERE google_rating IS NOT NULL;

-- Cancellation policy filter in search results
CREATE INDEX IF NOT EXISTS idx_guides_cancellation_policy
  ON public.guides (cancellation_policy);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

-- RLS is already ENABLED on public.guides (established in the initial schema
-- migration). New columns are automatically covered by existing row-level
-- policies — PostgreSQL RLS operates at row granularity, not column granularity.
--
-- Existing policy set (for reference):
--   • SELECT  — "Public reads verified guides"
--               USING (verified_at IS NOT NULL)
--   • SELECT  — "Guide reads own profile"
--               USING (user_id = auth.uid())
--   • UPDATE  — "Guide updates own profile"
--               USING (user_id = auth.uid())
--   • ALL     — service_role bypass (admin Server Actions)
--
-- No additional policies are required for these columns.

COMMIT;
