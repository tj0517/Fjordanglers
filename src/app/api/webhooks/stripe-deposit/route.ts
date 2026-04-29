/**
 * Stripe deposit webhook — /api/webhooks/stripe-deposit
 *
 * Listens for: checkout.session.completed
 * Identifies inquiry deposit sessions by metadata.payment_type === 'inquiry_deposit'
 *
 * On success:
 *   • inquiries.status  → 'deposit_paid'
 *   • inquiries.deposit_paid_at → now
 *   • Sends emails: angler (confirmation), FA (deposit received), guide (booking confirmed)
 *
 * Idempotent: if deposit_paid_at is already set, returns 200 immediately.
 * Always returns 200 to prevent Stripe retries on non-fatal errors.
 */

import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendDepositConfirmedAnglerEmail,
  sendDepositConfirmedFaEmail,
  sendBookingConfirmedGuideEmail,
} from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const rawBody  = await req.text()
  const sig      = (await headers()).get('stripe-signature')

  if (sig == null) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Use dedicated deposit webhook secret; fall back to main secret in local dev
  const secret =
    env.STRIPE_WEBHOOK_SECRET_DEPOSIT ??
    env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[stripe-deposit/webhook] Invalid signature:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    }
  } catch (err) {
    // Log but always return 200 to prevent retries
    console.error('[stripe-deposit/webhook] Handler error:', err)
  }

  return new Response('OK', { status: 200 })
}

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Only handle inquiry deposit sessions
  if (session.metadata?.payment_type !== 'inquiry_deposit') return
  if (session.payment_status !== 'paid') return

  const inquiryId = session.metadata?.inquiry_id
  if (inquiryId == null) {
    console.warn('[stripe-deposit/webhook] No inquiry_id in session metadata:', session.id)
    return
  }

  const svc = createServiceClient()

  // Idempotency: skip if already processed
  const { data: existing } = await svc
    .from('inquiries')
    .select('id, deposit_paid_at, angler_email, angler_name, angler_country, requested_dates, party_size, deposit_amount, trip_id, guide_id')
    .eq('id', inquiryId)
    .single()

  if (existing == null) {
    console.warn('[stripe-deposit/webhook] Inquiry not found:', inquiryId)
    return
  }

  if (existing.deposit_paid_at != null) {
    console.log('[stripe-deposit/webhook] Already processed inquiry:', inquiryId)
    return
  }

  // Mark as paid
  await svc
    .from('inquiries')
    .update({
      status:                    'deposit_paid',
      deposit_paid_at:           new Date().toISOString(),
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiryId)

  console.log(`[stripe-deposit/webhook] Deposit paid for inquiry ${inquiryId} — session ${session.id}`)

  // Fetch trip + guide details for emails
  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', existing.trip_id)
    .single()

  const { data: guide } = existing.guide_id != null
    ? await svc.from('guides').select('full_name, invite_email').eq('id', existing.guide_id).single()
    : { data: null }

  const tripTitle        = trip?.title          ?? 'Your trip'
  const guideName        = guide?.full_name     ?? 'the guide'
  const guideEmail       = guide?.invite_email  ?? null
  const depositAmountEur = existing.deposit_amount ?? 0
  const requestedDates   = existing.requested_dates ?? []

  // Fire all three confirmation emails (fire-and-forget)
  const emailJobs: Promise<void>[] = [
    sendDepositConfirmedAnglerEmail({
      to:               existing.angler_email,
      anglerName:       existing.angler_name,
      tripTitle,
      requestedDates,
      partySize:        existing.party_size ?? 1,
      depositAmountEur,
      inquiryId,
    }),
    sendDepositConfirmedFaEmail({
      to:               env.FA_EMAIL ?? 'contact@fjordanglers.com',
      anglerName:       existing.angler_name,
      anglerEmail:      existing.angler_email,
      tripTitle,
      requestedDates,
      partySize:        existing.party_size ?? 1,
      depositAmountEur,
      stripeSessionId:  session.id,
      inquiryId,
    }),
  ]

  if (guideEmail != null) {
    emailJobs.push(
      sendBookingConfirmedGuideEmail({
        to:             guideEmail,
        guideName,
        tripTitle,
        anglerName:     existing.angler_name,
        anglerCountry:  existing.angler_country,
        requestedDates,
        partySize:      existing.party_size ?? 1,
        inquiryId,
      }),
    )
  }

  Promise.all(emailJobs).catch(err =>
    console.error('[stripe-deposit/webhook] Email error:', err),
  )
}
