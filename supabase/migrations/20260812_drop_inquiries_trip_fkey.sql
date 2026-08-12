-- inquiries.trip_id had a FK to the experiences table which no longer exists
-- (production uses expeditions). Drop the constraint so inserts don't fail.
-- The column is kept but unconstrained; lookups now go through experience_page_id.

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_trip_id_fkey;
