-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_rich_offer
--
-- Adds all FA offer fields to the inquiries table.
-- Includes both the original offer fields (previously only commented in code)
-- and new rich offer fields for the magic-link offer page.
-- Also creates the inquiry_messages audit table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Core offer fields (previously commented-only in inquiries.ts) ─────────────

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS offer_total_eur   NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_deposit_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_notes       TEXT,
  ADD COLUMN IF NOT EXISTS offer_sent_at     TIMESTAMPTZ;

-- ── Rich offer fields (new) ───────────────────────────────────────────────────

ALTER TABLE inquiries
  -- Day-by-day trip plan written by FA
  ADD COLUMN IF NOT EXISTS offer_trip_plan     TEXT,

  -- Fishing licence requirements for the destination
  ADD COLUMN IF NOT EXISTS offer_license_info  TEXT,

  -- What's included in the trip price, e.g. ["Rods & tackle", "Boat", "Lunch"]
  ADD COLUMN IF NOT EXISTS offer_inclusions    JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Custom questions FA wants the angler to answer before confirming
  -- Schema: [{ id: uuid-string, question: string }]
  ADD COLUMN IF NOT EXISTS offer_questions     JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Angler's answers to the custom questions (submitted on the offer page)
  -- Schema: [{ id: uuid-string, question: string, answer: string }]
  ADD COLUMN IF NOT EXISTS offer_answers       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Why the deposit is refundable — shown prominently to angler
  ADD COLUMN IF NOT EXISTS offer_refund_reason TEXT,

  -- Unique token for the public /offers/[token] page (no login required)
  ADD COLUMN IF NOT EXISTS offer_token         TEXT UNIQUE,

  -- When the offer page link expires (default 30 days from offer_sent_at)
  ADD COLUMN IF NOT EXISTS offer_token_expires_at TIMESTAMPTZ;

-- Index for fast token lookup on the public offer page
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_offer_token_idx
  ON inquiries (offer_token)
  WHERE offer_token IS NOT NULL;

-- ── inquiry_messages — FA ↔ angler audit trail ────────────────────────────────

CREATE TABLE IF NOT EXISTS inquiry_messages (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id  UUID         NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  subject     TEXT,
  body        TEXT         NOT NULL,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inquiry_messages_inquiry_id_idx
  ON inquiry_messages (inquiry_id, sent_at DESC);

ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;
-- Service role key bypasses RLS — FA uses service client for all message ops.
