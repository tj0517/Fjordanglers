-- Make price_per_person_eur nullable so "on request" (icelandic) experiences
-- can store NULL instead of a meaningless 0.
-- When booking_type = 'icelandic' the price is determined by the guide per inquiry.

ALTER TABLE experiences
  ALTER COLUMN price_per_person_eur DROP NOT NULL;
