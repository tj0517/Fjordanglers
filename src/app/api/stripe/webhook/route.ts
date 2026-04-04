/**
 * Stripe webhook handler — unified booking model.
 *
 * After the DB unification (2026-04-01), all bookings (direct + inquiry)
 * live in the bookings table. Webhooks only need bookingId — no more
 * separate inquiryId branch.
 *
 * Handles:
 *   checkout.session.completed → confirm booking (deposit OR balance OR offer)
 *   charge.refunded            → mark booking refunded
 *   account.updated            → sync guide Stripe flags
 *
 * Always returns 200 to prevent infinite Stripe retries.
 */

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { unblockBookingDates } from '@/lib/booking-blocks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody  = await req.text()
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

  // Always return 200 — log errors internally
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      default:
        break
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event.type}:`, err)
  }

  return new Response('OK', { status: 200 })
}

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = createServiceClient()
  const { bookingId, paymentType } = session.metadata ?? {}

  if (!bookingId) {
    console.warn('[webhook] checkout.session.completed with no bookingId in metadata')
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  // ── Balance payment (70% remaining, Stripe path) ───────────────────────────
  if (paymentType === 'balance') {
    const { data: existing } = await db
      .from('bookings')
      .select('id, status, balance_paid_at')
      .eq('id', bookingId)
      .single()

    if (!existing) {
      console.error(`[webhook] Balance payment: booking ${bookingId} not found`)
      return
    }

    // Idempotency
    if (existing.status === 'completed' || existing.balance_paid_at != null) {
      console.log(`[webhook] Balance for ${bookingId} already recorded — skipping`)
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

  // ── Deposit / full offer payment ───────────────────────────────────────────
  //
  // Covers both:
  //   - Direct flow:  40% deposit (status: accepted → confirmed)
  //   - Inquiry flow: full offer amount (status: offer_accepted → confirmed)
  //
  const { data: existing } = await db
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, source')
    .eq('id', bookingId)
    .single()

  if (!existing) {
    console.error(`[webhook] Booking ${bookingId} not found`)
    return
  }

  // Idempotency + safety guard: only confirm from statuses that represent
  // "guide accepted, angler hasn't paid yet". Prevents a stale/replayed payment
  // from jumping a 'pending' booking straight to 'confirmed' without guide acceptance.
  const confirmableStatuses = ['accepted', 'offer_accepted']
  if (!confirmableStatuses.includes(existing.status)) {
    if (existing.status === 'confirmed') {
      console.log(`[webhook] Booking ${bookingId} already confirmed — skipping`)
    } else {
      console.warn(
        `[webhook] Booking ${bookingId} has unexpected status '${existing.status}' — skipping confirmation`,
      )
    }
    return
  }

  await db
    .from('bookings')
    .update({
      status:                   'confirmed',
      confirmed_at:             new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', bookingId)

  console.log(`[webhook] Booking ${bookingId} confirmed (source: ${existing.source})`)
  // TODO: sendBookingConfirmationEmail(bookingId)
}

// ─── account.updated ──────────────────────────────────────────────────────────

async function handleAccountUpdated(account: Stripe.Account) {
  const db = createServiceClient()

  const { data: guide } = await db
    .from('guides')
    .select('id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('stripe_account_id', account.id)
    .single()

  if (!guide) return

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
  }
}

// ─── charge.refunded ──────────────────────────────────────────────────────────

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  if (!paymentIntentId) return

  const db = createServiceClient()

  const { data: booking } = await db
    .from('bookings')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (!booking) {
    console.warn(`[webhook] charge.refunded: no booking found for payment_intent ${paymentIntentId}`)
    return
  }

  if (booking.status !== 'refunded') {
    await db
      .from('bookings')
      .update({ status: 'refunded' })
      .eq('id', booking.id)

    // Remove blocked dates created when this booking was accepted
    unblockBookingDates(db, booking.id)
      .catch(e => console.error('[webhook] unblockBookingDates:', e))
  }
}
