/**
 * Stripe webhook handler.
 *
 * Handles:
 *   account.updated            → sync guide Stripe Connect account flags
 *   checkout.session.completed → mark booking fee as paid (Icelandic inquiry flow only)
 *
 * Deposit payments for FA inquiries are handled by /api/webhooks/stripe-deposit.
 * Always returns 200 to prevent infinite Stripe retries.
 */

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const rawBody   = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const connectSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, connectSecret)
    } catch (err) {
      console.error('[webhook] Invalid signature:', err)
      return new Response('Invalid signature', { status: 400 })
    }
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event.type}:`, err)
  }

  return new Response('OK', { status: 200 })
}

// ─── checkout.session.completed ───────────────────────────────────────────────

/**
 * Marks booking fee as paid when Stripe Checkout succeeds.
 *
 * payment_type='booking_fee'  → Icelandic inquiry offer accepted by angler.
 *   Sets balance_paid_at on the booking so the UI can confirm payment.
 *
 * Idempotent: if balance_paid_at is already set, skip gracefully.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Icelandic inquiry flow: booking_id + payment_type='booking_fee'
  const bookingId   = session.metadata?.booking_id
  const paymentType = session.metadata?.payment_type

  if (!bookingId || paymentType !== 'booking_fee') return
  if (session.payment_status !== 'paid') return

  const db = createServiceClient()

  // Idempotency check
  const { data: booking } = await db
    .from('bookings')
    .select('id, balance_paid_at')
    .eq('id', bookingId)
    .single()

  if (booking == null || booking.balance_paid_at != null) return

  await db
    .from('bookings')
    .update({
      balance_paid_at:            new Date().toISOString(),
      balance_stripe_checkout_id: session.id,
    })
    .eq('id', bookingId)

  console.log(`[webhook] Booking fee paid for booking ${bookingId} — session ${session.id}`)
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
}
