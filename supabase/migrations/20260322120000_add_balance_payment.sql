-- Add balance payment tracking to guides and bookings
-- Guide sets default method (stripe / cash) in account settings.
-- Copied to bookings.balance_payment_method when guide accepts.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS default_balance_payment_method text NOT NULL DEFAULT 'cash'
    CHECK (default_balance_payment_method IN ('stripe', 'cash'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS balance_payment_method      text
    CHECK (balance_payment_method IN ('stripe', 'cash')),
  ADD COLUMN IF NOT EXISTS balance_paid_at             timestamptz,
  ADD COLUMN IF NOT EXISTS balance_stripe_checkout_id  text,
  ADD COLUMN IF NOT EXISTS balance_stripe_payment_intent_id text;
