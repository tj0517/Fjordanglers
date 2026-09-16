-- FA-1.03 — inquiry statuses say who we are waiting for (docs/01-architecture.md §4).
--
-- Legacy statuses describe a step in a linear pipeline; the angler and the guide
-- conversations run in parallel and loop, so the vocabulary changes to:
--   new · qualifying · waiting_guide · offer_presented · awaiting_payment · paid
--   handed_over · completed · lost · cancelled
--
-- The seven legacy-only values stay ALLOWED by the constraint (deprecated) until the
-- event backfill (FA-1.05) has run; they are dropped in stage 4. No row uses them
-- after this migration — the mapping below rewrites every one.
--
-- Mapping (docs/01-architecture.md §4.1):
--   pending                 → new
--   in_negotiation          → qualifying
--   waiting_for_guide_offer → waiting_guide
--   offer_sent              → offer_presented
--   waiting_for_deposit     → awaiting_payment
--   deposit_sent            → awaiting_payment
--   deposit_paid            → paid
--   completed / lost / cancelled → unchanged
--
-- `status` is a CHECK constraint on TEXT (not a Postgres enum), so widening it is a
-- plain DROP/ADD inside this transaction — verified against production before writing:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='public.inquiries'::regclass AND conname='inquiries_status_check';
-- No RLS policy, function or view reads a status value (checked in pg_policy, pg_proc
-- and pg_views on production), so nothing else has to change with it.
--
-- Idempotent: the constraint is replaced unconditionally and the UPDATE matches only
-- legacy values, so a second run is a no-op.

-- 1. Allow the new values alongside the legacy ones.
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check CHECK (
  status = ANY (ARRAY[
    -- current vocabulary
    'new',
    'qualifying',
    'waiting_guide',
    'offer_presented',
    'awaiting_payment',
    'paid',
    'handed_over',
    'completed',
    'lost',
    'cancelled',
    -- deprecated, kept until FA-1.05; dropped in stage 4
    'pending',
    'in_negotiation',
    'waiting_for_guide_offer',
    'offer_sent',
    'waiting_for_deposit',
    'deposit_sent',
    'deposit_paid'
  ])
);

-- 2. Rewrite every legacy value.
DO $$
DECLARE
  moved INT;
BEGIN
  UPDATE inquiries SET status = CASE status
    WHEN 'pending'                 THEN 'new'
    WHEN 'in_negotiation'          THEN 'qualifying'
    WHEN 'waiting_for_guide_offer' THEN 'waiting_guide'
    WHEN 'offer_sent'              THEN 'offer_presented'
    WHEN 'waiting_for_deposit'     THEN 'awaiting_payment'
    WHEN 'deposit_sent'            THEN 'awaiting_payment'
    WHEN 'deposit_paid'            THEN 'paid'
  END
  WHERE status IN (
    'pending', 'in_negotiation', 'waiting_for_guide_offer', 'offer_sent',
    'waiting_for_deposit', 'deposit_sent', 'deposit_paid'
  );

  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'inquiries_status_v2: remapped % rows from legacy statuses', moved;
END $$;

-- 3. A new inquiry is one nobody has replied to yet.
--    (Was 'pending' since FA-0.20; before that the dead 'pending_fa_review'.)
ALTER TABLE inquiries ALTER COLUMN status SET DEFAULT 'new';

COMMENT ON COLUMN inquiries.status IS
  'Who we are waiting for, not a pipeline step. Changed only through transition() in '
  'src/lib/inquiries/state.ts, which emits status.changed. See docs/01-architecture.md §4. '
  'The seven legacy values are deprecated and unused — dropped in stage 4.';
