-- Add lat/lng coordinates to experience_pages so FA can place map pins
-- on the /trips listing page (same map+list layout as before).

ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

COMMENT ON COLUMN experience_pages.location_lat IS 'Primary map pin latitude — set by FA when curating the experience page';
COMMENT ON COLUMN experience_pages.location_lng IS 'Primary map pin longitude — set by FA when curating the experience page';
