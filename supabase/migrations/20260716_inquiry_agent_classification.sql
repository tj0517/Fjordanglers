-- Agent classification fields
-- Written by the AI agent at the end of Round 1 (and refined in later rounds).
-- Displayed in the FA dashboard so the team knows country, trip type, and lead priority
-- at a glance without opening the full conversation.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS trip_country TEXT,
  ADD COLUMN IF NOT EXISTS trip_type    TEXT CHECK (trip_type IN ('day_trip', 'multi_day', 'lake_guiding', 'unknown')),
  ADD COLUMN IF NOT EXISTS priority     TEXT CHECK (priority  IN ('high', 'medium', 'low', 'not_viable'));

COMMENT ON COLUMN inquiries.trip_country IS 'Country identified by the agent: Iceland | Norway | Sweden | Finland | Other';
COMMENT ON COLUMN inquiries.trip_type    IS 'Trip type identified by the agent: day_trip | multi_day | lake_guiding | unknown';
COMMENT ON COLUMN inquiries.priority     IS 'Lead priority set by the agent: high | medium | low | not_viable';
