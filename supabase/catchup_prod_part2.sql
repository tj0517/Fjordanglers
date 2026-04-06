-- =============================================================================
-- CATCHUP_PROD_PART2.SQL  ·  CZĘŚĆ 2 z 2
--
-- WYMAGANIE: Uruchom dopiero PO zatwierdzeniu catchup_prod.sql (część 1).
-- Powód: ALTER TYPE ADD VALUE z części 1 musi być commitowane zanim
-- nowe wartości enum ('reviewing', 'offer_sent', 'offer_accepted') mogą
-- być użyte w INSERT/UPDATE poniżej (PostgreSQL error 55P04).
-- =============================================================================


-- =============================================================================
-- §17b · 20260401000001 · Additive kolumny na bookings
-- =============================================================================

ALTER TABLE bookings ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'direct'
    CHECK (source IN ('direct', 'inquiry')),
  ADD COLUMN IF NOT EXISTS date_to              date,
  ADD COLUMN IF NOT EXISTS target_species       text[],
  ADD COLUMN IF NOT EXISTS experience_level     text,
  ADD COLUMN IF NOT EXISTS preferences          jsonb,
  ADD COLUMN IF NOT EXISTS assigned_river       text,
  ADD COLUMN IF NOT EXISTS offer_price_eur      numeric(10,2),
  ADD COLUMN IF NOT EXISTS offer_price_min_eur  numeric(10,2),
  ADD COLUMN IF NOT EXISTS offer_price_tiers    jsonb,
  ADD COLUMN IF NOT EXISTS offer_details        text,
  ADD COLUMN IF NOT EXISTS offer_date_from      date,
  ADD COLUMN IF NOT EXISTS offer_date_to        date,
  ADD COLUMN IF NOT EXISTS offer_days           text[],
  ADD COLUMN IF NOT EXISTS offer_meeting_lat    float8,
  ADD COLUMN IF NOT EXISTS offer_meeting_lng    float8,
  ADD COLUMN IF NOT EXISTS confirmed_days       text[],
  ADD COLUMN IF NOT EXISTS confirmed_date_from  date,
  ADD COLUMN IF NOT EXISTS confirmed_date_to    date;

ALTER TABLE booking_messages
  ADD COLUMN IF NOT EXISTS sender_role text
    CHECK (sender_role IS NULL OR sender_role IN ('angler', 'guide', 'admin'));


-- =============================================================================
-- §17c · Migracja danych z trip_inquiries (tylko jeśli tabela istnieje)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trip_inquiries'
  ) THEN

    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inquiry_id uuid;

    -- Enrichuj istniejące booking rows z inquiry data
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

    -- Wstaw booking rows dla inquiries bez booking row
    -- Nowe enum wartości ('reviewing', 'offer_sent', 'offer_accepted') są teraz
    -- dostępne bo catchup_prod.sql (część 1) został już zacommitowany.
    INSERT INTO bookings (
      id, source, guide_id, angler_id, angler_email, angler_full_name,
      booking_date, date_to, guests, status, total_eur, platform_fee_eur,
      guide_payout_eur, commission_rate, target_species, experience_level,
      preferences, assigned_river, offer_price_eur, offer_price_min_eur,
      offer_price_tiers, offer_details, offer_date_from, offer_date_to,
      offer_days, offer_meeting_lat, offer_meeting_lng,
      stripe_checkout_id, stripe_payment_intent_id, inquiry_id,
      created_at, updated_at
    )
    SELECT
      ti.id, 'inquiry', ti.assigned_guide_id, ti.angler_id, ti.angler_email,
      ti.angler_name, ti.dates_from::date, ti.dates_to::date, ti.group_size,
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
      COALESCE(ti.offer_price_eur, 0), 0, 0, 0.10,
      ti.target_species, ti.experience_level, ti.preferences, ti.assigned_river,
      ti.offer_price_eur, ti.offer_price_min_eur, ti.offer_price_tiers,
      ti.offer_details, ti.offer_date_from::date, ti.offer_date_to::date,
      ti.offer_days, ti.offer_meeting_lat, ti.offer_meeting_lng,
      ti.stripe_checkout_id, ti.stripe_payment_intent_id, ti.id,
      ti.created_at, ti.updated_at
    FROM trip_inquiries ti
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b WHERE b.inquiry_id = ti.id
    );

    -- Migruj inquiry_messages → booking_messages
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'inquiry_messages'
    ) THEN
      INSERT INTO booking_messages (booking_id, sender_id, sender_role, body, created_at, read_at)
      SELECT b.id, im.sender_id, im.sender_role, im.body, im.created_at, im.read_at
      FROM inquiry_messages im
      JOIN bookings b ON b.inquiry_id = im.inquiry_id
      WHERE NOT EXISTS (
        SELECT 1 FROM booking_messages bm
        WHERE bm.booking_id = b.id
          AND bm.sender_id  = im.sender_id
          AND bm.created_at = im.created_at
          AND bm.body       = im.body
      );

      DROP TABLE IF EXISTS inquiry_messages;
    END IF;

    DROP TABLE IF EXISTS trip_inquiries CASCADE;

    ALTER TABLE bookings DROP COLUMN IF EXISTS inquiry_id;

  END IF;
