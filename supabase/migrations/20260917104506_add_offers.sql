-- FA-1.12 — add_offers: drop legacy marketplace table, create new offers + offer_options per §3b
-- docs/01-architecture.md §3b
--
-- Pre-condition: 14-row full export at docs/archive/2026-09-17-offers-legacy.json (committed
-- in fc5d8482). All 14 rows are draft or sent; 0 payments; safe to drop.
--
-- offer_state enum safety — verified on prod 2026-09-17 via MCP execute_sql:
--   SELECT n.nspname, c.relname, a.attname FROM pg_attribute a
--   JOIN pg_class c ON c.oid = a.attrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   JOIN pg_type t ON t.oid = a.atttypid
--   WHERE t.typname = 'offer_state'
--     AND c.relkind IN ('r','v','m') AND a.attnum > 0 AND NOT a.attisdropped;
--   → prod result: 1 row — nspname=public, relname=offers, attname=status
--     ← safe to DROP after DROP TABLE
--
-- offer-with-0-options constraint:
--   A DEFERRABLE INITIALLY DEFERRED constraint trigger fires at commit time, so the server
--   action can INSERT offers then INSERT offer_options in the same transaction without a
--   false violation. Trying to commit an offer row with no options raises the error.
--   Deleting the last option is also guarded — by a separate DEFERRABLE trigger on
--   offer_options DELETE.

-- ────────────────────────────────────────────────────────
-- 1. Drop legacy marketplace table + enum
-- ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.offers;
DROP TYPE  IF EXISTS public.offer_state;

-- ────────────────────────────────────────────────────────
-- 2. New offers table (§3b — one guide response per inquiry)
-- ────────────────────────────────────────────────────────
CREATE TABLE offers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id        UUID        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  guide_id          UUID        REFERENCES guides(id) ON DELETE SET NULL,
  source_message_id UUID        REFERENCES messages(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'presented', 'accepted', 'declined', 'superseded')),
  notes             TEXT,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE offers IS
  'One guide response per inquiry. Supersedes the legacy marketplace offers table (archived → FA-1.12).';

COMMENT ON COLUMN offers.source_message_id IS
  'The inbound guide message the admin marked as "this is the offer".';

COMMENT ON COLUMN offers.status IS
  'draft → presented → accepted|declined → superseded. Only one non-superseded offer per inquiry at a time (application-enforced).';

CREATE INDEX IF NOT EXISTS offers_inquiry_idx
  ON offers (inquiry_id, created_at DESC);

CREATE OR REPLACE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────
-- 3. Offer options (1..n variants per offer)
-- ────────────────────────────────────────────────────────
CREATE TABLE offer_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID        NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  price_cents BIGINT      NOT NULL,
  currency    CHAR(3)     NOT NULL,
  date_from   DATE,
  date_to     DATE,
  party_size  INTEGER,
  includes    JSONB       NOT NULL DEFAULT '[]',
  notes       TEXT,
  is_accepted BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE offer_options IS
  'Price/date variants within one offer (e.g. 3-day lodge vs 5-day camp). §3b FA-1.12.';

COMMENT ON COLUMN offer_options.price_cents IS
  'Guide price in cents (BIGINT — large currencies e.g. JPY/ISK). Integer cents + currency; never float.';

COMMENT ON COLUMN offer_options.is_accepted IS
  'Set to true when the angler picks this option. At most one true per offer (partial unique index).';

CREATE INDEX IF NOT EXISTS offer_options_offer_idx
  ON offer_options (offer_id);

-- At most one accepted option per offer.
CREATE UNIQUE INDEX offer_options_one_accepted_idx
  ON offer_options (offer_id) WHERE is_accepted = true;

-- ────────────────────────────────────────────────────────
-- 4. Constraint: every offer must have ≥ 1 option at commit
-- ────────────────────────────────────────────────────────
-- Two separate functions: one per trigger table, because OLD/NEW row types differ.
-- (A single function using TG_TABLE_NAME + CASE would evaluate OLD.offer_id in the
-- INSERT-on-offers context where OLD has the offers row type, which has no offer_id.)

CREATE OR REPLACE FUNCTION _offers_check_has_options_on_insert()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Fires AFTER INSERT ON offers (deferred to commit).
  -- Skip if the offer itself was also deleted in this transaction
  -- (e.g. test rollback path: INSERT offers + no options + DELETE offers in one txn).
  IF NOT EXISTS (SELECT 1 FROM offers WHERE id = NEW.id) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM offer_options WHERE offer_id = NEW.id) THEN
    RAISE EXCEPTION 'offer % must have at least one option', NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION _offer_options_check_min_one_on_delete()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Fires AFTER DELETE ON offer_options (deferred to commit).
  -- Skip when the parent offer itself was also deleted in this transaction
  -- (cascade from DELETE offers or DELETE inquiries). At commit time the offer
  -- row is already gone, so there is nothing to enforce.
  IF NOT EXISTS (SELECT 1 FROM offers WHERE id = OLD.offer_id) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM offer_options WHERE offer_id = OLD.offer_id) THEN
    RAISE EXCEPTION 'offer % must retain at least one option', OLD.offer_id;
  END IF;
  RETURN NULL;
END;
$$;

-- a) fires when an offer row is created (no options yet — deferred to commit)
CREATE CONSTRAINT TRIGGER offers_must_have_options
  AFTER INSERT ON offers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _offers_check_has_options_on_insert();

-- b) fires when the last option of an offer might be deleted (deferred to commit).
--    Skips the check when the parent offer itself was also deleted in the same
--    transaction (cascade from inquiries → offers → offer_options, or a direct
--    DELETE offers → CASCADE offer_options).
CREATE CONSTRAINT TRIGGER offer_options_preserve_min
  AFTER DELETE ON offer_options
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _offer_options_check_min_one_on_delete();

-- ────────────────────────────────────────────────────────
-- 5. RLS — service_role full access; authenticated admins read.
--    Same rationale as messages: all mutations go through service_role actions.
--    No angler or guide policies in this stage — access through requireToken() /
--    requireGuide() uses service_role for data reads.
-- ────────────────────────────────────────────────────────
ALTER TABLE offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on offers"
  ON offers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin read offers"
  ON offers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "service_role full access on offer_options"
  ON offer_options FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin read offer_options"
  ON offer_options FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT ALL ON TABLE offers        TO authenticated, service_role;
GRANT ALL ON TABLE offer_options TO authenticated, service_role;
REVOKE ALL ON TABLE offers        FROM anon; -- anon has no business here; decision tj 2026-09-17
REVOKE ALL ON TABLE offer_options FROM anon;
