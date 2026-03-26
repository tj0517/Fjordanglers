-- Add accepted_payment_methods to guides
-- Guide selects which payment methods they accept: 'cash' and/or 'online'
-- Displayed on their public profile and trip pages so anglers know before booking.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[]
    DEFAULT ARRAY['cash', 'online']::text[]
    CHECK (
      accepted_payment_methods IS NULL
      OR (
        array_length(accepted_payment_methods, 1) > 0
        AND accepted_payment_methods <@ ARRAY['cash', 'online']::text[]
      )
    );
