-- ─── calendar_blocked_dates ────────────────────────────────────────────────────
--
-- Stores availability blocks at the CALENDAR level (not per experience).
--
-- When one experience in a calendar is booked, the entire calendar blocks that
-- day — all sibling experiences inherit the same unavailability automatically.
--
-- Two sources of blocks:
--   • Manual:  guide blocks a period via the dashboard (reason IS NULL or custom)
--   • Booking: acceptBooking() / sendOffer() write here (reason = 'booking:<id>')
--
-- Reading availability for an angler:
--   → experience in a calendar → read calendar_blocked_dates WHERE calendar_id = X
--   → experience NOT in any calendar → read experience_blocked_dates (unchanged)
--
-- Migration:
--   Existing booking blocks in experience_blocked_dates for calendared experiences
--   are migrated here (deduplicated by calendar) and then removed from the source.
--   Manual blocks for calendared experiences are migrated too.
--   Blocks for uncalendared experiences are left in experience_blocked_dates.

-- ─── 1. Create table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_blocked_dates (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_id uuid        NOT NULL REFERENCES guide_calendars(id) ON DELETE CASCADE,
  date_start  date        NOT NULL,
  date_end    date        NOT NULL,
  reason      text,
  created_at  timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT calendar_blocked_dates_date_order CHECK (date_end >= date_start)
);

-- ─── 2. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cbd_calendar_id
  ON calendar_blocked_dates(calendar_id);

CREATE INDEX IF NOT EXISTS idx_cbd_date_range
  ON calendar_blocked_dates(calendar_id, date_start, date_end);

-- Unique: booking blocks (one row per calendar + date range + reason)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbd_booking
  ON calendar_blocked_dates(calendar_id, date_start, date_end, reason)
  WHERE reason IS NOT NULL;

-- Unique: manual blocks with NULL reason
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbd_manual
  ON calendar_blocked_dates(calendar_id, date_start, date_end)
  WHERE reason IS NULL;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE calendar_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Public can read (angler date picker uses anon client / user client)
CREATE POLICY "Public reads calendar blocked dates"
  ON calendar_blocked_dates FOR SELECT
  USING (true);

-- Guide can insert/update/delete blocks for their own calendars
CREATE POLICY "Guide manages own calendar blocks"
  ON calendar_blocked_dates FOR ALL
  USING (
    calendar_id IN (
      SELECT gc.id FROM guide_calendars gc
      JOIN guides g ON g.id = gc.guide_id
      WHERE g.user_id = auth.uid()
    )
  );

-- ─── 4. Migrate existing blocks (with overlap merging) ───────────────────────
--
-- Transfer ALL blocks from experience_blocked_dates → calendar_blocked_dates
-- for experiences assigned to a calendar.
--
-- Uses window functions to merge overlapping/adjacent ranges per calendar
-- before inserting, so we never get two rows covering the same day.
--
-- Example:
--   experience_blocked_dates has May1–7 AND May3–3 for the same experience
--   → after merge: single row May1–7 in calendar_blocked_dates
--
-- Uncalendared experiences are left untouched in experience_blocked_dates.

WITH
-- 1. Collect all distinct (calendar, date_start, date_end) combinations
raw AS (
  SELECT DISTINCT
    ce.calendar_id,
    ebd.date_start::date AS date_start,
    ebd.date_end::date   AS date_end
  FROM experience_blocked_dates ebd
  JOIN calendar_experiences ce ON ce.experience_id = ebd.experience_id
),
-- 2. For each row, look at the previous row's end date within the same calendar
ordered AS (
  SELECT *,
    LAG(date_end) OVER (PARTITION BY calendar_id ORDER BY date_start, date_end) AS prev_end
  FROM raw
),
-- 3. Mark where a new non-overlapping group starts
--    (current start > previous end + 1 day  →  gap between ranges)
group_starts AS (
  SELECT *,
    CASE
      WHEN prev_end IS NULL                          THEN 1
      WHEN date_start > prev_end + INTERVAL '1 day' THEN 1
      ELSE 0
    END AS is_new_group
  FROM ordered
),
-- 4. Cumulative sum gives each contiguous group a unique number per calendar
groups AS (
  SELECT *,
    SUM(is_new_group) OVER (PARTITION BY calendar_id ORDER BY date_start, date_end) AS grp
  FROM group_starts
)
-- 5. Insert one merged row per group (min start → max end)
INSERT INTO calendar_blocked_dates (calendar_id, date_start, date_end)
SELECT calendar_id, MIN(date_start), MAX(date_end)
FROM groups
GROUP BY calendar_id, grp
ON CONFLICT DO NOTHING;

-- 6. Remove the now-migrated per-experience rows.
--    Uncalendared experiences (not in calendar_experiences) are untouched.
DELETE FROM experience_blocked_dates
WHERE experience_id IN (
  SELECT experience_id FROM calendar_experiences
);
