-- Migration: 20260309154301_add_location_coords_to_experiences.sql
-- Description: Adds location_lat and location_lng columns to the experiences table.
--              These coordinates are set by the LocationPickerMap in the experience form
--              (click to place pin, drag to fine-tune, or auto-locate via Nominatim geocoding).
--              Used by the public /experiences map view for precise pin placement.
-- Affected tables: experiences

BEGIN;

-- ─── COLUMNS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS location_lat  NUMERIC(10, 6) NULL,
  ADD COLUMN IF NOT EXISTS location_lng  NUMERIC(10, 6) NULL;

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Useful for geo-bounding-box queries (future: filter by map viewport)
CREATE INDEX IF NOT EXISTS idx_experiences_location_coords
  ON public.experiences (location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

COMMIT;
