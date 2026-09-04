-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add season_months + peak_months to experience_pages
--
-- Structured month data for the visual season calendar on /experiences/[slug].
-- Values are integers 1–12 (January = 1, December = 12).
--
-- season_months — months when the experience is available (open season)
-- peak_months   — best months for fishing (always a subset of season_months)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS season_months INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS peak_months   INTEGER[] NOT NULL DEFAULT '{}';
