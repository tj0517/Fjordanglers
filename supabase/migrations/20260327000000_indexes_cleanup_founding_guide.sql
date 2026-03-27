-- ============================================================
-- Migration: Performance indexes, column cleanup, Founding Guide
-- 2026-03-27
--
-- SAFE: only additive changes + drops of columns verified unused
-- in the entire codebase (grep-confirmed, not referenced anywhere).
-- ============================================================


-- ============================================================
-- 1. INDEXES — hot query paths
-- ============================================================

-- guides.user_id: every authenticated guide action does this lookup
CREATE INDEX IF NOT EXISTS idx_guides_user_id
  ON guides(user_id);

-- guides.stripe_account_id: webhook account.updated lookup
CREATE INDEX IF NOT EXISTS idx_guides_stripe_account_id
  ON guides(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- bookings: dashboard + angler account queries
CREATE INDEX IF NOT EXISTS idx_bookings_guide_id
  ON bookings(guide_id);

CREATE INDEX IF NOT EXISTS idx_bookings_angler_id
  ON bookings(angler_id)
  WHERE angler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_experience_id
  ON bookings(experience_id)
  WHERE experience_id IS NOT NULL;

-- bookings.status: filtered in most list queries
CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status);

-- bookings.stripe_payment_intent_id: webhook charge.refunded lookup
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id
  ON bookings(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- trip_inquiries: guide dashboard + angler account
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_assigned_guide_id
  ON trip_inquiries(assigned_guide_id)
  WHERE assigned_guide_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_inquiries_angler_id
  ON trip_inquiries(angler_id)
  WHERE angler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_inquiries_status
  ON trip_inquiries(status);

-- trip_inquiries.stripe_payment_intent_id: webhook lookup
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_stripe_payment_intent_id
  ON trip_inquiries(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- booking_messages: chat thread load
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id
  ON booking_messages(booking_id);

-- inquiry_messages: chat thread load
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id
  ON inquiry_messages(inquiry_id);

-- experiences: guide's trip list + public listing queries
CREATE INDEX IF NOT EXISTS idx_experiences_guide_id
  ON experiences(guide_id);

-- experiences: public listing always filters published=true
CREATE INDEX IF NOT EXISTS idx_experiences_guide_published
  ON experiences(guide_id, published);

-- experience_blocked_dates: availability check (exp + date range)
CREATE INDEX IF NOT EXISTS idx_experience_blocked_dates_exp_dates
  ON experience_blocked_dates(experience_id, date_start, date_end);

-- guide_weekly_schedules: availability check (guide + period range)
CREATE INDEX IF NOT EXISTS idx_guide_weekly_schedules_guide_period
  ON guide_weekly_schedules(guide_id, period_from, period_to);


-- ============================================================
-- 2. COLUMN CLEANUP — verified unused via full codebase grep
-- ============================================================

-- bookings.cancelled_at / cancelled_reason:
--   Code uses declined_at / declined_reason (set in declineBooking()).
--   'cancelled' status is only set via charge.refunded webhook on trip_inquiries,
--   never on bookings. These two columns are not read or written anywhere.
--
-- bookings.stripe_transfer_id:
--   Payment data stored in stripe_payment_intent_id + stripe_checkout_id.
--   stripe_transfer_id is not referenced in any action, webhook, or UI file.

ALTER TABLE bookings
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_reason,
  DROP COLUMN IF EXISTS stripe_transfer_id;


-- ============================================================
-- 3. FOUNDING GUIDE — per-guide commission rate
-- ============================================================

-- Problem: PLATFORM_COMMISSION_RATE is a single global env var.
-- Founding Guides (first 50) get 8% for 24 months — this cannot
-- be tracked per-guide without a DB column.
--
-- Solution:
--   guides.commission_rate  — rate applied at booking creation
--                             default 0.10 (standard), set 0.08 for founders
--   guides.founding_guide_until — expiry date of reduced rate (nullable)
--                                 when NULL or past → use standard rate
--
-- Usage in code (after code update):
--   Replace env.PLATFORM_COMMISSION_RATE with guide.commission_rate
--   in createBookingCheckout() and acceptOffer().
--
-- NOTE: existing guides get DEFAULT 0.10. Admin sets 0.08 + expiry
--       manually for Founding Guides via admin panel.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS commission_rate    numeric(5,4) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS founding_guide_until date        DEFAULT NULL;


-- ============================================================
-- 4. INTEGRITY — angler identity constraint
--
-- A booking must have at least one angler identifier.
-- NOT VALID: skips check on existing rows (safe for existing data),
-- enforces for all new inserts/updates going forward.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_angler_identity'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_angler_identity
      CHECK (angler_id IS NOT NULL OR angler_email IS NOT NULL)
      NOT VALID;
  END IF;
END $$;
