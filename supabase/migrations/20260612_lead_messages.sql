-- lead_messages: manual CRM communication log per inquiry
-- Each row records one inbound/outbound conversation moment (WhatsApp, email, note)

CREATE TABLE IF NOT EXISTS lead_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  direction    TEXT        NOT NULL CHECK (direction    IN ('inbound', 'outbound')),
  channel      TEXT        NOT NULL CHECK (channel      IN ('whatsapp', 'email', 'note')),
  contact_type TEXT        NOT NULL CHECK (contact_type IN ('client', 'guide')),
  contact_name TEXT        NOT NULL DEFAULT '',
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   TEXT        NOT NULL DEFAULT 'tymon'
);

CREATE INDEX IF NOT EXISTS lead_messages_inquiry_id_idx
  ON lead_messages(inquiry_id, created_at DESC);

-- RLS: admin-only access (service role bypasses RLS for all admin operations)
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;

-- New CRM columns on inquiries
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action     TEXT;
