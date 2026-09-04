-- unmatched_messages: queue for incoming WhatsApp/email messages that couldn't
-- be automatically matched to an existing inquiry by phone or email.
-- Admin can manually link them via the /admin/inquiries/unmatched UI.

CREATE TABLE IF NOT EXISTS unmatched_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source              TEXT        NOT NULL CHECK (source IN ('whatsapp', 'email')),
  from_identifier     TEXT        NOT NULL,   -- phone number or email address
  sender_name         TEXT        NOT NULL DEFAULT '',
  content             TEXT        NOT NULL,
  raw_payload         JSONB,
  matched_inquiry_id  UUID        REFERENCES inquiries(id) ON DELETE SET NULL,
  matched_at          TIMESTAMPTZ,
  matched_by          TEXT,                   -- admin username who linked it
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unmatched_messages_source_from_idx
  ON unmatched_messages (source, from_identifier);

CREATE INDEX IF NOT EXISTS unmatched_messages_matched_inquiry_idx
  ON unmatched_messages (matched_inquiry_id);

-- RLS: readable/writable by service role only (admin operations bypass RLS)
ALTER TABLE unmatched_messages ENABLE ROW LEVEL SECURITY;
