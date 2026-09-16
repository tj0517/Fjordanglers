-- FA-1.03 — inquiry_events: the append-only record of everything that happens to an
-- inquiry (docs/01-architecture.md §3, docs/REBUILD_PLAN.md §4.1 and Appendix C).
--
-- Every domain state change emits a row here in the same operation that makes the
-- change (CLAUDE.md rule 5). `channel` says where it happened, `source` says how it
-- reached the table — metrics must be able to tell an event the app produced from one
-- a backfill guessed. `occurred_at` is separate from `created_at` so a backfill can
-- carry the real time without faking the moment of writing.
--
-- message_id is a plain UUID here on purpose: the `messages` table does not exist yet,
-- and FA-1.12 adds the foreign key when it creates that table.

CREATE TABLE IF NOT EXISTS inquiry_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  from_status  TEXT,
  to_status    TEXT,
  actor_kind   TEXT NOT NULL,
  actor_id     TEXT,
  channel      TEXT,
  source       TEXT NOT NULL,
  message_id   UUID,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inquiry_events_actor_kind_check
    CHECK (actor_kind = ANY (ARRAY['admin', 'guide', 'system', 'agent', 'angler'])),
  CONSTRAINT inquiry_events_channel_check
    CHECK (channel IS NULL OR channel = ANY (ARRAY['email', 'whatsapp', 'instagram', 'stripe', 'app'])),
  CONSTRAINT inquiry_events_source_check
    CHECK (source = ANY (ARRAY['app', 'webhook', 'cron', 'backfill']))
);

COMMENT ON TABLE inquiry_events IS
  'Append-only log of every domain state change on an inquiry: the source of every time, '
  'funnel and effort metric. Written by emitEvent() / transition() in src/lib/events and '
  'src/lib/inquiries/state.ts; never updated or deleted. Type catalogue: '
  'docs/REBUILD_PLAN.md Appendix C + src/lib/events/types.ts — both change in the same PR.';

COMMENT ON COLUMN inquiry_events.channel IS 'Where it happened (NULL for app-internal events).';
COMMENT ON COLUMN inquiry_events.source  IS 'How it reached this table: app | webhook | cron | backfill.';
COMMENT ON COLUMN inquiry_events.message_id IS
  'Set for message.* types. Foreign key to messages(id) is added in FA-1.12, with that table.';

CREATE INDEX IF NOT EXISTS inquiry_events_inquiry_occurred_idx
  ON inquiry_events (inquiry_id, occurred_at);
CREATE INDEX IF NOT EXISTS inquiry_events_type_occurred_idx
  ON inquiry_events (type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS inquiry_events_actor_occurred_idx
  ON inquiry_events (actor_kind, actor_id, occurred_at DESC);

-- ─── Append-only ─────────────────────────────────────────────────────────────
--
-- Three layers, because one is not enough:
--   1. RLS policies — cover anon and authenticated (rolbypassrls = false).
--   2. REVOKE       — service_role has rolbypassrls = true, so RLS alone does not
--                     stop it; only the table privilege does.
--   3. Trigger      — holds for the table owner too (docs/03-conventions.md allows
--                     triggers exactly for append-only guards). UPDATE only: a row
--                     trigger on DELETE would also fire for the ON DELETE CASCADE
--                     from inquiries and make deleteInquiry() fail. DELETE stays
--                     closed for every API role through REVOKE and the missing policy.

ALTER TABLE inquiry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role writes events"  ON inquiry_events;
DROP POLICY IF EXISTS "service_role reads events"   ON inquiry_events;
DROP POLICY IF EXISTS "authenticated reads events"  ON inquiry_events;

CREATE POLICY "service_role writes events" ON inquiry_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_role reads events" ON inquiry_events
  FOR SELECT TO service_role USING (true);

-- Admin screens read the timeline through the session client; the guide portal never
-- reaches this table (no policy scopes rows to a guide — that is deliberate, the
-- timeline is internal).
CREATE POLICY "authenticated reads events" ON inquiry_events
  FOR SELECT TO authenticated USING (true);

-- No UPDATE or DELETE policy exists for any role, by design.

REVOKE UPDATE, DELETE, TRUNCATE ON inquiry_events FROM anon, authenticated, service_role;
REVOKE INSERT ON inquiry_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION inquiry_events_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'inquiry_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION inquiry_events_append_only() IS
  'Append-only guard for inquiry_events — see the table comment. Raises on any UPDATE, '
  'regardless of caller, including the table owner.';

DROP TRIGGER IF EXISTS inquiry_events_no_update ON inquiry_events;
CREATE TRIGGER inquiry_events_no_update
  BEFORE UPDATE ON inquiry_events
  FOR EACH ROW EXECUTE FUNCTION inquiry_events_append_only();
