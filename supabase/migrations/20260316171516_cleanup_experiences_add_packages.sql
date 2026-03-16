-- Migration: 20260316171516_cleanup_experiences_add_packages.sql
-- Description: Phase-1 schema cleanup for the experiences table (trips-spec.md v1.0).
--   1. Drop deprecated columns that are safe to remove (no src/ usage).
--   2. Add new descriptive content columns (itinerary, location_description,
--      per-trip logistics descriptions) per trips-spec.md §3–7.
--   3. Add the canonical `packages` JSONB column (trips-spec.md §5) that
--      replaces the old duration_options / group_pricing / price_per_person_eur
--      structure.
--   4. Migrate existing data: duration_options → packages, and synthesise a
--      minimal Standard package from price_per_person_eur where needed.
--   5. Add CHECK constraints that enforce publish-gate rules
--      (published = FALSE OR <field requirements>) — added as NOT VALID so
--      existing rows that may be incomplete are not rejected at migration time.
--   6. GIN index on packages for fast JSON-path filtering (level, pricing_model).
--
-- Affected tables: experiences
--
-- Columns still in use by src/ code (deferred to a future migration after code
-- is updated to use the new packages/fishing_methods fields):
--   meeting_point, technique, what_included, what_excluded,
--   duration_hours, duration_days, duration_options, group_pricing,
--   price_per_person_eur, max_guests, difficulty
--
-- ⚠️  NOT VALID constraints must be validated once data has been cleaned up:
--   ALTER TABLE public.experiences VALIDATE CONSTRAINT experiences_published_location_country;
--   ALTER TABLE public.experiences VALIDATE CONSTRAINT experiences_published_season;
--   ALTER TABLE public.experiences VALIDATE CONSTRAINT experiences_published_has_image;
--   ALTER TABLE public.experiences VALIDATE CONSTRAINT experiences_published_has_packages;

BEGIN;

-- ─── 1. DROP DEPRECATED COLUMNS (safe — zero usage in src/) ──────────────────

-- location_latitude / location_longitude: duplicates of location_lat / location_lng
-- (canonical coords kept: location_lat, location_lng — added in 20260309154301)
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS location_latitude,
  DROP COLUMN IF EXISTS location_longitude;

-- boat_included: replaced by inclusions.boat (inclusions JSONB added in 20260313125204)
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS boat_included;

-- meeting_time: replaced by packages[].availability.notes
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS meeting_time;

-- tags: unclear purpose; remove — use seo_tags if needed in future
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS tags;

-- ─── 2. ADD NEW CONTENT COLUMNS ───────────────────────────────────────────────

-- Plan wycieczki: ordered array of time+label steps displayed on trip page §4.
-- Expected shape:  [{"time": "06:00", "label": "Departure from Tromsø harbour"}]
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS itinerary JSONB;

-- Akapit opisujący konkretne miejsce połowu (rzeka, jezioro, fjord) — odrębny od
-- opisu tripu; indeksowany przez Google pod kątem SEO dla danej lokalizacji.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS location_description TEXT;

-- Szczegóły logistyczne wyświetlane per-trip tylko gdy pole jest wypełnione (§7).
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS boat_description          TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_description TEXT,
  ADD COLUMN IF NOT EXISTS food_description          TEXT,
  ADD COLUMN IF NOT EXISTS license_description       TEXT,
  ADD COLUMN IF NOT EXISTS gear_description          TEXT,
  ADD COLUMN IF NOT EXISTS transport_description     TEXT;

-- ─── 3. ADD packages COLUMN ───────────────────────────────────────────────────

