-- Add requested_dates column to bookings
-- Stores all individual dates the angler selected in the "Book directly" flow.
-- booking_date keeps the primary (first) date for backward compat.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS requested_dates text[] DEFAULT NULL;
