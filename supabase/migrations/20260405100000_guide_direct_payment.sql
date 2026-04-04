-- Guide direct payment columns
--
-- New two-step payment model:
--   Step 1: Angler pays booking fee (commission + service fee) → platform
--   Step 2: Angler pays guide amount directly
--           Model A: via Stripe Connect (guide_stripe_checkout_id)
--           Model B: via IBAN bank transfer (guide shares IBAN → iban_shared_at)
--           Model C: arrange directly (no tracking)
--
-- These columns coexist with the old balance_* columns — existing bookings keep
-- their old semantics (40% deposit + 60% balance via platform Connect).
-- New bookings from 2026-04-05 onwards use the new booking_fee / guide_amount model.

ALTER TABLE bookings
  -- Stripe Checkout session for guide's portion (Model A — Stripe Connect guide)
  ADD COLUMN IF NOT EXISTS guide_stripe_checkout_id TEXT,

  -- When angler completed the guide amount payment
  ADD COLUMN IF NOT EXISTS guide_amount_paid_at TIMESTAMPTZ,

  -- Stripe PaymentIntent from the guide amount checkout session
  ADD COLUMN IF NOT EXISTS guide_amount_stripe_pi_id TEXT,

  -- When guide shared their IBAN/QR code with the angler (Model B — IBAN guide)
  -- NULL = not yet shared; NOT NULL = angler can see IBAN + SEPA QR on their page
  ADD COLUMN IF NOT EXISTS iban_shared_at TIMESTAMPTZ;
