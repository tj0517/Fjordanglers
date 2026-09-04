-- Add agent auto-reply state to inquiries table.
-- agent_status: 'waiting' = email sent, awaiting angler reply
--               'ready'   = enough info collected, ready for FA review
--               'stopped' = max rounds reached or manually stopped
-- agent_round: number of AI rounds completed (max 2)

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS agent_status TEXT
    CHECK (agent_status IN ('waiting', 'ready', 'stopped')),
  ADD COLUMN IF NOT EXISTS agent_round SMALLINT NOT NULL DEFAULT 0;
