-- ============================================================
-- Backfill confirmed_days for all existing accepted/confirmed bookings
-- 2026-04-04
--
-- Context:
--   confirmed_days column existed but was never written to.
--   This migration populates it from existing data so old bookings
--   work correctly with the new non-consecutive-safe display logic.
--
-- Priority per source:
--
--   direct bookings (source = 'direct'):
--     Old code overwrote requested_dates with confirmedDays on accept.
--     So for existing confirmed direct bookings: confirmed_days = requested_dates.
--     (Going forward, requested_dates is immutable — only confirmed_days is written.)
--
--   inquiry bookings (source = 'inquiry'):
--     1. offer_days   — guide explicitly picked individual days (non-consecutive safe)
--     2. offer range  — expand offer_date_from..offer_date_to as fallback
--        NOTE: this expansion produces CONSECUTIVE days. If the guide actually
--        offered non-consecutive days but only stored the envelope, those days
--        will incorrectly appear consecutive in historical data. Acceptable trade-off
--        for backfill — new offers will have offer_days set.
-- ============================================================

-- ── Step 1: direct bookings — confirmed_days from requested_dates ─────────────
-- (In old code requested_dates was overwritten with confirmed days at acceptance.)

UPDATE bookings
SET confirmed_days = requested_dates
WHERE source = 'direct'
  AND status IN ('accepted', 'confirmed', 'completed')
  AND confirmed_days IS NULL
  AND requested_dates IS NOT NULL
  AND array_length(requested_dates, 1) > 0;

-- ── Step 2: inquiry bookings — confirmed_days from offer_days ─────────────────

UPDATE bookings
SET confirmed_days = offer_days
WHERE source = 'inquiry'
  AND status IN ('accepted', 'offer_accepted', 'confirmed', 'completed')
  AND confirmed_days IS NULL
  AND offer_days IS NOT NULL
  AND array_length(offer_days, 1) > 0;

-- ── Step 3: inquiry bookings — confirmed_days from offer range (fallback) ─────
-- Expands offer_date_from..offer_date_to into individual ISO date strings.

UPDATE bookings
SET confirmed_days = ARRAY(
  SELECT TO_CHAR(
    generate_series(
      offer_date_from::date,
      offer_date_to::date,
      '1 day'::interval
    ),
    'YYYY-MM-DD'
  )
)
WHERE source = 'inquiry'
  AND status IN ('accepted', 'offer_accepted', 'confirmed', 'completed')
  AND confirmed_days IS NULL
  AND offer_date_from IS NOT NULL
  AND offer_date_to   IS NOT NULL;

-- ── Step 4: fill confirmed_date_from / confirmed_date_to from confirmed_days ──
-- Keeps envelope columns consistent for any rows that were missing them.

UPDATE bookings
SET
  confirmed_date_from = confirmed_days[1]::date,
  confirmed_date_to   = confirmed_days[array_length(confirmed_days, 1)]::date
WHERE confirmed_days IS NOT NULL
  AND array_length(confirmed_days, 1) > 0
  AND (confirmed_date_from IS NULL OR confirmed_date_to IS NULL);
