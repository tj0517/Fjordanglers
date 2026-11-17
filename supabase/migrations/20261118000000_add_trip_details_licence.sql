-- FA-M.07 — licences/permits on the Trip Brief (`inquiry_trip_details`).
--
-- The request page `/r/[token]` shows a "Licence" row (approved mockup
-- docs/design/fa-m-guide-app/Main.dc.html): who buys the fishing licence or permit, plus a
-- short note (which licence, where). tj decision 1 (A), 2026-11-17: two nullable columns, the
-- buyer from a fixed list (no "FA buys" — FA does not handle client money beyond the deposit).
-- Labels live in the app: client → "Client buys", guide → "Guide arranges",
-- not_needed → "No licence needed".
--
-- Additive only: no existing column, row or policy changes. The one policy on the table
-- (guide_read_assigned_trip_details, SELECT for the assigned guide) covers the new columns
-- as it covers the rest of the row.

ALTER TABLE public.inquiry_trip_details
  ADD COLUMN licence_buyer text
    CONSTRAINT inquiry_trip_details_licence_buyer_check
    CHECK (licence_buyer IN ('client', 'guide', 'not_needed')),
  ADD COLUMN licence_note text
    CONSTRAINT inquiry_trip_details_licence_note_length_check
    CHECK (char_length(licence_note) <= 300);

COMMENT ON COLUMN public.inquiry_trip_details.licence_buyer IS
  'Who buys the fishing licence/permit: client | guide | not_needed (FA-M.07). NULL = not set.';
COMMENT ON COLUMN public.inquiry_trip_details.licence_note IS
  'Free-text note on the licence/permit, e.g. which licence and where (FA-M.07). Max 300 chars.';
