-- Add multi-option support to inquiries.
-- offer_options stores 1–3 option objects with per-option pricing, inclusions, schedule.
-- selected_option_id records which option the angler chose when accepting.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS offer_options      JSONB,
  ADD COLUMN IF NOT EXISTS selected_option_id TEXT;
