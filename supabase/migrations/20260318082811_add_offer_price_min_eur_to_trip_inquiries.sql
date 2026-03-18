-- Migration: 20260318082811_add_offer_price_min_eur_to_trip_inquiries.sql
-- Description: Adds nullable offer_price_min_eur column to trip_inquiries so that
--              guides can send a price range in personalised offers. The existing
--              offer_price_eur column represents the maximum / final price;
--              offer_price_min_eur represents the lower bound of that range.
-- Affected tables: public.trip_inquiries

BEGIN;

-- ─── SCHEMA CHANGE ────────────────────────────────────────────────────────────

ALTER TABLE public.trip_inquiries
  ADD COLUMN IF NOT EXISTS offer_price_min_eur NUMERIC;

-- No NOT NULL constraint — the column is intentionally nullable:
-- it is only populated when a guide chooses to send a price range.
-- A NULL value means a fixed price (offer_price_eur only) was provided.

COMMENT ON COLUMN public.trip_inquiries.offer_price_min_eur IS
  'Lower bound of a price-range offer (EUR). NULL = fixed price. '
  'Always <= offer_price_eur when set.';

COMMIT;