END $$;


-- =============================================================================
-- §17d · Stare indeksy (dead — tabele usunięte)
-- =============================================================================

DROP INDEX IF EXISTS idx_trip_inquiries_assigned_guide_id;
DROP INDEX IF EXISTS idx_trip_inquiries_angler_id;
DROP INDEX IF EXISTS idx_trip_inquiries_status;
DROP INDEX IF EXISTS idx_trip_inquiries_stripe_payment_intent_id;
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_id;
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_created;


-- =============================================================================
-- §17e · Nowe indeksy dla unified bookings
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_source
  ON bookings(source);

CREATE INDEX IF NOT EXISTS idx_bookings_guide_source_status
  ON bookings(guide_id, source, status)
  WHERE guide_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_angler_source
  ON bookings(angler_id, source)
  WHERE angler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_role
  ON booking_messages(booking_id, sender_role)
  WHERE sender_role IS NOT NULL;


-- =============================================================================
-- §18+19+20 · 20260401100000 + 20260402000000 + 20260402200000
--
-- Kolejność jest KRYTYCZNA:
--   1. Stwórz tabele (guide_calendars, calendar_experiences, calendar_blocked_dates)
--   2. Stwórz "Main Calendar" i przypisz experiences (§20)
--   3. Migruj bloki z experience_blocked_dates → calendar_blocked_dates (§19)
--   4. DOPIERO POTEM usuń z experience_blocked_dates (§18)
--
-- Cały blok jest idempotentny — bezpieczne do ponownego uruchomienia.
-- =============================================================================

