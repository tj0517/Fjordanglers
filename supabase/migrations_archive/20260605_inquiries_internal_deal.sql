-- Internal deal tracking columns — FA-only, no client email involved.
-- Also adds lost_reason for tracking why deals were lost.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS internal_deal_total_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS internal_commission_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS internal_notes          TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason             TEXT;
