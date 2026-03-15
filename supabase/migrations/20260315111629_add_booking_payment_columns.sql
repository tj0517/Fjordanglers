-- Migration: 20260315111629_add_booking_payment_columns.sql
-- Description: Adds Stripe payment columns, deposit tracking, duration option,
--              and accept/decline workflow timestamps to the bookings table.
--              These columns are required for the classic booking checkout flow
--              (Wave 4B): Stripe Connect payments, partial deposit (30%), guide
--              accept/decline actions.
-- Affected tables: bookings

BEGIN;

-- ─── COLUMNS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings

  -- Deposit amount (30% of total_eur charged at booking time via Stripe).
  -- NULL until Stripe Checkout is created.
  ADD COLUMN IF NOT EXISTS deposit_eur              NUMERIC(10,2),

  -- Platform commission rate at time of booking.
  -- DEFAULT 0.10 (10%) for standard guides, 0.08 (8%) for Founding Guides.
  -- Stored on the booking row so rate changes don't affect historical payouts.
  ADD COLUMN IF NOT EXISTS commission_rate          NUMERIC(4,3) NOT NULL DEFAULT 0.10,

  -- Stripe Checkout session ID (cs_live_xxx / cs_test_xxx).
  -- Set when checkout session is created; used to correlate webhook events.
  ADD COLUMN IF NOT EXISTS stripe_checkout_id       TEXT,

  -- Stripe PaymentIntent ID (pi_xxx).
  -- Populated via webhook after checkout.session.completed.
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,

  -- Stripe Transfer ID (tr_xxx) for Connect payout to guide.
  -- Populated when guide payout is triggered (after trip completion).
  ADD COLUMN IF NOT EXISTS stripe_transfer_id       TEXT,

  -- Label of the duration option selected by angler at booking time.
  -- e.g. "Half day", "Full day", "2-day package".
  -- Free-text reference to experiences.duration_options[].label.
  ADD COLUMN IF NOT EXISTS duration_option          TEXT,

  -- Guide accept/decline workflow timestamps.
  -- accepted_at: set when guide calls acceptBooking().
  -- declined_at + declined_reason: set when guide calls declineBooking().
  ADD COLUMN IF NOT EXISTS accepted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_reason          TEXT;

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Webhook lookup: find booking by Stripe checkout session ID.
-- Used in /api/stripe/webhook for checkout.session.completed events.
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_checkout_id
  ON public.bookings (stripe_checkout_id)
  WHERE stripe_checkout_id IS NOT NULL;

-- Webhook lookup: find booking by Stripe payment intent.
-- Used in /api/stripe/webhook for charge.refunded events.
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Guide dashboard: filter bookings by status quickly.
-- Query: WHERE guide_id = $1 AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_bookings_guide_status
  ON public.bookings (guide_id, status);

-- Angler history page: all bookings for a user, newest first.
CREATE INDEX IF NOT EXISTS idx_bookings_angler_created
  ON public.bookings (angler_id, created_at DESC);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- RLS is already ENABLED on public.bookings (established in initial schema).
-- New columns are automatically covered by existing row-level policies.
-- No additional policies required.

COMMIT;
