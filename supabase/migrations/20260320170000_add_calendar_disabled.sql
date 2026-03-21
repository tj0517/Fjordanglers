-- Add calendar_disabled flag to guides.
-- When true, the guide's trip pages show inquiry-only booking (no date picker, no instant checkout).
-- Intended for guides whose listings are all 'icelandic' (price on request) — they don't need
-- the availability calendar at all.

ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS calendar_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.guides.calendar_disabled IS
  'When true, trip pages show inquiry-only CTA regardless of experience booking_type.';
