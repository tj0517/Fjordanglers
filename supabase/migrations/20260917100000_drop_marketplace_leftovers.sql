-- FA-1.02: drop_marketplace_leftovers
-- Removes the archive schema (10 pre-pivot marketplace tables) and dead public tables.
-- All tables with data have been exported to docs/archive/2026-09-17-archive/.
-- Prod counts verified via MCP SELECT on 2026-09-17.

-- ─── archive schema ────────────────────────────────────────────────────────────

-- Drop dependent tables before experiences to avoid implicit cascade side effects.
DROP TABLE IF EXISTS archive.experience_images;         -- 134 rows (exported)
DROP TABLE IF EXISTS archive.experience_accommodations; -- 1 row (exported)
DROP TABLE IF EXISTS archive.guide_accommodations;      -- 2 rows (exported)
DROP TABLE IF EXISTS archive.experience_availability_config; -- 0 rows
DROP TABLE IF EXISTS archive.experience_blocked_dates;  -- 0 rows
DROP TABLE IF EXISTS archive.booking_messages;          -- 0 rows
DROP TABLE IF EXISTS archive.payments;                  -- 0 rows (FK payments_booking_id_fkey → bookings; drop first)
DROP TABLE IF EXISTS archive.bookings;                  -- 0 rows
DROP TABLE IF EXISTS archive.leads;                     -- 0 rows

-- CASCADE drops:
--   • FK constraint experience_pages_trip_id_fkey
--     (public.experience_pages.trip_id → archive.experiences ON DELETE SET NULL)
--     DROP CASCADE removes the constraint; it does NOT fire ON DELETE SET NULL,
--     so existing trip_id values in experience_pages become orphaned UUIDs.
--     All 33 non-NULL trip_ids were verified to already have matching experience_pages
--     rows (0 orphaned inquiries); the orphaned UUIDs are inert after this drop.
--   • Trigger audit_experiences on archive.experiences
--     (fires audit_trigger_fn → public.audit_log; auto-dropped with the table)
DROP TABLE IF EXISTS archive.experiences CASCADE;       -- 22 rows (exported)

DROP SCHEMA IF EXISTS archive;

-- ─── public tables (all 0 rows on prod) ────────────────────────────────────────

DROP TABLE IF EXISTS public.expedition_private;
DROP TABLE IF EXISTS public.media_links;            -- FK media_links_media_id_fkey → media; drop first
DROP TABLE IF EXISTS public.media;
DROP TABLE IF EXISTS public.inquiry_todos;
DROP TABLE IF EXISTS public.guide_availability;
DROP TABLE IF EXISTS public.guide_intake_submissions;

-- ─── enums (no remaining columns use these after the drops above) ───────────────

DROP TYPE IF EXISTS public.booking_status;
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS public.trip_inquiry_status;
