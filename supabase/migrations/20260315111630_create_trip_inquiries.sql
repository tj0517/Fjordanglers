-- Migration: 20260315111630_create_trip_inquiries.sql
-- Description: Creates the trip_inquiries table and trip_inquiry_status enum
--              for the Icelandic Flow / concierge booking path (Wave 4C).
--              Anglers submit an inquiry form; admin team reviews and sends
--              a custom offer; angler accepts → Stripe Checkout.
-- Affected tables: trip_inquiries (new)

BEGIN;

-- ─── ENUM ─────────────────────────────────────────────────────────────────────

-- Status lifecycle: inquiry → reviewing → offer_sent → offer_accepted
--                   → confirmed → completed
--                                ↘ cancelled (any stage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'trip_inquiry_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.trip_inquiry_status AS ENUM (
      'inquiry',        -- just submitted by angler
      'reviewing',      -- admin team picked it up
      'offer_sent',     -- admin sent a custom offer to angler
      'offer_accepted', -- angler accepted the offer
      'confirmed',      -- Stripe payment completed
      'completed',      -- trip took place
      'cancelled'       -- cancelled at any stage
    );
  END IF;
END $$;

-- ─── TABLE ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trip_inquiries (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Angler identity
  -- angler_id is nullable: unauthenticated users can still submit inquiries.
  angler_id                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  angler_email             TEXT        NOT NULL,
  angler_name              TEXT        NOT NULL,

  -- Workflow status
  status                   public.trip_inquiry_status NOT NULL DEFAULT 'inquiry',

  -- Requested dates (inclusive range)
  dates_from               DATE        NOT NULL,
  dates_to                 DATE        NOT NULL,

  -- Fishing preferences
  -- target_species: e.g. ["Salmon", "Sea Trout", "Grayling"]
  target_species           TEXT[]      NOT NULL DEFAULT '{}',
  experience_level         TEXT        NOT NULL
    CONSTRAINT trip_inquiries_experience_level_check
      CHECK (experience_level IN ('beginner', 'intermediate', 'expert')),
  group_size               INT         NOT NULL
    CONSTRAINT trip_inquiries_group_size_check
      CHECK (group_size >= 1 AND group_size <= 50),

  -- Additional preferences (JSONB for flexibility):
  -- {
  --   "budgetMin":      500,
  --   "budgetMax":      2000,
  --   "accommodation":  true,
  --   "riverType":      "river",   -- river | lake | sea | any
  --   "notes":          "..."
  -- }
  preferences              JSONB       NOT NULL DEFAULT '{}',

  -- Admin assignment (filled during 'reviewing' stage)
  assigned_guide_id        UUID        REFERENCES public.guides(id) ON DELETE SET NULL,
  assigned_river           TEXT,

  -- Offer details (filled when admin sends offer, status → 'offer_sent')
  offer_price_eur          NUMERIC(10,2),
  offer_details            TEXT,

  -- Stripe payment tracking (populated when angler accepts offer)
  stripe_checkout_id       TEXT,
  stripe_payment_intent_id TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Admin queue: sort by status then created_at (newest first within each bucket)
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_status_created
  ON public.trip_inquiries (status, created_at DESC);

-- Angler lookup: fetch own inquiries (by user id or email for anon anglers)
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_angler_id
  ON public.trip_inquiries (angler_id)
  WHERE angler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_inquiries_angler_email
  ON public.trip_inquiries (angler_email);

-- Admin assignment lookup
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_assigned_guide
  ON public.trip_inquiries (assigned_guide_id)
  WHERE assigned_guide_id IS NOT NULL;

-- Stripe webhook lookup
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_stripe_checkout
  ON public.trip_inquiries (stripe_checkout_id)
  WHERE stripe_checkout_id IS NOT NULL;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE public.trip_inquiries ENABLE ROW LEVEL SECURITY;

-- Angler reads own inquiries (matched by user id OR by email for anon submissions)
CREATE POLICY "Angler reads own trip inquiries"
  ON public.trip_inquiries
  FOR SELECT
  USING (
    angler_id = auth.uid()
    OR angler_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Anyone (including unauthenticated via anon key) can submit an inquiry.
-- Server Actions use the anon client on the client side; service role for admin.
CREATE POLICY "Anyone can submit a trip inquiry"
  ON public.trip_inquiries
  FOR INSERT
  WITH CHECK (true);

-- Only service_role (admin Server Actions) can update inquiries.
-- Anglers never update directly; all state transitions go through Server Actions.
CREATE POLICY "Service role manages trip inquiries"
  ON public.trip_inquiries
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────

-- Reuse (or create) the shared update_updated_at function.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger first to keep the migration idempotent on re-runs.
DROP TRIGGER IF EXISTS update_trip_inquiries_updated_at ON public.trip_inquiries;

CREATE TRIGGER update_trip_inquiries_updated_at
  BEFORE UPDATE ON public.trip_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
