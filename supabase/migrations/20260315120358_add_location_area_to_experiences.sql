-- Migration: 20260315120358_add_location_area_to_experiences.sql
-- Description: Add optional GeoJSON polygon column to experiences so guides can
--              draw a trip area on the map. The centroid of the polygon is stored
--              in the existing location_lat / location_lng columns.
-- Affected tables: public.experiences

BEGIN;

-- ─── SCHEMA CHANGE ────────────────────────────────────────────────────────────

ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS location_area jsonb NULL;

COMMENT ON COLUMN experiences.location_area IS
  'Optional GeoJSON Polygon drawn by the guide to indicate the trip area. When set, location_lat/lng hold the centroid.';

COMMIT;
