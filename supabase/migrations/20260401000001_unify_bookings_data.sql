-- ============================================================
-- Migration part 2/2: Unify trip_inquiries + bookings into one table
-- 2026-04-01
--
-- DEPENDS ON: 20260401000000_unify_bookings.sql
-- (which commits the new booking_status enum values: reviewing,
--  offer_sent, offer_accepted — required before this file runs)
--
-- Problem: Two separate tables (trip_inquiries + bookings) plus
--   two message tables (inquiry_messages + booking_messages)
--   created a fragmented schema where one "booking" could span
--   multiple rows across multiple tables.
--
-- Solution: One bookings table with a `source` column ('direct' | 'inquiry')
--   covering all flows. booking_messages handles all chat.
--
-- Safe: additive columns + data migration + DROP at the end.
-- ============================================================


-- ── 1. Make guide_id nullable ─────────────────────────────────────────────────
--
-- Inquiry bookings start without an assigned guide (the angler
-- submits a request before a guide responds). Guide is assigned
-- when sendOffer() is called.

ALTER TABLE bookings ALTER COLUMN guide_id DROP NOT NULL;


-- ── 2. Add source column + inquiry-specific columns ───────────────────────────

ALTER TABLE bookings
  -- Origin of the booking
  ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'direct'
    CHECK (source IN ('direct', 'inquiry')),

  -- End date for inquiry date ranges (direct bookings: null)
  ADD COLUMN IF NOT EXISTS date_to              date,

  -- Angler request data (inquiry source only)
  ADD COLUMN IF NOT EXISTS target_species       text[],
  ADD COLUMN IF NOT EXISTS experience_level     text,
  ADD COLUMN IF NOT EXISTS preferences          jsonb,
  ADD COLUMN IF NOT EXISTS assigned_river       text,

  -- Offer fields (populated when guide calls sendOffer())
  ADD COLUMN IF NOT EXISTS offer_price_eur      numeric(10,2),
  ADD COLUMN IF NOT EXISTS offer_price_min_eur  numeric(10,2),
  ADD COLUMN IF NOT EXISTS offer_price_tiers    jsonb,
  ADD COLUMN IF NOT EXISTS offer_details        text,
  ADD COLUMN IF NOT EXISTS offer_date_from      date,
  ADD COLUMN IF NOT EXISTS offer_date_to        date,
  ADD COLUMN IF NOT EXISTS offer_days           text[],
  ADD COLUMN IF NOT EXISTS offer_meeting_lat    float8,
  ADD COLUMN IF NOT EXISTS offer_meeting_lng    float8,

  -- Confirmed trip dates (populated when guide confirms exact days)
  ADD COLUMN IF NOT EXISTS confirmed_days       text[],
  ADD COLUMN IF NOT EXISTS confirmed_date_from  date,
  ADD COLUMN IF NOT EXISTS confirmed_date_to    date;


-- ── 3. Add sender_role to booking_messages ────────────────────────────────────
--
-- inquiry_messages had a sender_role field ('angler'|'guide'|'admin').
-- booking_messages didn't. Adding it as nullable for backward compat —
-- old direct-booking messages will have sender_role = NULL.

ALTER TABLE booking_messages
  ADD COLUMN IF NOT EXISTS sender_role text
    CHECK (sender_role IS NULL OR sender_role IN ('angler', 'guide', 'admin'));


-- ── 4a. Enrich existing inquiry-derived bookings ──────────────────────────────
--
-- Some trip_inquiries already produced a bookings row (via
-- createBookingFromInquiry on payment). These have inquiry_id set.
-- Copy the inquiry-specific fields into those booking rows.

UPDATE bookings b
SET
  source               = 'inquiry',
  date_to              = ti.dates_to::date,
  target_species       = ti.target_species,
  experience_level     = ti.experience_level,
  preferences          = ti.preferences,
  assigned_river       = ti.assigned_river,
  offer_price_eur      = ti.offer_price_eur,
  offer_price_min_eur  = ti.offer_price_min_eur,
  offer_price_tiers    = ti.offer_price_tiers,
  offer_details        = ti.offer_details,
  offer_date_from      = ti.offer_date_from::date,
  offer_date_to        = ti.offer_date_to::date,
  offer_days           = ti.offer_days,
  offer_meeting_lat    = ti.offer_meeting_lat,
  offer_meeting_lng    = ti.offer_meeting_lng
FROM trip_inquiries ti
WHERE b.inquiry_id = ti.id;


-- ── 4b. Insert booking rows for unconfirmed inquiries ─────────────────────────
--
-- trip_inquiries that never reached payment (pending/reviewing/offer_sent/
-- offer_accepted) don't have a bookings row yet. Create one.
--
-- We preserve the inquiry UUID as the booking UUID (id = ti.id) so that
-- existing URLs (/account/trips/[id], /dashboard/inquiries/[id]) keep
-- working without redirects.
--
-- inquiry_id is set temporarily to the inquiry's own id so step 5
-- (message migration) can join on it. It will be dropped in step 7.

