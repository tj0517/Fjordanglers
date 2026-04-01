-- ============================================================
-- Remove booking-based auto-blocks from experience_blocked_dates
-- 2026-04-01
--
-- Background:
--   blockCalendarSiblings() was inserting rows with
--   reason = 'auto_blocked:booking:<uuid>' into experience_blocked_dates
--   whenever a booking was accepted or confirmed.
--
-- This created inconsistencies:
--   • Direct bookings: blocked via experience_blocked_dates
--   • Inquiry bookings: NOT blocked via this table (different code path)
--   • Duplicate inserts (at acceptBooking time + webhook time)
--   • Stale rows if booking was cancelled/declined after refund
--
-- New approach:
--   Booking-based date blocking is now computed live on the trip page
--   by querying the bookings table directly (by guide_id).
--   experience_blocked_dates is used ONLY for manual guide blocks.
--
-- This migration deletes all auto-generated rows so the table
-- contains only intentional guide-managed blocks.
-- ============================================================

DELETE FROM experience_blocked_dates
WHERE reason LIKE 'auto_blocked:booking:%';
