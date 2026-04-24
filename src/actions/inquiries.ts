'use server'

/**
 * FA Inquiry Server Actions.
 *
 * sendDepositLink(inquiryId) — FA clicks "Send Deposit Link" in the dashboard.
 *   1. Validates inquiry exists + status === 'pending_fa_review'.
 *   2. Creates a Stripe Checkout session on FA's own account (no Connect).
 *   3. Updates inquiry: status → 'deposit_sent', stores session ID + deposit amount.
 *   4. Sends deposit link email to angler.
 *   Returns: { checkoutUrl: string }
 */

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { sendDepositLinkAnglerEmail } from '@/lib/email'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendDepositLinkResult =
  | { success: true;  checkoutUrl: string }
  | { success: false; error: string }

// ─── sendDepositLink ──────────────────────────────────────────────────────────

export async function sendDepositLink(
  inquiryId: string,
  /** Deposit % to charge — default 30%. FA can override via the UI. */
  depositPercent: number = 30,
): Promise<SendDepositLinkResult> {
  if (depositPercent < 1 || depositPercent > 100) {
    return { success: false, error: 'depositPercent must be 1–100' }
  }

  const svc = createServiceClient()

  // Fetch inquiry + trip price
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status, angler_email, angler_name, angler_country, requested_dates, party_size, trip_id, message')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  if (inquiry.status !== 'pending_fa_review') {
    return { success: false, error: `Inquiry is not in pending_fa_review state (current: ${inquiry.status})` }
  }

  // Fetch trip for price + title
  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, price_per_person_eur, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  if (trip == null) {
    return { success: false, error: 'Trip not found' }
  }

  const tripPriceEur = (trip.price_per_person_eur ?? 0) * (inquiry.party_size ?? 1)
  // Deposit in cents — always integer, no floats
  const depositCents = Math.round(tripPriceEur * (depositPercent / 100) * 100)

  if (depositCents < 50) {
    // Stripe minimum is €0.50
    return { success: false, error: 'Deposit amount is below Stripe minimum (€0.50)' }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL

  // Dates label for Stripe description
  const requestedDates = inquiry.requested_dates ?? []
  const datesLabel = requestedDates.length > 0
    ? requestedDates.slice(0, 3).join(', ') + (requestedDates.length > 3 ? '…' : '')
    : 'TBD'

  // Create Stripe Checkout session on FA's own account (no transfer_data, no Connect)
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: depositCents,
              product_data: {
                name: `Booking & Curation Fee — ${trip.title}`,
                description: `${depositPercent}% deposit · ${inquiry.party_size} person(s) · ${datesLabel}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: inquiry.angler_email,
        metadata: {
          inquiry_id:   inquiryId,
          trip_id:      inquiry.trip_id,
          payment_type: 'inquiry_deposit',
        },
        success_url: `${baseUrl}/inquiry-confirmed?inquiry_id=${inquiryId}`,
        cancel_url:  `${baseUrl}/trips/${inquiry.trip_id}`,
      },
      {
        idempotencyKey: `deposit-${inquiryId}`,
      },
    )
  } catch (err) {
    console.error('[sendDepositLink] Stripe error:', err)
    return { success: false, error: 'Failed to create Stripe checkout session' }
  }

  // Update inquiry in DB — atomic: if this fails the session was still created
  const { error: updateError } = await svc
    .from('inquiries')
    .update({
      status:                    'deposit_sent',
      deposit_amount:            depositCents / 100,
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[sendDepositLink] DB update error:', updateError)
    // Don't fail — the Checkout URL is still valid; FA can resend
  }

  // Send deposit link email to angler (fire-and-forget)
  sendDepositLinkAnglerEmail({
    to:               inquiry.angler_email,
    anglerName:       inquiry.angler_name,
    tripTitle:        trip.title,
    requestedDates:   requestedDates,
    partySize:        inquiry.party_size ?? 1,
    depositAmountEur: depositCents / 100,
    depositPercent,
    checkoutUrl:      session.url!,
    inquiryId,
  }).catch(err => console.error('[sendDepositLink] Email error:', err))

  console.log(`[sendDepositLink] Deposit link sent for inquiry ${inquiryId} — session ${session.id}`)

  return { success: true, checkoutUrl: session.url! }
}
