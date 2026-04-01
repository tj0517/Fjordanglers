-- ─── Default Calendar + Full Block Migration ─────────────────────────────────
--
-- Goals:
--   1. Every guide that has experiences but no calendar gets a "Main Calendar"
--      auto-created in guide_calendars.
--
--   2. Every experience not yet assigned to any calendar is assigned to its
--      guide's earliest calendar (the "Main Calendar" just created or one that
--      already existed).
--
--   3. All rows in experience_blocked_dates are transferred to
--      calendar_blocked_dates, using a window-function merge to collapse
--      overlapping / adjacent ranges into single rows.
--      Partitioned by (calendar_id, reason) so:
--        • Manual blocks (reason IS NULL) — merged per calendar ✓
--        • Booking blocks (reason = 'booking:<id>') — not merged across bookings ✓
--
--   4. experience_blocked_dates is emptied (table kept for now — DROP in a
--      future migration once all code paths are confirmed calendar-only).
--
-- Safe to re-run: INSERT … ON CONFLICT DO NOTHING / WHERE NOT EXISTS guards.

-- ─── 1. Create "Main Calendar" for every guide with no calendar yet ───────────

INSERT INTO guide_calendars (guide_id, name)
SELECT DISTINCT e.guide_id, 'Main Calendar'
FROM   experiences e
WHERE  NOT EXISTS (
  SELECT 1 FROM guide_calendars gc WHERE gc.guide_id = e.guide_id
);

-- ─── 2. Assign every uncalendared experience to its guide's earliest calendar ─

-- LATERAL JOIN picks the guide's first calendar by created_at.
-- The INNER JOIN (not LEFT) implicitly skips orphaned experiences with no
-- matching calendar row — safe against NULL calendar_id in the FK column.
-- Experiences already in calendar_experiences are skipped (NOT EXISTS guard).

INSERT INTO calendar_experiences (calendar_id, experience_id)
SELECT cal.id AS calendar_id, e.id AS experience_id
FROM   experiences e
JOIN LATERAL (
  SELECT gc.id
  FROM   guide_calendars gc
  WHERE  gc.guide_id = e.guide_id
  ORDER  BY gc.created_at
  LIMIT  1
) AS cal(id) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_experiences ce WHERE ce.experience_id = e.id
);

-- ─── 3. Transfer experience_blocked_dates → calendar_blocked_dates ────────────
--
-- Window-function merge per (calendar_id, reason) so overlapping ranges for the
-- same calendar & reason collapse into one row.
--
-- Example:
--   experience_blocked_dates has rows May 1–7 and May 3–10 for the same exp
--   → JOIN gives calendar_id + those two ranges
--   → merged row: May 1–10 in calendar_blocked_dates
--
-- NULL reason is treated as '' for PARTITION purposes only; the actual inserted
-- reason value is kept as NULL so unblock UI works unchanged.

WITH
-- 1. Collect all distinct (calendar, date_start, date_end, reason) combinations
raw AS (
  SELECT DISTINCT
    ce.calendar_id,
    ebd.date_start::date       AS date_start,
    ebd.date_end::date         AS date_end,
    ebd.reason
  FROM experience_blocked_dates ebd
  JOIN calendar_experiences ce ON ce.experience_id = ebd.experience_id
),
-- 2. Look at the previous row's end date within the same (calendar, reason) group
ordered AS (
  SELECT *,
    LAG(date_end) OVER (
      PARTITION BY calendar_id, COALESCE(reason, '')
      ORDER BY date_start, date_end
    ) AS prev_end
  FROM raw
),
-- 3. Mark where a new non-overlapping segment starts
--    (gap = current start > previous end + 1 day)
group_starts AS (
  SELECT *,
    CASE
      WHEN prev_end IS NULL                          THEN 1
      WHEN date_start > prev_end + INTERVAL '1 day' THEN 1
      ELSE 0
    END AS is_new_group
  FROM ordered
),
-- 4. Cumulative sum → unique group number per (calendar, reason)
groups AS (
  SELECT *,
    SUM(is_new_group) OVER (
      PARTITION BY calendar_id, COALESCE(reason, '')
      ORDER BY date_start, date_end
    ) AS grp
  FROM group_starts
)
-- 5. Insert one merged row per group
INSERT INTO calendar_blocked_dates (calendar_id, date_start, date_end, reason)
SELECT
  calendar_id,
  MIN(date_start),
  MAX(date_end),
  reason          -- NULL or 'booking:<id>' — kept as-is
FROM groups
GROUP BY calendar_id, COALESCE(reason, ''), grp, reason
ON CONFLICT DO NOTHING;

-- ─── 4. Clear experience_blocked_dates ────────────────────────────────────────
--
-- All rows have been migrated to calendar_blocked_dates above.
-- The table is kept (not DROPped) so legacy code paths don't break immediately.
-- A future migration will DROP it once all code is calendar-only.

DELETE FROM experience_blocked_dates;
