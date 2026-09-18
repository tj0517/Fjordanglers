-- FA-1.12 — messages: one thread per inquiry, every channel
-- docs/01-architecture.md §3a
--
-- Replaces lead_messages and inquiry_messages — both tables are migrated and
-- dropped in the subsequent data-migration file. This file only creates the
-- target structure and adds the FK from inquiry_events.message_id (a plain UUID
-- since FA-1.03 with a comment that the FK arrives here — see
-- supabase/migrations/20260916201226_add_inquiry_events.sql line 23).
--
-- body NOT NULL: verified on prod 2026-09-17 — both lead_messages.content and
-- inquiry_messages.body have 0 NULL and 0 empty rows across 669 total rows.

CREATE TABLE IF NOT EXISTS messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id     UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL
                 CHECK (channel IN ('email', 'whatsapp', 'instagram')),
  direction      TEXT NOT NULL
                 CHECK (direction IN ('inbound', 'outbound')),
  counterpart    TEXT NOT NULL
                 CHECK (counterpart IN ('angler', 'guide')),
  counterpart_id UUID REFERENCES guides(id) ON DELETE SET NULL,
  external_id    TEXT UNIQUE,
  thread_key     TEXT,
  body           TEXT NOT NULL,
  subject        TEXT,
  media          JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL
                 CHECK (status IN ('draft', 'queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  sent_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  drafted_by     TEXT CHECK (drafted_by IN ('admin', 'agent')),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE messages IS
  'One thread per inquiry, every channel. Replaces lead_messages + inquiry_messages (FA-1.12).';

COMMENT ON COLUMN messages.external_id IS
  'Provider message-id (Resend email_id, Meta message id). UNIQUE — used for idempotent webhook inserts.';

COMMENT ON COLUMN messages.thread_key IS
  'Email Message-ID chain / WhatsApp conversation id — used to match inbound replies to the inquiry.';

COMMENT ON COLUMN messages.counterpart IS
  'Who is on the other end: angler (client) or guide.';

COMMENT ON COLUMN messages.occurred_at IS
  'Real time of the fact, separate from created_at so backfills carry the original timestamp.';

CREATE INDEX IF NOT EXISTS messages_inquiry_occurred_idx
  ON messages (inquiry_id, occurred_at);

CREATE INDEX IF NOT EXISTS messages_thread_key_idx
  ON messages (thread_key) WHERE thread_key IS NOT NULL;

-- Add FK from inquiry_events.message_id (plain UUID since FA-1.03) now that the table exists.
--
-- ON DELETE RESTRICT: deleting a message that has inquiry_events referencing it must fail.
-- DEFERRABLE INITIALLY DEFERRED: the check happens at commit, not immediately, so that
-- cascade-delete of an inquiry (which deletes inquiry_events first, then messages, in the
-- same transaction) does not trigger a false violation.
--
-- ON DELETE SET NULL is intentionally NOT used here because inquiry_events has an
-- append-only BEFORE UPDATE trigger (inquiry_events_append_only_trg) that raises on any
-- UPDATE, including the null-out that SET NULL would require.
ALTER TABLE inquiry_events
  ADD CONSTRAINT inquiry_events_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- RLS — service_role full access; authenticated admins read.
-- No angler or guide policies: all access goes through server actions with
-- requireAdmin() / requireToken() / requireGuide(), which then use service_role.
-- Rationale: the thread contains messages to both counterparts; an angler-scoped
-- policy (counterpart='angler') would still leak any admin note miscoded as 'angler',
-- and a guide-scoped policy needs counterpart_id — both add complexity with no gain
-- since this app never reads messages with the anon/authenticated client directly.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on messages"
  ON messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admin reads with the authenticated JWT (requireAdmin() checks profiles.role='admin',
-- then the action uses createServiceClient() — but this policy covers direct reads
-- that may happen via createClient() in future admin components).
CREATE POLICY "admin read messages"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT ALL ON TABLE messages TO authenticated, service_role;
REVOKE ALL ON TABLE messages FROM anon; -- anon has no business here; decision tj 2026-09-17
