-- Migration: 20260313125204_add_experience_trip_columns.sql
-- Description: Adds trip-page columns from listing-booking-spec.md §2.1–2.9.
--              Covers: slug (SEO URL /trips/[slug]), duration options (1–4 variants
--              per trip), group-size pricing, fishing methods array, season range,
--              meeting-point address + coordinates, inclusions checklist (JSONB),
--              and license region cross-link to /license-map.
-- Affected tables: experiences
--
-- Notes on existing column overlap:
--   • `meeting_point TEXT`   → kept for backwards compat; new `meeting_point_address`
--     is the canonical field for trip-page rendering going forward.
--   • `location_lat/lng`     → added in migration 20260309154301 for map-view pins;
--     new `meeting_point_lat/lng` are the specific departure/meeting coordinates.
--   • `technique TEXT`       → kept; `fishing_methods TEXT[]` replaces it for new
--     trip-page rendering and search filter.

BEGIN;

-- ─── COLUMNS: Trip header (§ 2.1) ────────────────────────────────────────────

-- SEO URL segment: /trips/[slug]
-- e.g. "salmon-fishing-tromso-erik-hansen"
-- Populated by admin during onboarding.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS slug TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.experiences'::regclass
      AND conname   = 'experiences_slug_unique'
  ) THEN
    ALTER TABLE public.experiences
      ADD CONSTRAINT experiences_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- ─── COLUMNS: Duration options & pricing (§ 2.2 / 2.3) ──────────────────────

-- duration_options: array of 1–4 selectable variants the angler picks at booking.
-- JSONB shape (array):
--   [
--     {
--       "label":            "Half day",   -- display name
--       "hours":            4,            -- duration in hours (null for multi-day)
--       "days":             null,         -- duration in nights (null for single-day)
--       "price_eur":        250,          -- base price for this option
--       "includes_lodging": false         -- true for packages with accommodation
--     },
--     { "label": "Full day", "hours": 8, "days": null, "price_eur": 400, "includes_lodging": false },
--     { "label": "2-day",    "hours": null, "days": 2, "price_eur": 900, "includes_lodging": true  }
--   ]
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS duration_options JSONB;

-- group_pricing: pricing model + per-size price table.
-- JSONB shape:
--   {
--     "model":  "flat" | "per_size",     -- flat = same price regardless of group size
--     "prices": { "1": 250, "2": 350, "3": 400, "4": 450 }   -- per_size only
--   }
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS group_pricing JSONB;

-- ─── COLUMNS: Trip details (§ 2.2) ───────────────────────────────────────────

-- fishing_methods: multi-select array, e.g. ["Fly fishing", "Spinning", "Trolling"]
-- NOT NULL + DEFAULT '{}' so the column is always queryable with array operators.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS fishing_methods TEXT[] NOT NULL DEFAULT '{}';

-- season_from / season_to: month numbers 1–12.
-- e.g. season_from=6, season_to=9 → "June → September"
-- Query pattern: WHERE season_from <= :month AND season_to >= :month
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS season_from INT
    CONSTRAINT experiences_season_from_range
      CHECK (season_from IS NULL OR season_from BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS season_to   INT
    CONSTRAINT experiences_season_to_range
      CHECK (season_to IS NULL OR season_to BETWEEN 1 AND 12);

-- ─── COLUMNS: Meeting point (§ 2.6) ──────────────────────────────────────────

-- meeting_point_address: human-readable text shown on trip page map section.
-- meeting_point_lat/lng: map pin with higher precision than location_lat/lng
-- (which are used for the search-results map viewport, NUMERIC(10,6)).
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS meeting_point_address TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point_lat     NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS meeting_point_lng     NUMERIC(10,7);

-- ─── COLUMNS: Inclusions checklist (§ 2.5) ───────────────────────────────────

-- inclusions: JSONB boolean checklist + optional custom items.
-- JSONB shape:
--   {
--     "rods":            true,
--     "tackle":          true,
--     "bait":            false,
--     "boat":            true,
--     "safety":          true,   -- life jackets
--     "license":         false,  -- fishing license
--     "lunch":           false,
--     "drinks":          false,
--     "fish_cleaning":   true,
--     "transport":       false,  -- transport to fishing spot
--     "accommodation":   false,  -- multi-day only
--     "custom":          ["Waders available on request"]  -- up to 3 custom items
--   }
-- The UI auto-generates a "What's NOT included" list from toggled-off items.
-- When license=false, the trip page auto-links to /license-map?region=<license_region>.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS inclusions JSONB;

-- ─── COLUMNS: License cross-link (§ 2.8 / 1.7) ───────────────────────────────

-- Links to /license-map?region=<license_region>
-- e.g. "tromso", "northern-norway", "swedish-lapland"
-- No competitor provides this — FjordAnglers unique value prop.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS license_region TEXT;

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Primary lookup index for /trips/[slug] routing & sitemap generation
CREATE INDEX IF NOT EXISTS idx_experiences_slug
  ON public.experiences (slug)
  WHERE slug IS NOT NULL;

-- Season range filter: "show me trips available in month X"
-- Query: WHERE season_from <= :month AND season_to >= :month AND published = TRUE
CREATE INDEX IF NOT EXISTS idx_experiences_season
  ON public.experiences (season_from, season_to)
  WHERE season_from IS NOT NULL
    AND season_to   IS NOT NULL
    AND published   = TRUE;

-- GIN index for fishing_methods array queries:
--   • "Fly fishing" = ANY(fishing_methods)
--   • fishing_methods && ARRAY['Fly fishing','Spinning']  (overlap)
CREATE INDEX IF NOT EXISTS idx_experiences_fishing_methods
  ON public.experiences USING GIN (fishing_methods)
  WHERE published = TRUE;

-- License region lookup — used by cross-sell module on trip page
CREATE INDEX IF NOT EXISTS idx_experiences_license_region
  ON public.experiences (license_region)
  WHERE license_region IS NOT NULL;

-- Bounding-box queries from the trip map section
CREATE INDEX IF NOT EXISTS idx_experiences_meeting_point_coords
  ON public.experiences (meeting_point_lat, meeting_point_lng)
  WHERE meeting_point_lat IS NOT NULL
    AND meeting_point_lng IS NOT NULL;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

-- RLS is already ENABLED on public.experiences (established in initial schema).
-- New columns are automatically covered by existing row-level policies.
--
-- Existing policy set (for reference):
--   • SELECT  — "Public reads published experiences"
--               USING (published = TRUE)
--   • SELECT  — "Guide reads own experiences"
--               USING (guide_id = (SELECT id FROM public.guides
--                                  WHERE user_id = auth.uid()))
--   • UPDATE  — "Guide updates own experiences"
--               USING (guide_id = (SELECT id FROM public.guides
--                                  WHERE user_id = auth.uid()))
--   • INSERT  — "Guide inserts own experiences"
--               WITH CHECK (guide_id = (SELECT id FROM public.guides
--                                       WHERE user_id = auth.uid()))
--   • ALL     — service_role bypass (admin Server Actions)
--
-- No additional policies are required for these columns.

COMMIT;
