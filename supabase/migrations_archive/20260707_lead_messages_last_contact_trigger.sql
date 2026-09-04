-- Auto-sync inquiries.last_contact_at from lead_messages.
--
-- Whenever a row is inserted (or updated) in lead_messages, this trigger
-- sets inquiries.last_contact_at to the MAX created_at for that inquiry.
-- This makes last_contact_at always accurate regardless of which code path
-- wrote the message (live bridge, bulk import, admin panel, etc.)

CREATE OR REPLACE FUNCTION sync_last_contact_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inquiries
  SET last_contact_at = (
    SELECT MAX(created_at)
    FROM lead_messages
    WHERE inquiry_id = NEW.inquiry_id
  )
  WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_last_contact_at ON lead_messages;

CREATE TRIGGER trg_sync_last_contact_at
AFTER INSERT OR UPDATE ON lead_messages
FOR EACH ROW
EXECUTE FUNCTION sync_last_contact_at();

-- One-time backfill: sync all existing inquiries from their lead_messages
UPDATE inquiries i
SET last_contact_at = (
  SELECT MAX(lm.created_at)
  FROM lead_messages lm
  WHERE lm.inquiry_id = i.id
)
WHERE EXISTS (
  SELECT 1 FROM lead_messages lm WHERE lm.inquiry_id = i.id
);
