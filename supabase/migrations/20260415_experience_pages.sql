-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: experience_pages
-- Creates the FA-curated editorial trip pages table.
--
-- These are NOT guide-managed trips — they are polished editorial pages that
-- FA creates after reviewing a guide_submission.  They power the public
-- /experiences/[slug] route.
--
-- Relation to other tables:
--   trip_id (optional) → experiences.id
--     When set: InquiryWidget is shown and the calendar is active.
--     When null: "Contact FjordAnglers" fallback CTA is shown.
--   guide_id (optional) → guides.id (denormalised for admin convenience)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experience_pages (
  id                        UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Linked records (both optional — page can be standalone)
  trip_id                   UUID         REFERENCES experiences(id) ON DELETE SET NULL,
  guide_id                  UUID         REFERENCES guides(id)      ON DELETE SET NULL,

  -- Identity
  experience_name           TEXT         NOT NULL,
  slug                      TEXT         NOT NULL UNIQUE,
  country                   TEXT         NOT NULL,
  region                    TEXT         NOT NULL DEFAULT '',
  status                    TEXT         NOT NULL DEFAULT 'draft',   -- draft | active | archived

  -- Pricing & season
  price_from                NUMERIC      NOT NULL DEFAULT 0,
  currency                  TEXT         NOT NULL DEFAULT 'EUR',
  season_start              TEXT,
  season_end                TEXT,
  best_months               TEXT,

  -- Quick-fit attributes
  difficulty                TEXT,   -- Beginner | Intermediate | Advanced | Expert
  physical_effort           TEXT,   -- Low | Medium | High
  non_angler_friendly       BOOLEAN      NOT NULL DEFAULT false,
  technique                 TEXT[]       NOT NULL DEFAULT '{}',
  target_species            TEXT[]       NOT NULL DEFAULT '{}',
  environment               TEXT[]       NOT NULL DEFAULT '{}',

  -- Editorial content
  hero_image_url            TEXT,
  gallery_image_urls        TEXT[]       NOT NULL DEFAULT '{}',
  story_text                TEXT,
  catches_text              TEXT,
  rod_setup                 TEXT,

  -- Meeting point
  meeting_point_name        TEXT,
  meeting_point_description TEXT,

  -- What's included / excluded
  includes                  TEXT[]       NOT NULL DEFAULT '{}',
  excludes                  TEXT[]       NOT NULL DEFAULT '{}',

  -- SEO overrides (auto-generated from content when null)
  meta_title                TEXT,
  meta_description          TEXT,
  og_image_url              TEXT,

  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast lookup by slug (public page route)
CREATE UNIQUE INDEX IF NOT EXISTS experience_pages_slug_idx
  ON experience_pages (slug);

-- Filter by status (admin list, public route only fetches active)
CREATE INDEX IF NOT EXISTS experience_pages_status_idx
  ON experience_pages (status);

-- Filter by guide (admin guide detail view)
CREATE INDEX IF NOT EXISTS experience_pages_guide_id_idx
  ON experience_pages (guide_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- FA manages these via the service_role key — no angler/guide RLS needed.
-- Public read of active pages is handled in the application layer
-- (Server Component queries with anon key filtered to status = 'active').

ALTER TABLE experience_pages ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read active pages
CREATE POLICY "Public reads active experience pages"
  ON experience_pages FOR SELECT
  USING (status = 'active');

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_experience_pages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_experience_pages_updated_at
  BEFORE UPDATE ON experience_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_experience_pages_updated_at();
