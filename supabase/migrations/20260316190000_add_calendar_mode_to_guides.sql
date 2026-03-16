-- Migration: 20260316190000_add_calendar_mode_to_guides.sql
-- Description: Adds calendar_mode preference to guides table.
--
-- Guides can choose how their availability is managed:
--   'per_listing' (default) — each experience has its own independent calendar.
--                             Blocking a date on one trip does NOT affect others.
--   'shared'                — one unified calendar for all trips. Blocking a date
--                             blocks ALL the guide's experiences automatically.
--
-- The calendar_mode is a guide-level preference stored here so the booking
-- availability check can read it without loading all experience blocks.

BEGIN;

ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS calendar_mode TEXT NOT NULL DEFAULT 'per_listing'
    CONSTRAINT guides_calendar_mode_values
      CHECK (calendar_mode IN ('per_listing', 'shared'));

-- Index: used when filtering guides by calendar mode (e.g. admin views)
CREATE INDEX IF NOT EXISTS idx_guides_calendar_mode
  ON public.guides (calendar_mode);

-- RLS note: covered by the existing "Guide updates own profile" UPDATE policy.
-- No new policies required.

COMMIT;
