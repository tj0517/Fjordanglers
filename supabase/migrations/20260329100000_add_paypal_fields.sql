-- PayPal Commerce Platform support
-- Adds payment_provider column to guides and PayPal tracking columns to
-- bookings and trip_inquiries.

-- guides
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS payment_provider         text NOT NULL DEFAULT 'stripe'
    CHECK (payment_provider IN ('stripe', 'paypal')),
  ADD COLUMN IF NOT EXISTS paypal_merchant_id       text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paypal_onboarding_status text DEFAULT NULL
    CHECK (paypal_onboarding_status IN ('pending', 'active', 'suspended') OR paypal_onboarding_status IS NULL),
  ADD COLUMN IF NOT EXISTS paypal_email             text DEFAULT NULL;

-- bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paypal_order_id               text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paypal_capture_id             text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS balance_paypal_order_id       text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS balance_paypal_capture_id     text DEFAULT NULL;

-- trip_inquiries
ALTER TABLE trip_inquiries
  ADD COLUMN IF NOT EXISTS paypal_order_id   text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS guides_paypal_merchant_id_idx
  ON guides (paypal_merchant_id) WHERE paypal_merchant_id IS NOT NULL;
