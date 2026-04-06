-- =============================================================================
-- CATCHUP_PROD.SQL  ·  CZĘŚĆ 1 z 2
-- Bezpieczna migracja catch-up: dostosowuje produkcję do stanu preview.
--
-- ZASADY:
--   • Każda operacja jest idempotentna (IF NOT EXISTS / DO $$ IF NOT EXISTS $$)
--   • Istniejące dane nie są modyfikowane — tylko additive zmiany
--   • Backfill-e uruchamiają się tylko gdy kolumna istnieje i ma wartość DEFAULT
--   • Kolejność sekcji = kolejność chronologiczna migracji (od 2026-03-22)
--
-- INSTRUKCJA:
--   KROK 1: Uruchom catchup_prod.sql (ten plik) — zatwierdź transakcję
--   KROK 2: Uruchom catchup_prod_part2.sql — w osobnej transakcji/sesji
--           (wymagane przez PostgreSQL: ALTER TYPE ADD VALUE musi być
--            commitowane zanim nowe wartości enum mogą być użyte)
--   KROK 3: Uruchom diagnose_prod.sql — wszystko powinno być 'present'
--
-- PODZIAŁ:
--   catchup_prod.sql      §1–§16 + §17a (ADD VALUE do enum)
--   catchup_prod_part2.sql §17b–§23 (użycie nowych wartości enum + reszta)
-- =============================================================================


-- =============================================================================
-- §1 · 20260322120000 · balance payment fields
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS balance_payment_method           text,
  ADD COLUMN IF NOT EXISTS balance_stripe_checkout_id       text,
  ADD COLUMN IF NOT EXISTS balance_stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS balance_paid_at                  timestamptz;


-- =============================================================================
-- §2 · 20260322130000 · guide_accommodations.link_url
-- =============================================================================

ALTER TABLE guide_accommodations
  ADD COLUMN IF NOT EXISTS link_url text;


-- =============================================================================
-- §3 · 20260325100000 · bookings.requested_dates
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS requested_dates text[];


-- =============================================================================
-- §4 · 20260326100000 · guides.accepted_payment_methods
-- =============================================================================

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[];


-- =============================================================================
-- §5 · 20260327000000 · indexes + founding guide + column cleanup
-- =============================================================================

-- 5a. Drop obsolete columns (safe — verified unused in codebase)
ALTER TABLE bookings
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_reason,
  DROP COLUMN IF EXISTS stripe_transfer_id;

-- 5b. Founding guide columns
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS commission_rate       numeric(5,4) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS founding_guide_until  date         DEFAULT NULL;

-- 5c. Angler identity constraint (NOT VALID = nie sprawdza istniejących wierszy)
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

-- 5d. Indexes
CREATE INDEX IF NOT EXISTS idx_guides_user_id
  ON guides(user_id);

