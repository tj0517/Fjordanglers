-- guide_weekly_schedules
-- Recurring weekday availability patterns for guides who guide only on specific days of the week.
-- Example: a guide who only guides on Sat/Sun can set Mon-Fri blocked for the whole summer.
--
-- blocked_weekdays: integer[] where 0 = Monday … 6 = Sunday (ISO weekday - 1).

CREATE TABLE guide_weekly_schedules (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id         uuid NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  label            text,                              -- optional human-readable name
  period_from      date NOT NULL,
  period_to        date NOT NULL,
  blocked_weekdays integer[] NOT NULL DEFAULT '{}',  -- e.g. {0,1,2,3,4} = Mon–Fri
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_period       CHECK (period_to >= period_from),
  CONSTRAINT chk_wd_nonempty  CHECK (array_length(blocked_weekdays, 1) > 0)
);

CREATE INDEX guide_weekly_schedules_guide_id_idx ON guide_weekly_schedules(guide_id);

-- Row Level Security
ALTER TABLE guide_weekly_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guides manage their own weekly schedules"
  ON guide_weekly_schedules
  FOR ALL
  USING (
    guide_id IN (
      SELECT id FROM guides WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    guide_id IN (
      SELECT id FROM guides WHERE user_id = auth.uid()
    )
  );
