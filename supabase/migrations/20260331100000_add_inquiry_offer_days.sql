-- Add offer_days to trip_inquiries
-- Stores the individual days selected by the guide in their offer (e.g. [2026-06-02, 2026-06-03, 2026-06-10]).
-- Distinct from offer_date_from/offer_date_to which are just the min/max boundary.
-- When present, the calendar renders only these specific days instead of expanding
-- the full from→to range (which would falsely mark all days in between as busy).

ALTER TABLE trip_inquiries
  ADD COLUMN IF NOT EXISTS offer_days text[];
