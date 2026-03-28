/**
 * createBookingFromInquiry — server-only helper.
 *
 * Called from two places:
 *   1. Stripe webhook `checkout.session.completed` (paid path)
 *   2. `acceptOffer` action when the guide has no Stripe (direct confirm path)
 *
 * Idempotent: if a booking with inquiry_id already exists, returns its id
 * without inserting again. Safe for Stripe webhook retries.
 *
 * Requires a service-role client (bypasses RLS — booking insert must not
 * fail due to policy on the angler's session).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { env } from '@/lib/env'

export async function createBookingFromInquiry(
  inquiryId: string,
  db: SupabaseClient<Database>,
  stripePaymentIntentId?: string | null,
  paypalCaptureId?: string | null,
): Promise<string | null> {
  // ── Idempotency: booking already created for this inquiry ─────────────────
  const { data: existing } = await db
    .from('bookings')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .maybeSingle()

  if (existing) {
    console.log(`[createBookingFromInquiry] booking already exists for inquiry ${inquiryId}`)
    return existing.id
  }

  // ── Fetch inquiry ─────────────────────────────────────────────────────────
  const { data: inquiry } = await db
    .from('trip_inquiries')
    .select('*')
    .eq('id', inquiryId)
    .single()

  if (!inquiry) {
    console.error(`[createBookingFromInquiry] inquiry ${inquiryId} not found`)
    return null
  }

  if (!inquiry.assigned_guide_id) {
    console.error(`[createBookingFromInquiry] inquiry ${inquiryId} has no assigned_guide_id`)
    return null
  }

  if (!inquiry.offer_price_eur) {
    console.error(`[createBookingFromInquiry] inquiry ${inquiryId} has no offer_price_eur`)
    return null
  }

  // ── Pricing ───────────────────────────────────────────────────────────────
  const totalEur       = inquiry.offer_price_eur
  const commissionRate = env.PLATFORM_COMMISSION_RATE
  const platformFeeEur = Math.round(totalEur * commissionRate * 100) / 100
  const guidePayoutEur = Math.round((totalEur - platformFeeEur) * 100) / 100

  // ── Insert booking ────────────────────────────────────────────────────────
  const { data: booking, error } = await db
    .from('bookings')
    .insert({
      // Origin
      inquiry_id:               inquiryId,
      experience_id:            null,          // no listing — custom trip

      // Participants
      angler_id:                inquiry.angler_id,
      angler_email:             inquiry.angler_email,
      angler_full_name:         inquiry.angler_name,
      guide_id:                 inquiry.assigned_guide_id,

      // Trip details
      booking_date:             inquiry.dates_from,  // use trip start date
      guests:                   inquiry.group_size,
      special_requests:         null,

      // Financials
      total_eur:                totalEur,
      deposit_eur:              totalEur,            // full amount paid upfront
      platform_fee_eur:         platformFeeEur,
      guide_payout_eur:         guidePayoutEur,
      commission_rate:          commissionRate,

      // Status
      status:                   'confirmed',
      confirmed_at:             new Date().toISOString(),

      // Payment
      stripe_payment_intent_id: stripePaymentIntentId ?? null,
      paypal_capture_id:        paypalCaptureId ?? null,
    })
    .select('id')
    .single()

  if (error || !booking) {
    console.error(`[createBookingFromInquiry] insert failed for inquiry ${inquiryId}:`, error)
    return null
  }

  console.log(`[createBookingFromInquiry] booking ${booking.id} created from inquiry ${inquiryId}`)
  return booking.id
}
