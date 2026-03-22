/**
 * Stripe webhook handler — Wave 4B.
 *
 * Handles:
 *   checkout.session.completed → confirm booking or inquiry
 *   charge.refunded            → mark booking refunded
 *
 * Always return 200 to prevent infinite Stripe retries.
 * Verify signature before processing any event.
 */

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { createBookingFromInquiry } from '@/lib/create-booking-from-inquiry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Invalid signature:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  // Always return 200 — log errors internally, do not let Stripe retry logic issues
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      case 'account.updated':
        // Fires when a Custom Connect account's verification status changes.
        // Syncs stripe_charges_enabled + stripe_payouts_enabled to DB.
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      default:
        // Unknown event type — ignore silently
        break
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event.type}:`, err)
    // Return 200 anyway — Stripe should not endlessly retry logic errors
  }

  return new Response('OK', { status: 200 })
}

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = createServiceClient()
  const { bookingId, inquiryId, paymentType } = session.metadata ?? {}

  // ── Balance payment (70% remaining, Stripe path) ───────────────────────────
  if (bookingId && paymentType === 'balance') {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null

    const { data: existing } = await db
      .from('bookings')
      .select('id, status, balance_paid_at')
      .eq('id', bookingId)
      .single()

    if (!existing) {
      console.error(`[webhook] Balance payment: booking ${bookingId} not found`)
      return
    }

    // Idempotency: already completed → skip
    if (existing.status === 'completed' || existing.balance_paid_at != null) {
      console.log(`[webhook] Balance for booking ${bookingId} already recorded — skipping`)
      return
    }

    await db
      .from('bookings')
      .update({
        status:                           'completed',
        balance_paid_at:                  new Date().toISOString(),
        balance_stripe_payment_intent_id: paymentIntentId,
      })
      .eq('id', bookingId)

    console.log(`[webhook] Booking ${bookingId} balance paid — status: completed`)
    return
  }

  // ── Classic booking (30% deposit) ─────────────────────────────────────────
  if (bookingId) {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null

    const { data: existing } = await db
      .from('bookings')
      .select('id, status, stripe_payment_intent_id')
      .eq('id', bookingId)
      .single()

    if (!existing) {
      console.error(`[webhook] Booking ${bookingId} not found`)
      return
    }

    // Idempotency: already confirmed → skip
    if (existing.status === 'confirmed') {
      console.log(`[webhook] Booking ${bookingId} already confirmed — skipping`)
      return
    }

    // Angler paid after guide accepted (destination charge) → confirm immediately.
    await db
      .from('bookings')
      .update({
        status:                   'confirmed',
        confirmed_at:             new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq('id', bookingId)

    console.log(`[webhook] Booking ${bookingId} confirmed — sending emails`)
    // TODO: sendBookingConfirmationEmail(bookingId)
    return
  }

  // ── Inquiry / Icelandic flow ───────────────────────────────────────────────
  if (inquiryId) {
    const { data: existing } = await db
      .from('trip_inquiries')
      .select('id, status')
      .eq('id', inquiryId)
      .single()

    if (!existing) {
      console.error(`[webhook] Inquiry ${inquiryId} not found`)
      return
    }

    if (existing.status === 'confirmed') {
      console.log(`[webhook] Inquiry ${inquiryId} already confirmed — skipping`)
      return
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null

    await db
      .from('trip_inquiries')
      .update({
        status: 'confirmed',
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq('id', inquiryId)

    // Create a real booking record so the chat & booking dashboard work
    await createBookingFromInquiry(inquiryId, db, paymentIntentId)

    console.log(`[webhook] Inquiry ${inquiryId} confirmed — booking created, sending emails`)
    // TODO: sendInquiryConfirmationEmail(inquiryId)
    return
  }

  console.warn('[webhook] checkout.session.completed with no bookingId or inquiryId in metadata')
}

// ─── account.updated ──────────────────────────────────────────────────────────
// Stripe fires this for Custom Connect accounts when KYC verification changes.
// For transfers-only accounts, payouts_enabled becomes true once Stripe approves.

async function handleAccountUpdated(account: Stripe.Account) {
  const db = createServiceClient()

  // Idempotency: only update if there's actually a change to record
  const { data: guide } = await db
    .from('guides')
    .select('id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('stripe_account_id', account.id)
    .single()

  if (!guide) {
    // Account not yet linked to a guide (race condition during setup) — safe to ignore
    return
  }

  const chargesChanged = guide.stripe_charges_enabled !== account.charges_enabled
  const payoutsChanged = guide.stripe_payouts_enabled !== account.payouts_enabled

  if (!chargesChanged && !payoutsChanged) return

  await db
    .from('guides')
    .update({
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
    })
    .eq('stripe_account_id', account.id)

  if (account.payouts_enabled && payoutsChanged) {
    console.log(`[webhook] Guide ${guide.id} Stripe account verified — payouts enabled`)
    // TODO: send "your account is ready" email to guide
  }
}

// ─── charge.refunded ──────────────────────────────────────────────────────────

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  if (!paymentIntentId) return

  const db = createServiceClient()

  // Find by payment_intent_id
  const { data: booking } = await db
    .from('bookings')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (!booking) {
    // Try inquiries
    const { data: inquiry } = await db
      .from('trip_inquiries')
      .select('id, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (inquiry && inquiry.status !== 'cancelled') {
      await db
        .from('trip_inquiries')
        .update({ status: 'cancelled' })
        .eq('id', inquiry.id)
    }
    return
  }

  if (booking.status !== 'refunded') {
    await db.from('bookings').update({ status: 'refunded' }).eq('id', booking.id)
  }
}
