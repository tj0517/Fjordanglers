-- ─── Allow inquiry-derived bookings (no experience) ──────────────────────────
-- 1. Make experience_id nullable so bookings created from trip_inquiries
--    don't require a linked experience listing.
-- 2. Add inquiry_id FK for traceability and idempotency.

ALTER TABLE public.bookings
  ALTER COLUMN experience_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS inquiry_id UUID
    REFERENCES public.trip_inquiries(id)
    ON DELETE SET NULL;

-- Perf / uniqueness: at most one booking per inquiry
CREATE UNIQUE INDEX IF NOT EXISTS bookings_inquiry_id_unique_idx
  ON public.bookings (inquiry_id)
  WHERE inquiry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_inquiry_id_idx
  ON public.bookings (inquiry_id);
