-- Consolidate all guide calendars to one per guide, linked to all their experiences.
--
-- Steps:
--   1. Create a default calendar for guides that have none
--   2. Move all blocked dates to each guide's oldest (primary) calendar
--   3. Delete non-primary calendars (blocked dates foreign key cascades)
--   4. Rebuild calendar_experiences: link each guide's single calendar to all their experiences

-- ─── 1. Create default calendar for guides with no calendar ───────────────────
INSERT INTO guide_calendars (id, guide_id, name, created_at)
SELECT
  gen_random_uuid(),
  g.id,
  'My Calendar',
  now()
FROM guides g
WHERE NOT EXISTS (
  SELECT 1 FROM guide_calendars gc WHERE gc.guide_id = g.id
);

-- ─── 2. Re-point blocked dates to each guide's oldest calendar ────────────────
WITH primary_cals AS (
  SELECT DISTINCT ON (guide_id)
    id   AS primary_id,
    guide_id
  FROM guide_calendars
  ORDER BY guide_id, created_at ASC
)
UPDATE calendar_blocked_dates cbd
SET calendar_id = pc.primary_id
FROM guide_calendars gc
JOIN primary_cals pc ON gc.guide_id = pc.guide_id
WHERE cbd.calendar_id = gc.id
  AND gc.id <> pc.primary_id;

-- ─── 3. Delete non-primary calendars ─────────────────────────────────────────
-- calendar_experiences rows referencing these will cascade-delete (FK ON DELETE CASCADE)
DELETE FROM guide_calendars
WHERE id NOT IN (
  SELECT DISTINCT ON (guide_id) id
  FROM guide_calendars
  ORDER BY guide_id, created_at ASC
);

-- ─── 4. Rebuild calendar_experiences ─────────────────────────────────────────
-- Link each guide's single calendar to every experience they own.
DELETE FROM calendar_experiences;

INSERT INTO calendar_experiences (calendar_id, experience_id)
SELECT gc.id, e.id
FROM guide_calendars gc
JOIN experiences e ON e.guide_id = gc.guide_id;
