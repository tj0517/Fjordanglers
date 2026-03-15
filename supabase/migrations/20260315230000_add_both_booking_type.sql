-- Allow 'both' as a valid booking_type so guides can offer
-- both direct Stripe payment and inquiry-based pricing on the same trip.

ALTER TABLE experiences
  DROP CONSTRAINT IF EXISTS experiences_booking_type_check;

ALTER TABLE experiences
  ADD CONSTRAINT experiences_booking_type_check
  CHECK (booking_type IN ('classic', 'icelandic', 'both'));
