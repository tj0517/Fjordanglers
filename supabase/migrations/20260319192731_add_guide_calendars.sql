-- Guide Calendars — named groups of experiences for multi-calendar management.
--
-- A guide (or agency) can create multiple named calendars and assign any
-- subset of their experiences to each. One experience can belong to many calendars.
--
-- Tables:
--   guide_calendars        — one row per named calendar (owned by a guide)
--   calendar_experiences   — junction: which experiences belong to which calendar

-- ─── guide_calendars ──────────────────────────────────────────────────────────

CREATE TABLE public.guide_calendars (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id   uuid        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_calendars_guide ON public.guide_calendars (guide_id);

ALTER TABLE public.guide_calendars ENABLE ROW LEVEL SECURITY;

-- Guide: full CRUD on own calendars
CREATE POLICY "guide_calendars_own"
  ON public.guide_calendars
  USING  (guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid()))
  WITH CHECK (guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid()));

-- Admin: read all
CREATE POLICY "guide_calendars_admin_read"
  ON public.guide_calendars FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ─── calendar_experiences ──────────────────────────────────────────────────────

CREATE TABLE public.calendar_experiences (
  calendar_id   uuid NOT NULL REFERENCES public.guide_calendars(id) ON DELETE CASCADE,
  experience_id uuid NOT NULL REFERENCES public.experiences(id)     ON DELETE CASCADE,
  PRIMARY KEY (calendar_id, experience_id)
);

CREATE INDEX idx_calendar_experiences_cal ON public.calendar_experiences (calendar_id);
CREATE INDEX idx_calendar_experiences_exp ON public.calendar_experiences (experience_id);

ALTER TABLE public.calendar_experiences ENABLE ROW LEVEL SECURITY;

-- Guide: manage junction rows for their own calendars
CREATE POLICY "calendar_experiences_own"
  ON public.calendar_experiences
  USING (
    calendar_id IN (
      SELECT id FROM guide_calendars
      WHERE guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    calendar_id IN (
      SELECT id FROM guide_calendars
      WHERE guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid())
    )
  );
