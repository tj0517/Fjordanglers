-- ============================================================
-- Migration part 1/2: Extend booking_status enum
-- 2026-04-01
--
-- MUST run in its own transaction (separate file) because
-- PostgreSQL error 55P04: "New enum values must be committed
-- before they can be used." — ALTER TYPE ADD VALUE is committed
-- at end of this transaction, making the values available for
-- the next migration file (20260401000001_unify_bookings_data.sql).
-- ============================================================

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'offer_sent';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'offer_accepted';
