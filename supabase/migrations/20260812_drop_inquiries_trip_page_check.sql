-- Manual admin inquiries (from Instagram/WhatsApp leads) may have neither
-- trip_id nor experience_page_id — the angler hasn't chosen a trip yet.
-- The original constraint was designed for website form submissions only.

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_trip_or_page_check;
