-- ─── stage_reached: tracks the furthest funnel stage an inquiry has reached ────
--
-- Values (in order): 'inquiry' → 'offer_sent' → 'deposit_paid' → 'completed'
--
-- This solves the "lost at which stage?" problem:
--   status = 'lost' AND stage_reached = 'inquiry'      → lost before any offer was sent
--   status = 'lost' AND stage_reached = 'offer_sent'   → lost after offer, before deposit
--   status = 'lost' AND stage_reached = 'deposit_paid' → (edge case: paid then refunded/cancelled)
--
-- The column only ever advances — the trigger below prevents it going backward.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS stage_reached TEXT NOT NULL DEFAULT 'inquiry'
  CHECK (stage_reached IN ('inquiry', 'offer_sent', 'deposit_paid', 'completed'));

-- ─── Backfill existing rows ───────────────────────────────────────────────────

UPDATE inquiries SET stage_reached = CASE
  WHEN status = 'completed'
    THEN 'completed'
  WHEN deposit_paid_at IS NOT NULL OR status = 'deposit_paid'
    THEN 'deposit_paid'
  WHEN offer_sent_at IS NOT NULL
    OR status IN ('offer_sent', 'waiting_for_deposit', 'deposit_sent')
    THEN 'offer_sent'
  ELSE 'inquiry'
END;

-- ─── Trigger: stage_reached can only advance, never go backward ───────────────

CREATE OR REPLACE FUNCTION inquiries_advance_stage_reached()
RETURNS TRIGGER AS $$
DECLARE
  stages TEXT[] := ARRAY['inquiry', 'offer_sent', 'deposit_paid', 'completed'];
BEGIN
  IF array_position(stages, NEW.stage_reached) < array_position(stages, OLD.stage_reached) THEN
    NEW.stage_reached := OLD.stage_reached;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inquiries_stage_must_advance ON inquiries;

CREATE TRIGGER inquiries_stage_must_advance
BEFORE UPDATE OF stage_reached ON inquiries
FOR EACH ROW
EXECUTE FUNCTION inquiries_advance_stage_reached();