CREATE INDEX IF NOT EXISTS idx_guides_stripe_account_id
  ON guides(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_guide_id
  ON bookings(guide_id);

CREATE INDEX IF NOT EXISTS idx_bookings_angler_id
  ON bookings(angler_id)
  WHERE angler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_experience_id
  ON bookings(experience_id)
  WHERE experience_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id
  ON bookings(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id
  ON booking_messages(booking_id);

CREATE INDEX IF NOT EXISTS idx_experiences_guide_id
  ON experiences(guide_id);

CREATE INDEX IF NOT EXISTS idx_experiences_guide_published
  ON experiences(guide_id, published);

CREATE INDEX IF NOT EXISTS idx_experience_blocked_dates_exp_dates
  ON experience_blocked_dates(experience_id, date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_guide_weekly_schedules_guide_period
  ON guide_weekly_schedules(guide_id, period_from, period_to);


-- =============================================================================
-- §6 · 20260327100000 · bookings.marketing_consent
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;


-- =============================================================================
-- §7 · 20260327110000 · bookings payout tracking
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_status   text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_sent_at  timestamptz;


-- =============================================================================
-- §8 · 20260327120000 · guides.photo_marketing_consent
-- =============================================================================

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS photo_marketing_consent boolean NOT NULL DEFAULT false;


-- =============================================================================
-- §9 · 20260327200000 · offer_price_tiers (trip_inquiries)
-- Uwaga: ta tabela jest usuwana w §17 (unify). Jeśli produkcja jest
-- PRZED §17, dodajemy kolumnę; jeśli po §17 — ten blok jest bez efektu.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trip_inquiries'
  ) THEN
    ALTER TABLE trip_inquiries
      ADD COLUMN IF NOT EXISTS offer_price_tiers    jsonb,
      ADD COLUMN IF NOT EXISTS offer_price_min_eur  numeric(10,2),
      ADD COLUMN IF NOT EXISTS offer_days           text[];
  END IF;
END $$;


-- =============================================================================
-- §10 · 20260328100000 · experiences price range hint
-- =============================================================================

ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS price_range_min_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_range_max_eur numeric(10,2);


-- =============================================================================
-- §11 · 20260328200000 · guides.is_hidden
-- =============================================================================

-- Default TRUE (hidden) for all new guides, FALSE dla istniejących (live na prod)
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Opcjonalnie: jeśli chcesz żeby nowi guidzi zaczynali jako hidden,
-- ustaw DEFAULT na true po backfillu:
-- ALTER TABLE guides ALTER COLUMN is_hidden SET DEFAULT true;


-- =============================================================================
-- §12 · 20260330100000 · guides IBAN fields
-- =============================================================================

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS iban              text,
  ADD COLUMN IF NOT EXISTS iban_holder_name  text,
  ADD COLUMN IF NOT EXISTS iban_bic          text,
  ADD COLUMN IF NOT EXISTS iban_bank_name    text;

COMMENT ON COLUMN guides.iban             IS 'IBAN for direct angler→guide payment in manual payment model';
COMMENT ON COLUMN guides.iban_holder_name IS 'Account holder name shown to angler for manual transfers';
COMMENT ON COLUMN guides.iban_bic         IS 'BIC/SWIFT code for the IBAN';
COMMENT ON COLUMN guides.iban_bank_name   IS 'Optional bank name shown to angler for clarity';


-- =============================================================================
-- §13 · 20260330200000 · guides.terms_accepted_at
-- =============================================================================

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;


-- =============================================================================
-- §14 · 20260330210000 · audit_log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text        NOT NULL,
  record_id   uuid,
  operation   text        NOT NULL,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz DEFAULT now()
);


-- =============================================================================
-- §15 · 20260330300000 · guides.payment_ready (generated column)
-- =============================================================================
-- Wymaga: stripe_charges_enabled, stripe_payouts_enabled, stripe_account_id, iban
-- Wszystkie te kolumny powinny już istnieć po §12.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'guides'
      AND column_name = 'payment_ready'
  ) THEN
    ALTER TABLE guides
      ADD COLUMN payment_ready boolean
        GENERATED ALWAYS AS (
          (
            stripe_account_id IS NOT NULL
            AND stripe_charges_enabled = true
            AND stripe_payouts_enabled = true
          )
          OR
          (iban IS NOT NULL AND iban <> '')
        ) STORED;

    COMMENT ON COLUMN guides.payment_ready
      IS 'Auto-computed. true = guide has active Stripe Connect OR saved IBAN. Never write directly.';

    CREATE INDEX IF NOT EXISTS guides_payment_ready_idx ON guides (payment_ready);
  END IF;
END $$;


-- =============================================================================
-- §16 · 20260331100000 · trip_inquiries.offer_days
-- (covered already in §9 above — no-op if already added)
-- =============================================================================


-- =============================================================================
-- §17a · 20260401000000 · Nowe wartości booking_status enum
--
-- STOP: Po uruchomieniu tego pliku ZATWIERDŹ transakcję (COMMIT / koniec sesji).
-- Następnie uruchom catchup_prod_part2.sql w nowej sesji.
-- PostgreSQL error 55P04: nowe wartości enum nie mogą być użyte w tej
-- samej transakcji w której zostały dodane przez ALTER TYPE ADD VALUE.
-- =============================================================================

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'offer_sent';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'offer_accepted';

-- ▲ KONIEC catchup_prod.sql (CZĘŚĆ 1)
-- Zatwierdź tę transakcję, a następnie uruchom catchup_prod_part2.sql
