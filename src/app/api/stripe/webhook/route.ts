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
  const { bookingId, inquiryId } = session.metadata ?? {}

  // ── Classic booking ────────────────────────────────────────────────────────
  if (bookingId) {
    // Idempotency: only update if still pending/accepted (not already confirmed)
    const { data: existing } = await db
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .single()

    if (!existing) {
      console.error(`[webhook] Booking ${bookingId} not found`)
      return
    }

    if (existing.status === 'confirmed') {
      console.log(`[webhook] Booking ${bookingId} already confirmed — skipping`)
      return
    }

    await db
      .from('bookings')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
      })
      .eq('id', bookingId)

    // Placeholder email notifications
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

    await db
      .from('trip_inquiries')
      .update({
        status: 'confirmed',
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
      })
      .eq('id', inquiryId)

    console.log(`[webhook] Inquiry ${inquiryId} confirmed — sending emails`)
    // TODO: sendInquiryConfirmationEmail(inquiryId)
    return
  }

  console.warn('[webhook] checkout.session.completed with no bookingId or inquiryId in metadata')
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
