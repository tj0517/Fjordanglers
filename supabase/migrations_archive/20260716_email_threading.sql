-- Email threading: store the Message-ID of the last email in this inquiry's thread.
-- Updated after every outbound send; overwritten by every inbound reply.
-- Allows Round 2+ agent emails to set In-Reply-To and stay in the same thread.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS email_thread_message_id TEXT;

COMMENT ON COLUMN inquiries.email_thread_message_id IS
  'Message-ID of the last email in this thread (our outbound or the angler''s reply). Used for In-Reply-To on subsequent sends.';
