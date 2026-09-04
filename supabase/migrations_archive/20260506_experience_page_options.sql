-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: experience_page_options
--
-- Adds per-variant trip options to experience_pages.
-- One experience_page can have N options (e.g. "Full Day", "Half Day").
-- Shared fields stay on experience_pages; per-option fields go here.
--
-- Species sharing: species_details JSONB stays on experience_pages as the
-- master library. Each option references species by name via target_species[].
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experience_page_options (
  id                        UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  experience_page_id        UUID         NOT NULL REFERENCES experience_pages(id) ON DELETE CASCADE,

  -- Display order in the accordion (0-indexed, lower = first)
  sort_order                INT          NOT NULL DEFAULT 0,

  -- Option label shown in accordion header, e.g. "Full Day Trip"
  label                     TEXT         NOT NULL DEFAULT '',

  -- Per-option pricing
  price_from                NUMERIC      NOT NULL DEFAULT 0,

  -- What you can catch (intro paragraph for this option)
  catches_text              TEXT,

  -- Names referencing entries in experience_pages.species_details library
  -- e.g. ["Pike", "Salmon"] — full details come from the page-level library
  target_species            TEXT[]       NOT NULL DEFAULT '{}',

  -- Boat (per-option — different options may use different boats)
  boat_description          TEXT,
  boat_image_url            TEXT,

  -- Special attractions [{text, image_url}] (per-option)
  special_attractions       JSONB        NOT NULL DEFAULT '[]',

  -- Meeting point / directions (per-option)
  meeting_point_name        TEXT,
  meeting_point_description TEXT,
  location_lat              NUMERIC,
  location_lng              NUMERIC,

  -- Packing list (per-option)
  what_to_bring             TEXT[]       NOT NULL DEFAULT '{}',

  -- Included / excluded items (per-option)
  includes                  TEXT[]       NOT NULL DEFAULT '{}',
  excludes                  TEXT[]       NOT NULL DEFAULT '{}',

  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS experience_page_options_page_id_idx
  ON experience_page_options (experience_page_id, sort_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE experience_page_options ENABLE ROW LEVEL SECURITY;

-- Public can read all options (filtering active pages is done in the app layer)
CREATE POLICY "Public reads experience page options"
  ON experience_page_options FOR SELECT
  USING (true);

-- Service role (used by admin server actions) bypasses RLS automatically

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_experience_page_options_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_experience_page_options_updated_at
  BEFORE UPDATE ON experience_page_options
  FOR EACH ROW
  EXECUTE FUNCTION update_experience_page_options_updated_at();
