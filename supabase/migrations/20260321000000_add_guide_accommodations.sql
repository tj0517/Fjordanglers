-- Migration: Add Guide Accommodations catalog
-- Creates guide_accommodations (guide-owned records) and
-- experience_accommodations (junction linking experiences to accommodations).
-- Uses IF NOT EXISTS guards so re-running is safe.

-- ── 1. guide_accommodations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_accommodations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id      uuid        NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  type          text        NOT NULL CHECK (type IN ('cabin','hotel','hostel','lodge','apartment','other')),
  description   text,
  max_guests    integer,
  location_note text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. experience_accommodations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experience_accommodations (
  experience_id    uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  accommodation_id uuid NOT NULL REFERENCES guide_accommodations(id) ON DELETE CASCADE,
  PRIMARY KEY (experience_id, accommodation_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS guide_accommodations_guide_id_idx      ON guide_accommodations (guide_id);
CREATE INDEX IF NOT EXISTS experience_accommodations_acc_id_idx   ON experience_accommodations (accommodation_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE guide_accommodations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_accommodations ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating so re-runs are idempotent
DROP POLICY IF EXISTS "Public read guide_accommodations"             ON guide_accommodations;
DROP POLICY IF EXISTS "Public read experience_accommodations"        ON experience_accommodations;
DROP POLICY IF EXISTS "Guides manage own accommodations"             ON guide_accommodations;
DROP POLICY IF EXISTS "Guides manage own experience_accommodations"  ON experience_accommodations;
DROP POLICY IF EXISTS "Admins manage all guide_accommodations"       ON guide_accommodations;
DROP POLICY IF EXISTS "Admins manage all experience_accommodations"  ON experience_accommodations;

-- Public SELECT (needed for trip detail page rendered by anon users)
CREATE POLICY "Public read guide_accommodations"
  ON guide_accommodations FOR SELECT
  USING (true);

CREATE POLICY "Public read experience_accommodations"
  ON experience_accommodations FOR SELECT
  USING (true);

-- Guides manage their own accommodation records
CREATE POLICY "Guides manage own accommodations"
  ON guide_accommodations FOR ALL
  USING (
    guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid())
  )
  WITH CHECK (
    guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid())
  );

-- Guides manage junction rows for their own experiences
CREATE POLICY "Guides manage own experience_accommodations"
  ON experience_accommodations FOR ALL
  USING (
    experience_id IN (
      SELECT e.id FROM experiences e
      JOIN guides g ON g.id = e.guide_id
      WHERE g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    experience_id IN (
      SELECT e.id FROM experiences e
      JOIN guides g ON g.id = e.guide_id
      WHERE g.user_id = auth.uid()
    )
  );

-- Admins manage all
CREATE POLICY "Admins manage all guide_accommodations"
  ON guide_accommodations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage all experience_accommodations"
  ON experience_accommodations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
