-- =============================================================================
-- DIAGNOSE_PROD.SQL
-- Run this on PRODUCTION to see what is missing vs. preview.
-- Safe: read-only queries only. No side effects.
-- =============================================================================

-- ─── 1. ENUM VALUES ──────────────────────────────────────────────────────────
-- Expected: pending, accepted, declined, confirmed, completed, cancelled,
--           reviewing, offer_sent, offer_accepted

SELECT
  'booking_status enum' AS check_name,
  e.enumlabel           AS value,
  'present'             AS result
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'booking_status'

UNION ALL

SELECT
  'booking_status MISSING value',
  v.val,
  'MISSING'
FROM (VALUES
  ('pending'), ('accepted'), ('declined'), ('confirmed'),
  ('completed'), ('cancelled'), ('reviewing'), ('offer_sent'), ('offer_accepted')
) AS v(val)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_enum e2
  JOIN pg_type t2 ON t2.oid = e2.enumtypid
  WHERE t2.typname = 'booking_status' AND e2.enumlabel = v.val
)
ORDER BY 1, 2;


-- ─── 2. TABLES ───────────────────────────────────────────────────────────────

SELECT
  table_name,
  CASE WHEN table_name IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  ('bookings'),
  ('booking_messages'),
  ('audit_log'),
  ('calendar_blocked_dates'),
  ('guide_calendars'),
  ('calendar_experiences'),
  ('experiences'),
  ('guides'),
  ('experience_blocked_dates')
) AS t(table_name)
ORDER BY result DESC, table_name;


-- ─── 3. COLUMNS — bookings ───────────────────────────────────────────────────

SELECT
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = col
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  -- original
  ('id'), ('guide_id'), ('angler_id'), ('angler_email'), ('angler_full_name'),
  ('angler_phone'), ('angler_country'), ('booking_date'), ('guests'),
  ('status'), ('total_eur'), ('platform_fee_eur'), ('guide_payout_eur'),
  ('commission_rate'), ('deposit_eur'), ('experience_id'), ('special_requests'),
  ('stripe_checkout_id'), ('stripe_payment_intent_id'),
  ('created_at'), ('updated_at'),
  -- 20260322120000
  ('balance_payment_method'), ('balance_stripe_checkout_id'),
  ('balance_stripe_payment_intent_id'), ('balance_paid_at'),
  -- 20260325100000
  ('requested_dates'),
  -- 20260327000000 (drops: cancelled_at, cancelled_reason, stripe_transfer_id)
  -- 20260327100000
  ('marketing_consent'),
  -- 20260327110000
  ('payout_status'), ('payout_sent_at'),
  -- 20260401000001 (unify)
  ('source'), ('date_to'),
  ('target_species'), ('experience_level'), ('preferences'), ('assigned_river'),
  ('offer_price_eur'), ('offer_price_min_eur'), ('offer_price_tiers'),
  ('offer_details'), ('offer_date_from'), ('offer_date_to'),
  ('offer_days'), ('offer_meeting_lat'), ('offer_meeting_lng'),
  ('confirmed_days'), ('confirmed_date_from'), ('confirmed_date_to'),
  -- 20260404100000
  ('service_fee_eur'),
  -- 20260405100000
  ('guide_stripe_checkout_id'), ('guide_amount_paid_at'),
  ('guide_amount_stripe_pi_id'), ('iban_shared_at'),
  -- should NOT exist (dropped in 20260327000000)
  ('cancelled_at'), ('cancelled_reason'), ('stripe_transfer_id'),
  -- should NOT exist (dropped in 20260401000001)
  ('inquiry_id')
) AS t(col)
ORDER BY result DESC, col;


-- ─── 4. COLUMNS — guides ─────────────────────────────────────────────────────

SELECT
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides' AND column_name = col
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  -- 20260326100000
  ('accepted_payment_methods'),
  -- 20260327000000
  ('commission_rate'), ('founding_guide_until'),
  -- 20260327120000
  ('photo_marketing_consent'),
  -- 20260328200000
  ('is_hidden'),
  -- 20260330100000
  ('iban'), ('iban_holder_name'), ('iban_bic'), ('iban_bank_name'),
  -- 20260330200000
  ('terms_accepted_at'),
  -- 20260330300000 (generated)
  ('payment_ready')
) AS t(col)
ORDER BY result DESC, col;


-- ─── 5. COLUMNS — experiences ────────────────────────────────────────────────

SELECT
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = col
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  -- 20260328100000
  ('price_range_min_eur'), ('price_range_max_eur'),
  -- 20260322130000 (guide_accommodations)
  ('link_url')  -- only if joined against guide_accommodations
) AS t(col)
ORDER BY result DESC, col;


-- ─── 5b. COLUMNS — guide_accommodations ─────────────────────────────────────

SELECT
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guide_accommodations' AND column_name = col
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  ('link_url')  -- 20260322130000
) AS t(col);


-- ─── 6. COLUMNS — booking_messages ──────────────────────────────────────────

SELECT
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'booking_messages' AND column_name = col
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  ('sender_role')  -- added in 20260401000001
) AS t(col);


-- ─── 7. DROPPED TABLES (should NOT exist) ────────────────────────────────────

SELECT
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) THEN 'STILL_EXISTS (should have been dropped)' ELSE 'correctly dropped' END AS result
FROM (VALUES
  ('trip_inquiries'),
  ('inquiry_messages')
) AS t(table_name);


-- ─── 8. CONSTRAINT CHECK ─────────────────────────────────────────────────────

SELECT
  conname                                               AS constraint_name,
  'present'                                             AS result
FROM pg_constraint
WHERE conname = 'bookings_angler_identity'
  AND conrelid = 'bookings'::regclass

UNION ALL

SELECT 'bookings_angler_identity', 'MISSING'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'bookings_angler_identity'
    AND conrelid = 'bookings'::regclass
);


-- ─── 9. KEY INDEXES ──────────────────────────────────────────────────────────

SELECT
  idx,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = idx
  ) THEN 'present' ELSE 'MISSING' END AS result
FROM (VALUES
  ('idx_guides_user_id'),
  ('idx_guides_stripe_account_id'),
  ('idx_bookings_guide_id'),
  ('idx_bookings_angler_id'),
  ('idx_bookings_experience_id'),
  ('idx_bookings_status'),
  ('idx_bookings_stripe_payment_intent_id'),
  ('idx_booking_messages_booking_id'),
  ('idx_experiences_guide_id'),
  ('idx_experiences_guide_published'),
  ('idx_experience_blocked_dates_exp_dates'),
  ('idx_guide_weekly_schedules_guide_period'),
  ('guides_payment_ready_idx'),
  ('idx_bookings_source'),
  ('idx_bookings_guide_source_status'),
  ('idx_bookings_angler_source'),
  ('idx_booking_messages_booking_role'),
  ('idx_cbd_calendar_id'),
  ('idx_cbd_date_range'),
  ('uq_cbd_booking'),
  ('uq_cbd_manual')
) AS t(idx)
ORDER BY result DESC, idx;


-- ─── 10. SUMMARY ─────────────────────────────────────────────────────────────
-- Run all sections above, look for any row with result = 'MISSING'
-- and feed those to catchup_prod.sql.
