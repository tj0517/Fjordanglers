-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: experience_pages_v2
-- Adds new columns to support the updated Experience Page layout (PDF spec).
--
-- New layout order:
--   PHOTO → INTRODUCE → QUICK FIT → ABOUT THIS EXPERIENCE → PHOTOS
--   → WHAT YOU CAN CATCH (per-fish alternating layout + per-fish season)
--   → ROD SETUP → BOAT | PHOTO → PHOTO | SPECIAL ATTRACTION
--   → LOCATION → WHAT'S INCLUDED → PRICE
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE experience_pages
  -- Brief intro paragraph shown after the title block, before Quick Fit
  ADD COLUMN IF NOT EXISTS intro_text                   TEXT,

  -- Per-fish details for the "What You Can Catch" section.
  -- Structure: [{ name, description, image_url, season_months, peak_months }]
  -- Falls back to simple target_species[] list when empty.
  ADD COLUMN IF NOT EXISTS species_details              JSONB        NOT NULL DEFAULT '[]',

  -- Boat section (two-column: description left, photo right)
  ADD COLUMN IF NOT EXISTS boat_description             TEXT,
  ADD COLUMN IF NOT EXISTS boat_image_url               TEXT,

  -- Special attraction section (two-column: photo left, text right)
  ADD COLUMN IF NOT EXISTS special_attraction_text      TEXT,
  ADD COLUMN IF NOT EXISTS special_attraction_image_url TEXT;
