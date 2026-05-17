-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: experience_pages_v3
-- Adds what_to_bring (pill list) and special_attractions (multi-item JSONB).
--
-- special_attractions replaces the single special_attraction_text /
-- special_attraction_image_url pair. Old columns are kept for backward compat
-- but the application now reads/writes special_attractions exclusively.
--
-- special_attractions structure:
--   [{ "text": "...", "image_url": "..." }, ...]
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE experience_pages
  ADD COLUMN IF NOT EXISTS what_to_bring      TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS special_attractions JSONB   NOT NULL DEFAULT '[]';
