-- Manual payout tracking on bookings.
-- payout_status tracks whether the guide has been paid by admin.
-- Default 'pending' — admin sends payout manually via Stripe transfers.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'sent', 'returned')),
  ADD COLUMN IF NOT EXISTS payout_sent_at timestamptz;
