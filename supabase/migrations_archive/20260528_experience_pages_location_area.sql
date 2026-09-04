-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: experience_pages_location_area
--
-- Adds location_area (GeoJSON Polygon) and location_spots (named spot array)
-- to experience_pages, mirroring what the legacy experiences table already has.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE experience_pages
  -- GeoJSON Polygon drawn by FA in the admin map editor
  ADD COLUMN IF NOT EXISTS location_area   JSONB,

  -- Array of named fishing spots: [{ lat, lng, name }]
  ADD COLUMN IF NOT EXISTS location_spots  JSONB;