-- Canonical trip pricing/duration structure (trips-spec.md §5).
-- Replaces: duration_options, group_pricing, price_per_person_eur, max_guests,
--           difficulty, meeting_time.
--
-- Minimal shape of one element (full spec in docs/trips-spec.md §5):
-- {
--   "id":             "half-day",
--   "label":          "Half Day",
--   "duration_hours": 4,
--   "duration_days":  null,
--   "pricing_model":  "per_person",   -- per_person | per_boat | per_group
--   "price_eur":      150,
--   "group_prices":   null,           -- map e.g. {"1": 150, "2": 270} for per_group
--   "level":          "all",          -- all | beginner | intermediate | expert
--   "max_group":      4,
--   "min_group":      1,
--   "availability": {
--     "season_from":   6,
--     "season_to":     9,
--     "blocked_dates": ["2026-07-15"],
--     "notes":         null
--   }
-- }
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS packages JSONB;

-- ─── 4. DATA MIGRATION: populate packages from legacy fields ──────────────────

-- Step 4a: Copy duration_options directly into packages where packages is still
--          empty and duration_options is present.
--          NOTE: duration_options uses a different internal shape (hours/days/
--          price_eur/includes_lodging); the guide dashboard will show a banner
--          to prompt the guide to review and enrich their packages after launch.
UPDATE public.experiences
SET packages = duration_options
WHERE packages IS NULL
  AND duration_options IS NOT NULL;

-- Step 4b: For experiences that have no duration_options but do have a legacy
--          price_per_person_eur, synthesise a minimal "Standard" package so
--          the trip can still be published under the new schema.
UPDATE public.experiences
SET packages = jsonb_build_array(
  jsonb_build_object(
    'id',             'standard',
    'label',          'Standard',
    'duration_hours', duration_hours,
    'duration_days',  duration_days,
    'pricing_model',  'per_person',
    'price_eur',      price_per_person_eur,
    'group_prices',   NULL,
    'level',          COALESCE(difficulty, 'all'),
    'max_group',      COALESCE(max_guests, 8),
    'min_group',      1,
    'availability',   jsonb_build_object(
                        'season_from',   season_from,
                        'season_to',     season_to,
                        'blocked_dates', '[]'::jsonb,
                        'notes',         NULL
                      )
  )
)
WHERE packages IS NULL
  AND price_per_person_eur IS NOT NULL;

-- ─── 5. PUBLISH-GATE CHECK CONSTRAINTS ───────────────────────────────────────
--
-- Pattern: published = FALSE OR <condition>
-- All constraints added as NOT VALID — existing rows are not immediately checked.
-- Validate manually once data has been reviewed:
--   ALTER TABLE public.experiences VALIDATE CONSTRAINT <name>;

-- 5a. Published trip must declare the country it takes place in.
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_location_country
    CHECK (
      published = FALSE
      OR location_country IS NOT NULL
    )
  NOT VALID;

-- 5b. Published trip must declare its season window (month numbers 1–12).
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_season
    CHECK (
      published = FALSE
      OR (season_from IS NOT NULL AND season_to IS NOT NULL)
    )
  NOT VALID;

-- 5c. Published trip must have at least one image (images array or landscape hero).
--     images is TEXT[], so array_length returns NULL for empty → use cardinality().
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_has_image
    CHECK (
      published = FALSE
      OR landscape_url IS NOT NULL
      OR (images IS NOT NULL AND cardinality(images) > 0)
    )
  NOT VALID;

-- 5d. Published trip must have at least one package.
--     Add only after Step 4 data migration has been verified (hence last).
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_has_packages
    CHECK (
      published = FALSE
      OR (packages IS NOT NULL AND jsonb_array_length(packages) >= 1)
    )
  NOT VALID;

-- ─── 6. INDEXES ───────────────────────────────────────────────────────────────

-- GIN index on packages for JSONB-path queries:
--   packages @> '[{"level": "beginner"}]'
--   packages @> '[{"pricing_model": "per_boat"}]'
-- Partial: only published trips, only rows where packages is set.
CREATE INDEX IF NOT EXISTS idx_experiences_packages
  ON public.experiences USING GIN (packages)
  WHERE packages IS NOT NULL
    AND published = TRUE;

COMMIT;
