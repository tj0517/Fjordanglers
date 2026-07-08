-- Update inquiry status constraint to reflect new sales pipeline flow.
-- Renames pending_fa_review → pending, adds waiting_for_guide_offer and waiting_for_deposit.

-- Migrate existing pending_fa_review rows to pending
UPDATE inquiries SET status = 'pending' WHERE status = 'pending_fa_review';

-- Drop old constraint
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

-- Add new constraint with full pipeline
ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN (
    'pending',
    'in_negotiation',
    'waiting_for_guide_offer',
    'offer_sent',
    'waiting_for_deposit',
    'deposit_sent',
    'deposit_paid',
    'completed',
    'lost',
    'cancelled'
  ));
