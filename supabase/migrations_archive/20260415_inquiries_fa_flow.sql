-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_fa_flow
-- Creates the `inquiries` and `guide_submissions` tables for the new FA flow.
--
-- Context (FLOW.md):
--   NEW MODEL:
--   Angler → Send Inquiry → FA reviews → FA sends deposit link
--   Angler pays 30% deposit → FA's Stripe account
--   Angler pays 70% balance → guide directly (off-platform)
--
-- Run order (must run after experience_pages migration):
--   1. 20260415_experience_pages.sql
--   2. 20260415_guide_photos.sql
--   3. 20260415_inquiries_fa_flow.sql  ← this file
-- ─────────────────────────────────────────────────────────────────────────────

-- ── inquiries ─────────────────────────────────────────────────────────────────
-- One row per angler inquiry. Submitted via /api/inquiries (POST).
-- FA manages the full lifecycle from this table.

CREATE TABLE IF NOT EXISTS inquiries (
  id                        UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Linked experience (the editorial page the angler inquired from)
  trip_id                   UUID         NOT NULL REFERENCES experiences(id) ON DELETE RESTRICT,
  guide_id                  UUID         REFERENCES guides(id) ON DELETE SET NULL,  -- denormalised

  -- Angler details (no account required)
  angler_name               TEXT         NOT NULL,
  angler_email              TEXT         NOT NULL,
  angler_country            TEXT         NOT NULL,

  -- Request details
  requested_dates           TEXT[],                             -- YYYY-MM-DD strings
  party_size                INTEGER      NOT NULL DEFAULT 1,
  message                   TEXT,

  -- FA workflow state machine
  -- pending_fa_review → deposit_sent → deposit_paid → completed
  --                                                  → cancelled (any state)
  status                    TEXT         NOT NULL DEFAULT 'pending_fa_review'
                            CHECK (status IN (
                              'pending_fa_review',
                              'deposit_sent',
                              'deposit_paid',
                              'completed',
                              'cancelled'
                            )),

  -- FA internal fields
  fa_notes                  TEXT,
  deposit_amount            NUMERIC,       -- EUR amount, 30% of trip price
  deposit_stripe_session_id TEXT,          -- Stripe Checkout Session ID
  deposit_paid_at           TIMESTAMPTZ,  -- set by stripe-deposit webhook

  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- FA dashboard: list inquiries ordered by newest, filtered by status
CREATE INDEX IF NOT EXISTS inquiries_status_created_idx
  ON inquiries (status, created_at DESC);

-- Calendar overlay: check if a date is booked for a trip
CREATE INDEX IF NOT EXISTS inquiries_trip_id_idx
  ON inquiries (trip_id);

-- Angler: look up own inquiries by email (no login required)
CREATE INDEX IF NOT EXISTS inquiries_angler_email_idx
  ON inquiries (angler_email);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_inquiries_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Anglers can read their own inquiries (matched by email in JWT claim)
-- Used on /inquiry-confirmed and angler account pages
CREATE POLICY "Angler reads own inquiries"
  ON inquiries FOR SELECT
  USING (angler_email = auth.jwt() ->> 'email');

-- FA and server-side operations use the service_role key (bypasses RLS)


-- ── guide_submissions ─────────────────────────────────────────────────────────
-- Raw fishing spot info submitted by guides via /dashboard/trips/new.
-- FA reviews these and builds experience_pages from them.

CREATE TABLE IF NOT EXISTS guide_submissions (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id         UUID         NOT NULL REFERENCES guides(id) ON DELETE CASCADE,

  -- Location
  location_name    TEXT         NOT NULL,
  country          TEXT         NOT NULL,
  region           TEXT,

  -- Fishing details
  species          TEXT[]       NOT NULL DEFAULT '{}',
  fishing_methods  TEXT[]                DEFAULT '{}',
  season_months    INTEGER[]             DEFAULT '{}',

  -- Trip logistics
  trip_types       TEXT[]                DEFAULT '{}',   -- half_day | full_day | multi_day
  max_anglers      INTEGER,
  price_approx_eur NUMERIC,

  -- What's included
  includes         TEXT[]                DEFAULT '{}',
  includes_notes   TEXT,

  -- Guide's own words
  personal_note    TEXT,

  -- FA workflow
  -- submitted → in_progress → published | rejected
  status           TEXT         NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted', 'in_progress', 'published', 'rejected')),
  fa_notes         TEXT,

  -- Set when FA creates the experience_page from this submission
  experience_id    UUID         REFERENCES experience_pages(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS guide_submissions_guide_id_idx
  ON guide_submissions (guide_id);

CREATE INDEX IF NOT EXISTS guide_submissions_status_idx
  ON guide_submissions (status, created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_guide_submissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guide_submissions_updated_at
  BEFORE UPDATE ON guide_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_guide_submissions_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE guide_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guide reads own submissions"
  ON guide_submissions FOR SELECT
  USING (
    guide_id = (SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Guide inserts own submissions"
  ON guide_submissions FOR INSERT
  WITH CHECK (
    guide_id = (SELECT id FROM guides WHERE user_id = auth.uid() LIMIT 1)
  );
