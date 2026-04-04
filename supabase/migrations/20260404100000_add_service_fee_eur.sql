-- Migration: add service_fee_eur to bookings
--
-- Before this migration, the 5% service fee (capped at €50) was embedded silently
-- inside total_eur, with no way to retrieve it without a fragile reverse formula.
-- This column stores it explicitly so Stripe application_fee_amount can be set
-- correctly (= commission + service_fee, not commission alone).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_fee_eur numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.service_fee_eur IS
  'Service fee charged to angler (5% of guide trip subtotal, capped at €50). '
  'Added on top of the guide''s price to form total_eur. '
  'NEVER deducted from guide earnings.';

-- Backfill existing rows using the cap-aware reverse formula:
--   If total_eur > 1050 → subtotal > 1000 → fee was capped at €50
--   Otherwise           → fee was exactly 5% of subtotal → service_fee = total / 1.05 × 0.05
--
-- Rows with total_eur = 0 (inquiry bookings before offer was accepted) are skipped.

UPDATE bookings
SET service_fee_eur = CASE
  WHEN total_eur > 1050 THEN 50
  ELSE ROUND((total_eur / 1.05 * 0.05)::numeric, 2)
END
WHERE service_fee_eur = 0 AND total_eur > 0;
