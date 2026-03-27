-- Add optional price-ladder column to trip_inquiries.
--
-- Stored as JSON array: [{ "anglers": 1, "priceEur": 800 }, ...]
-- sorted ascending by anglers.  The last entry covers all higher group sizes.
-- When present, offer_price_eur is automatically derived (guide's group_size tier).

ALTER TABLE trip_inquiries
  ADD COLUMN IF NOT EXISTS offer_price_tiers jsonb NULL;

COMMENT ON COLUMN trip_inquiries.offer_price_tiers IS
  'Optional price ladder for the offer. JSON array of {anglers: number, priceEur: number} '
  'sorted ascending. Last entry covers all higher group sizes.';