-- ── 1. guide_calendars ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guide_calendars (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id   uuid        NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ── 2. calendar_experiences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_experiences (
  calendar_id   uuid NOT NULL REFERENCES guide_calendars(id) ON DELETE CASCADE,
  experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  PRIMARY KEY (calendar_id, experience_id)
);

-- ── 3. calendar_blocked_dates ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_blocked_dates (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_id uuid        NOT NULL REFERENCES guide_calendars(id) ON DELETE CASCADE,
  date_start  date        NOT NULL,
  date_end    date        NOT NULL,
  reason      text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT calendar_blocked_dates_date_order CHECK (date_end >= date_start)
);

CREATE INDEX IF NOT EXISTS idx_cbd_calendar_id
  ON calendar_blocked_dates(calendar_id);

CREATE INDEX IF NOT EXISTS idx_cbd_date_range
  ON calendar_blocked_dates(calendar_id, date_start, date_end);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cbd_booking
  ON calendar_blocked_dates(calendar_id, date_start, date_end, reason)
  WHERE reason IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cbd_manual
  ON calendar_blocked_dates(calendar_id, date_start, date_end)
  WHERE reason IS NULL;

ALTER TABLE calendar_blocked_dates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_blocked_dates'
      AND policyname = 'Public reads calendar blocked dates'
  ) THEN
    CREATE POLICY "Public reads calendar blocked dates"
      ON calendar_blocked_dates FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_blocked_dates'
      AND policyname = 'Guide manages own calendar blocks'
  ) THEN
    CREATE POLICY "Guide manages own calendar blocks"
      ON calendar_blocked_dates FOR ALL
      USING (
        calendar_id IN (
          SELECT gc.id FROM guide_calendars gc
          JOIN guides g ON g.id = gc.guide_id
          WHERE g.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 4. (§20) Stwórz "Main Calendar" dla guidów bez kalendarza ────────────────
--    MUSI być przed migracją bloków, żeby calendar_experiences nie był pusty.

INSERT INTO guide_calendars (guide_id, name)
SELECT DISTINCT e.guide_id, 'Main Calendar'
FROM experiences e
WHERE NOT EXISTS (
  SELECT 1 FROM guide_calendars gc WHERE gc.guide_id = e.guide_id
);

-- ── 5. (§20) Przypisz experiences bez kalendarza do najstarszego kalendarza ──

INSERT INTO calendar_experiences (calendar_id, experience_id)
SELECT cal.id, e.id
FROM experiences e
JOIN LATERAL (
  SELECT gc.id FROM guide_calendars gc
  WHERE gc.guide_id = e.guide_id
  ORDER BY gc.created_at
  LIMIT 1
) AS cal(id) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_experiences ce WHERE ce.experience_id = e.id
);

-- ── 6. (§19) Migruj bloki experience_blocked_dates → calendar_blocked_dates ──
--    Teraz calendar_experiences jest wypełniony → JOIN znajdzie wiersze.
--    Window-function merge scala nakładające się zakresy per calendar.

WITH
raw AS (
  SELECT DISTINCT
    ce.calendar_id,
    ebd.date_start::date AS date_start,
    ebd.date_end::date   AS date_end
  FROM experience_blocked_dates ebd
  JOIN calendar_experiences ce ON ce.experience_id = ebd.experience_id
),
ordered AS (
  SELECT *,
    LAG(date_end) OVER (PARTITION BY calendar_id ORDER BY date_start, date_end) AS prev_end
  FROM raw
),
group_starts AS (
  SELECT *,
    CASE
      WHEN prev_end IS NULL                          THEN 1
      WHEN date_start > prev_end + INTERVAL '1 day' THEN 1
      ELSE 0
    END AS is_new_group
  FROM ordered
),
groups AS (
  SELECT *,
    SUM(is_new_group) OVER (PARTITION BY calendar_id ORDER BY date_start, date_end) AS grp
  FROM group_starts
)
INSERT INTO calendar_blocked_dates (calendar_id, date_start, date_end)
SELECT calendar_id, MIN(date_start), MAX(date_end)
FROM groups
GROUP BY calendar_id, grp
ON CONFLICT DO NOTHING;

-- ── 7. (§18) TERAZ usuń z experience_blocked_dates dla calendared experiences ─
--    Bezpieczne: dane są już w calendar_blocked_dates.

DELETE FROM experience_blocked_dates
WHERE experience_id IN (
  SELECT experience_id FROM calendar_experiences
);


-- =============================================================================
-- §21 · 20260404000000 · backfill confirmed_days
-- =============================================================================

UPDATE bookings
SET
  confirmed_days      = ARRAY[booking_date::text],
  confirmed_date_from = booking_date,
  confirmed_date_to   = booking_date
WHERE status IN ('accepted', 'confirmed', 'completed')
  AND confirmed_days IS NULL
  AND booking_date IS NOT NULL
  AND source = 'direct';

UPDATE bookings
SET
  confirmed_days      = COALESCE(offer_days, ARRAY[offer_date_from::text]),
  confirmed_date_from = offer_date_from,
  confirmed_date_to   = offer_date_to
WHERE status IN ('offer_accepted', 'confirmed', 'completed')
  AND confirmed_days IS NULL
  AND offer_date_from IS NOT NULL
  AND source = 'inquiry';


-- =============================================================================
-- §22 · 20260404100000 · bookings.service_fee_eur
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_fee_eur numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.service_fee_eur IS
  'Service fee charged to angler (5% of guide trip subtotal, capped at €50). '
  'Added on top of the guide''s price to form total_eur. '
  'NEVER deducted from guide earnings.';

UPDATE bookings
SET service_fee_eur = CASE
  WHEN total_eur > 1050 THEN 50
  ELSE ROUND((total_eur / 1.05 * 0.05)::numeric, 2)
END
WHERE service_fee_eur = 0 AND total_eur > 0;


-- =============================================================================
-- §23 · 20260405100000 · guide direct payment columns
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guide_stripe_checkout_id  text,
  ADD COLUMN IF NOT EXISTS guide_amount_paid_at       timestamptz,
  ADD COLUMN IF NOT EXISTS guide_amount_stripe_pi_id  text,
  ADD COLUMN IF NOT EXISTS iban_shared_at             timestamptz;


-- =============================================================================
-- WERYFIKACJA KOŃCOWA
-- Uruchom diagnose_prod.sql — wszystko powinno być 'present' / 'correctly dropped'
-- =============================================================================
