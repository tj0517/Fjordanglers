-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_schedule_map
--
-- Adds structured schedule, license heading, and map coordinates to offers.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inquiries
  -- Structured day-by-day schedule (replaces free-text offer_trip_plan)
  -- Schema: [{ id: string, label: string, title: string, description: string }]
  ADD COLUMN IF NOT EXISTS offer_schedule          JSONB    NOT NULL DEFAULT '[]'::jsonb,

  -- Fishing licence heading (paired with existing offer_license_info body)
  ADD COLUMN IF NOT EXISTS offer_license_heading   TEXT,

  -- Map pin coordinates
  ADD COLUMN IF NOT EXISTS offer_location_lat      NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_location_lng      NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_location_zoom     INTEGER  DEFAULT 10,

  -- Optional area polygon (GeoJSON Feature from leaflet-draw rectangle)
  ADD COLUMN IF NOT EXISTS offer_location_geojson  JSONB;
