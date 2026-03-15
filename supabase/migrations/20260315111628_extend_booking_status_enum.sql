-- Migration: 20260315111628_extend_booking_status_enum.sql
-- Description: Extends the booking_status enum with 'accepted' and 'declined'
--              values needed for the guide accept/decline flow (Wave 4B).
--              PostgreSQL enums are append-only — existing rows are unaffected.
-- Affected tables: bookings (via booking_status enum)

BEGIN;

-- ─── ENUM EXTENSION ───────────────────────────────────────────────────────────
-- ADD VALUE IF NOT EXISTS is idempotent — safe to run multiple times.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
--       in PostgreSQL < 12. From PG 12+ it is supported inside transactions.
--       Supabase uses PG 15+, so this is safe.

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'declined';

COMMIT;
