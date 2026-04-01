/**
 * create-booking-from-inquiry.ts — DEPRECATED.
 *
 * Previously created a bookings row from a trip_inquiries row on payment.
 * After the DB unification (2026-04-01), inquiry bookings are created directly
 * in the bookings table (source='inquiry') from the first form submission.
 * Payment webhooks now update the existing booking row to 'confirmed'.
 *
 * This file is kept as a no-op stub to prevent import errors during transition.
 * Delete once all import sites are cleaned up.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/** @deprecated No-op. Booking already exists in bookings table. */
export async function createBookingFromInquiry(
  _bookingId: string,
  _db: SupabaseClient<Database>,
  _stripePaymentIntentId?: string | null,
): Promise<string | null> {
  console.warn('[createBookingFromInquiry] called after unification — this is a no-op. bookingId:', _bookingId)
  return _bookingId
}
