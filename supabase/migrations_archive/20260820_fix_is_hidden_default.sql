-- Fix is_hidden for beta/seed guides that were created without explicitly
-- setting is_hidden = false.  The public-read RLS policy and getGuide() both
-- require is_hidden = false, so any guide left with is_hidden = true (or the
-- column default if it was not false) returned 404 on their public profile.
--
-- Also sets the column default to false so future inserts that omit the field
-- are visible by default.

-- 1. Ensure the column default is false going forward
ALTER TABLE guides
  ALTER COLUMN is_hidden SET DEFAULT false;

-- 2. Fix all existing active guides that are currently hidden
--    (covers NZ seeds and any other beta listings created without is_hidden = false)
UPDATE guides
  SET is_hidden = false
  WHERE is_hidden IS DISTINCT FROM false
    AND status = 'active';
