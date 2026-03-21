-- Add confirmed trip date range and meeting point coordinates to trip_inquiries.
--
-- offer_date_from / offer_date_to — the specific dates the guide is proposing
--   (may differ from the angler's requested window)
-- offer_meeting_lat / offer_meeting_lng — GPS pin for the meeting / departure point

ALTER TABLE trip_inquiries
  ADD COLUMN IF NOT EXISTS offer_date_from   date,
  ADD COLUMN IF NOT EXISTS offer_date_to     date,
  ADD COLUMN IF NOT EXISTS offer_meeting_lat float8,
  ADD COLUMN IF NOT EXISTS offer_meeting_lng float8;
