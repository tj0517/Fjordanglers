-- Make price_per_person_eur nullable so "on request" (icelandic) experiences
-- can store NULL instead of a meaningless sentinel value.
-- When booking_type = 'icelandic' the price is determined by the guide per inquiry.

ALTER TABLE experiences
  ALTER COLUMN price_per_person_eur DROP NOT NULL;

-- Drop the > 0 check constraint so NULL (and 0 if needed) are accepted.
ALTER TABLE experiences
  DROP CONSTRAINT IF EXISTS experiences_price_per_person_eur_check;
