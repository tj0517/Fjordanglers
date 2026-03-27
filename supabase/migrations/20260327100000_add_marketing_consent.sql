-- Add marketing consent flag to bookings
-- Optional — angler can agree to let FjordAnglers use their trip photos/content
-- for promotional purposes. Defaults to false (no consent assumed).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
