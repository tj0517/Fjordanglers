/**
 * Stripe deposit webhook — /api/webhooks/stripe-deposit
 *
 * Listens for: checkout.session.completed
 * Identifies inquiry deposit sessions by metadata.payment_type === 'inquiry_deposit'
 *
 * Two metadata paths (D1 — FA-1.16):
 *   • Checkout Session (sendDepositLink): metadata on the session itself
 *   • Payment Link (createPaymentLink): session.metadata is empty;
 *     metadata is fetched from the payment link via stripe.paymentLinks.retrieve()
 *
 * On success:
 *   • inquiries.deposit_paid_at, deposit_stripe_session_id — set atomically (D2 — FA-1.16)
 *   • inquiries.status → 'paid', through transition() (source 'webhook')
 *   • Sends emails: angler (confirmation), FA (deposit received), guide (booking confirmed)
 *
 * Idempotent: UPDATE … WHERE deposit_paid_at IS NULL RETURNING id — only the first
 * writer gets a row back; a second delivery sees 0 rows and returns without emitting.
 *
 * Error handling:
 *   • stripe.paymentLinks.retrieve failure → 500 (Stripe retries; safe due to D2)
 *   • All other errors → 200 (logged; no retry needed)
 */

import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEvent } from '@/lib/events/emit'
import { transition } from '@/lib/inquiries/state'
import { getInquiryExperience, tripTitleOf } from '@/lib/inquiries/experience-lookup'
import {
  sendDepositConfirmedAnglerEmail,
  sendDepositConfirmedFaEmail,
  sendBookingConfirmedGuideEmail,
} from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Thrown when a transient Stripe API failure means Stripe should retry the delivery.
class RetriableError extends Error {}

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
    console.error('[stripe-deposit/webhook] Handler error:', err)
    if (err instanceof RetriableError) {
      return new Response('Service Unavailable', { status: 500 })
    }
  }

  return new Response('OK', { status: 200 })
}

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return

  // Resolve metadata: directly from session (Checkout Session path),
  // or from the payment link when session.metadata is empty (Payment Link path — D1).
  //
  // Note (D3 pętla, 21 IX 2026, API 2026-02-25.clover): Stripe copies payment link
  // metadata onto the session, so session.metadata was populated in the live test.
  // The paymentLinks.retrieve branch below is a fallback for older API versions or
  // future Stripe behaviour changes — the logic is correct regardless of which path
  // delivers the metadata.
  let metadata: Stripe.Metadata | null = session.metadata

  if (metadata?.payment_type == null) {
    const paymentLinkId = typeof session.payment_link === 'string' ? session.payment_link : null
    if (paymentLinkId == null) {
      // Neither metadata path: not our session.
      return
    }
    try {
      const link = await stripe.paymentLinks.retrieve(paymentLinkId)
      metadata = link.metadata
    } catch (err) {
      console.error('[stripe-deposit/webhook] Could not retrieve payment link metadata:', session.id, err)
      throw new RetriableError(`Payment link metadata unavailable: ${paymentLinkId}`)
    }
  }

  // Filter: must be an inquiry deposit (applies to both metadata paths).
  if (metadata?.payment_type !== 'inquiry_deposit') return

  const inquiryId = metadata?.inquiry_id
  if (inquiryId == null) {
    console.warn('[stripe-deposit/webhook] No inquiry_id in metadata:', session.id)
    return
  }

  const svc = createServiceClient()

  // Atomic conditional update (D2): sets deposit_paid_at only when currently NULL.
  // If two deliveries race, exactly one writer gets a row back; the other sees empty.
  const { data: updated } = await svc
    .from('inquiries')
    .update({
      deposit_paid_at:           new Date().toISOString(),
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiryId)
    .is('deposit_paid_at', null)
    .select('id, angler_email, angler_name, angler_country, requested_dates, party_size, deposit_amount, trip_id, experience_page_id, guide_id')

  if (!updated || updated.length === 0) {
    // Idempotency guard: already processed, or inquiry_id not found.
    console.log('[stripe-deposit/webhook] Skipped — already processed or not found:', inquiryId)
    return
  }

  const existing = updated[0]

  console.log(`[stripe-deposit/webhook] Deposit paid for inquiry ${inquiryId} — session ${session.id}`)

  try {
    await emitEvent(svc, {
      inquiryId,
      type:    'payment.received',
      actor:   { kind: 'system' },
      source:  'webhook',
      channel: 'stripe',
      payload: {
        stripe_session_id: session.id,
        amount_cents:      session.amount_total ?? 0,
        currency:          session.currency    ?? 'eur',
      },
    })
  } catch (err) {
    console.error('[stripe-deposit/webhook] emitEvent(payment.received) error:', err)
  }

  try {
    await transition(svc, inquiryId, 'paid', {
      actor:   { kind: 'system' },
      source:  'webhook',
      channel: 'stripe',
      reason:  `Stripe checkout session ${session.id} completed`,
    })
  } catch (err) {
    // The deposit is real and recorded in deposit_paid_at; the status is not. Loud,
    // but not fatal — the webhook still returns 200 and the admin can move it by hand.
    console.error('[stripe-deposit/webhook] transition error:', err)
  }

  // Fetch guide details for emails
  const { data: guide } = existing.guide_id != null
    ? await svc.from('guides').select('full_name, invite_email').eq('id', existing.guide_id).single()
    : { data: null }

  // Runs after the payment is recorded; the lookup never throws, so a missing title
  // can only fall back to the generic one, never fail the webhook.
  const tripTitle        = tripTitleOf(await getInquiryExperience({
    experience_page_id: existing.experience_page_id,
    trip_id:            existing.trip_id,
  }))
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
        anglerCountry:  existing.angler_country ?? '—',
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
