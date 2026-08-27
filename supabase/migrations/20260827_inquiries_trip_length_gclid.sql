-- Add trip_length and gclid to the inquiries table.
--
-- trip_length: how long the angler wants to fish (used for lead value estimation
--              and Google Ads conversion value import).
-- gclid:       Google Click ID captured from the landing URL — used for offline
--              conversion import so Google Ads can attribute the inquiry to the
--              exact ad click.
--
-- Run in Supabase dashboard SQL editor.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS trip_length TEXT
    CHECK (trip_length IN ('1', '2-3', '4-7', '7+')),
  ADD COLUMN IF NOT EXISTS gclid TEXT;