INSERT INTO bookings (
  id,
  source,
  guide_id,
  angler_id,
  angler_email,
  angler_full_name,
  booking_date,
  date_to,
  guests,
  status,
  total_eur,
  platform_fee_eur,
  guide_payout_eur,
  commission_rate,
  target_species,
  experience_level,
  preferences,
  assigned_river,
  offer_price_eur,
  offer_price_min_eur,
  offer_price_tiers,
  offer_details,
  offer_date_from,
  offer_date_to,
  offer_days,
  offer_meeting_lat,
  offer_meeting_lng,
  stripe_checkout_id,
  stripe_payment_intent_id,
  inquiry_id,
  created_at,
  updated_at
)
SELECT
  ti.id,
  'inquiry',
  ti.assigned_guide_id,
  ti.angler_id,
  ti.angler_email,
  ti.angler_name,
  ti.dates_from::date,
  ti.dates_to::date,
  ti.group_size,
  CASE ti.status
    WHEN 'inquiry'        THEN 'pending'::booking_status
    WHEN 'reviewing'      THEN 'reviewing'::booking_status
    WHEN 'offer_sent'     THEN 'offer_sent'::booking_status
    WHEN 'offer_accepted' THEN 'offer_accepted'::booking_status
    WHEN 'confirmed'      THEN 'confirmed'::booking_status
    WHEN 'completed'      THEN 'completed'::booking_status
    WHEN 'cancelled'      THEN 'cancelled'::booking_status
    ELSE                       'pending'::booking_status
  END,
  COALESCE(ti.offer_price_eur, 0),
  0,
  0,
  0.10,
  ti.target_species,
  ti.experience_level,
  ti.preferences,
  ti.assigned_river,
  ti.offer_price_eur,
  ti.offer_price_min_eur,
  ti.offer_price_tiers,
  ti.offer_details,
  ti.offer_date_from::date,
  ti.offer_date_to::date,
  ti.offer_days,
  ti.offer_meeting_lat,
  ti.offer_meeting_lng,
  ti.stripe_checkout_id,
  ti.stripe_payment_intent_id,
  ti.id,
  ti.created_at,
  ti.updated_at
FROM trip_inquiries ti
WHERE NOT EXISTS (
  SELECT 1 FROM bookings b WHERE b.inquiry_id = ti.id
);


-- ── 5. Migrate inquiry_messages → booking_messages ───────────────────────────
--
-- Both steps 4a and 4b guarantee every trip_inquiry has a bookings row
-- with inquiry_id set. Use that to join messages.
-- Idempotency: skip messages that already exist in booking_messages.

INSERT INTO booking_messages (booking_id, sender_id, sender_role, body, created_at, read_at)
SELECT
  b.id,
  im.sender_id,
  im.sender_role,
  im.body,
  im.created_at,
  im.read_at
FROM inquiry_messages im
JOIN bookings b ON b.inquiry_id = im.inquiry_id
WHERE NOT EXISTS (
  SELECT 1 FROM booking_messages bm
  WHERE bm.booking_id = b.id
    AND bm.sender_id  = im.sender_id
    AND bm.created_at = im.created_at
    AND bm.body       = im.body
);


-- ── 6. Drop old tables ────────────────────────────────────────────────────────
--
-- inquiry_messages has ON DELETE CASCADE from trip_inquiries.
-- Drop it explicitly first (already migrated), then trip_inquiries.

DROP TABLE IF EXISTS inquiry_messages;
-- CASCADE drops the bookings_inquiry_id_fkey FK constraint automatically
-- (inquiry_id column is dropped explicitly in step 7 anyway)
DROP TABLE IF EXISTS trip_inquiries CASCADE;


-- ── 7. Drop inquiry_id column ─────────────────────────────────────────────────
-- Temporary reference used during migration; foreign table is gone now.

ALTER TABLE bookings DROP COLUMN IF EXISTS inquiry_id;


-- ── 8. Remove old indexes (dead — tables dropped) ────────────────────────────

DROP INDEX IF EXISTS idx_trip_inquiries_assigned_guide_id;
DROP INDEX IF EXISTS idx_trip_inquiries_angler_id;
DROP INDEX IF EXISTS idx_trip_inquiries_status;
DROP INDEX IF EXISTS idx_trip_inquiries_stripe_payment_intent_id;
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_id;
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_created;


-- ── 9. New indexes for unified table ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_source
  ON bookings(source);

-- Guide dashboard — inquiry requests view (pending + reviewing)
CREATE INDEX IF NOT EXISTS idx_bookings_guide_source_status
  ON bookings(guide_id, source, status)
  WHERE guide_id IS NOT NULL;

-- Angler account — "my requests" (source=inquiry, angler_id)
CREATE INDEX IF NOT EXISTS idx_bookings_angler_source
  ON bookings(angler_id, source)
  WHERE angler_id IS NOT NULL;

-- Chat messages — read by sender role
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_role
  ON booking_messages(booking_id, sender_role)
  WHERE sender_role IS NOT NULL;
