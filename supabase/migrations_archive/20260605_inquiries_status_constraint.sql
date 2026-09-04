-- Extend status check constraint to allow new manual statuses: in_negotiation, lost.

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN (
    'pending_fa_review',
    'in_negotiation',
    'deposit_sent',
    'deposit_paid',
    'completed',
    'lost',
    'cancelled'
  ));
