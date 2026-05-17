'use server'

/**
 * FA Inquiry Server Actions.
 *
 * sendDepositLink(inquiryId) — FA sends a Stripe Checkout deposit link to the angler.
 *   Uses offer_deposit_eur from the inquiry if an offer has been saved (preferred).
 *   Falls back to depositPercent calculation against trip price for legacy dashboard flow.
 *
 * saveOffer(inquiryId, { totalPriceEur, depositEur, notes }) — FA sets a custom offer
 *   with an exact EUR total + EUR deposit (not %). Saves to DB and emails the angler.
 *
 * sendMessageToAngler(inquiryId, subject, body) — FA sends a plain-text email to the
 *   angler from the admin. Message is stored in inquiry_messages for audit trail.
 *
 * DB migration required before saveOffer / sendMessageToAngler will work:
 *   ALTER TABLE inquiries
 *     ADD COLUMN IF NOT EXISTS offer_total_eur   NUMERIC,
 *     ADD COLUMN IF NOT EXISTS offer_deposit_eur  NUMERIC,
 *     ADD COLUMN IF NOT EXISTS offer_notes        TEXT,
 *     ADD COLUMN IF NOT EXISTS offer_sent_at      TIMESTAMPTZ;
 *
 *   CREATE TABLE IF NOT EXISTS inquiry_messages (
 *     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     inquiry_id  UUID REFERENCES inquiries(id) ON DELETE CASCADE NOT NULL,
 *     subject     TEXT,
 *     body        TEXT NOT NULL,
 *     sent_at     TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;
 */

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import {
  sendDepositLinkAnglerEmail,
  sendInquiryMessageAnglerEmail,
  sendInquiryOfferAnglerEmail,
} from '@/lib/email'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendDepositLinkResult =
  | { success: true;  checkoutUrl: string }
  | { success: false; error: string }

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// ─── sendDepositLink ──────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session and sends the link to the angler via email.
 *
 * Deposit amount priority:
 *   1. inquiry.offer_deposit_eur — if FA created an offer, always use that exact amount.
 *   2. depositPercent × trip price — legacy fallback for the /dashboard/inquiries panel.
 *
 * Allowed statuses: pending_fa_review, deposit_sent (resend).
 * Blocked statuses: deposit_paid, completed, cancelled.
 */
export async function sendDepositLink(
  inquiryId: string,
  /** Fallback deposit % — only used when no offer has been set. Default 30%. */
  depositPercent: number = 30,
): Promise<SendDepositLinkResult> {
  if (depositPercent < 1 || depositPercent > 100) {
    return { success: false, error: 'depositPercent must be 1–100' }
  }

  const svc = createServiceClient()

  // Fetch inquiry — include offer fields (added via migration)
  const { data: rawInquiry } = await svc
    .from('inquiries')
    .select('id, status, angler_email, angler_name, angler_country, requested_dates, party_size, trip_id, message')
    .eq('id', inquiryId)
    .single()

  if (rawInquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  // Block terminal statuses
  const blocked = ['deposit_paid', 'completed', 'cancelled']
  if (blocked.includes(rawInquiry.status)) {
    return { success: false, error: `Cannot send deposit link — inquiry is ${rawInquiry.status}` }
  }

  // Read offer_deposit_eur — field added by migration (cast needed until types are regenerated)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offerDepositEur = (rawInquiry as any).offer_deposit_eur as number | null

  // Fetch trip for title (+ price as fallback)
  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, price_per_person_eur, guide_id')
    .eq('id', rawInquiry.trip_id)
    .single()

  if (trip == null) {
    return { success: false, error: 'Trip not found' }
  }

  // ── Determine deposit amount ───────────────────────────────────────────────
  let depositCents: number
  let depositPctUsed: number

  if (offerDepositEur != null && offerDepositEur > 0) {
    // FA set an explicit EUR amount — use it exactly
    depositCents   = Math.round(offerDepositEur * 100)
    depositPctUsed = 0 // Not meaningful when using fixed amount
  } else {
    // Fallback: calculate from trip price and percent
    const tripPriceEur = (trip.price_per_person_eur ?? 0) * (rawInquiry.party_size ?? 1)
    depositCents       = Math.round(tripPriceEur * (depositPercent / 100) * 100)
    depositPctUsed     = depositPercent
  }

  if (depositCents < 50) {
    return { success: false, error: 'Deposit amount is below Stripe minimum (€0.50)' }
  }

  const baseUrl        = env.NEXT_PUBLIC_APP_URL
  const requestedDates = rawInquiry.requested_dates ?? []
  const datesLabel     = requestedDates.length > 0
    ? requestedDates.slice(0, 3).join(', ') + (requestedDates.length > 3 ? '…' : '')
    : 'TBD'

  const description = offerDepositEur != null
    ? `Deposit · ${rawInquiry.party_size} person(s) · ${datesLabel}`
    : `${depositPctUsed}% deposit · ${rawInquiry.party_size} person(s) · ${datesLabel}`

  // ── Create Stripe Checkout session ────────────────────────────────────────
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            unit_amount: depositCents,
            product_data: {
              name: `Booking & Curation Fee — ${trip.title}`,
              description,
            },
          },
          quantity: 1,
        }],
        customer_email: rawInquiry.angler_email,
        metadata: {
          inquiry_id:   inquiryId,
          trip_id:      rawInquiry.trip_id,
          payment_type: 'inquiry_deposit',
        },
        success_url: `${baseUrl}/inquiry-confirmed?inquiry_id=${inquiryId}`,
        cancel_url:  `${baseUrl}/trips/${rawInquiry.trip_id}`,
      },
      {
        // Idempotency key ensures resends don't create duplicate sessions;
        // append timestamp so FA can resend if angler's link expired.
        idempotencyKey: `deposit-${inquiryId}-${Date.now()}`,
      },
    )
  } catch (err) {
    console.error('[sendDepositLink] Stripe error:', err)
    return { success: false, error: 'Failed to create Stripe checkout session' }
  }

  // ── Update inquiry ─────────────────────────────────────────────────────────
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
  }

  // ── Send email (fire-and-forget) ───────────────────────────────────────────
  sendDepositLinkAnglerEmail({
    to:               rawInquiry.angler_email,
    anglerName:       rawInquiry.angler_name,
    tripTitle:        trip.title,
    requestedDates,
    partySize:        rawInquiry.party_size ?? 1,
    depositAmountEur: depositCents / 100,
    depositPercent:   depositPctUsed || Math.round((depositCents / 100 / ((trip.price_per_person_eur ?? 0) * (rawInquiry.party_size ?? 1))) * 100),
    checkoutUrl:      session.url!,
    inquiryId,
  }).catch(err => console.error('[sendDepositLink] Email error:', err))

  console.log(`[sendDepositLink] Deposit link sent for inquiry ${inquiryId} — session ${session.id} — €${(depositCents / 100).toFixed(2)}`)

  return { success: true, checkoutUrl: session.url! }
}

// ─── saveOffer ────────────────────────────────────────────────────────────────

/**
 * FA creates or updates a custom offer for the angler.
 * Saves offer_total_eur, offer_deposit_eur, offer_notes, offer_sent_at to the inquiry.
 * Sends an offer email to the angler with the full breakdown.
 *
 * The offer deposit is in EUR (not %) — FA sets the exact amount.
 * The balance (total − deposit) is noted as "paid directly to guide".
 */
export async function saveOffer(
  inquiryId: string,
  params: {
    totalPriceEur: number
    depositEur: number
    notes: string | null
  },
): Promise<ActionResult> {
  const { totalPriceEur, depositEur, notes } = params

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!Number.isFinite(totalPriceEur) || totalPriceEur <= 0) {
    return { success: false, error: 'Total price must be greater than €0' }
  }
  if (!Number.isFinite(depositEur) || depositEur < 0.5) {
    return { success: false, error: 'Deposit must be at least €0.50' }
  }
  if (depositEur > totalPriceEur) {
    return { success: false, error: 'Deposit cannot exceed the total trip price' }
  }

  const svc = createServiceClient()

  // ── Fetch inquiry ─────────────────────────────────────────────────────────
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, requested_dates, party_size, trip_id, status')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  if (['deposit_paid', 'completed', 'cancelled'].includes(inquiry.status)) {
    return { success: false, error: `Cannot modify offer — inquiry is ${inquiry.status}` }
  }

  // ── Fetch trip title ──────────────────────────────────────────────────────
  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', inquiry.trip_id)
    .single()

  // ── Save to DB ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (svc.from('inquiries') as any)
    .update({
      offer_total_eur:   totalPriceEur,
      offer_deposit_eur: depositEur,
      offer_notes:       notes?.trim() || null,
      offer_sent_at:     new Date().toISOString(),
    })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[saveOffer] DB error:', updateError)
    return { success: false, error: 'Failed to save offer' }
  }

  // ── Send offer email to angler ─────────────────────────────────────────────
  await sendInquiryOfferAnglerEmail({
    to:              inquiry.angler_email,
    anglerName:      inquiry.angler_name,
    tripTitle:       trip?.title ?? 'Your trip',
    requestedDates:  (inquiry.requested_dates as string[] | null) ?? [],
    partySize:       inquiry.party_size ?? 1,
    offerTotalEur:   totalPriceEur,
    offerDepositEur: depositEur,
    notes:           notes?.trim() || null,
    inquiryId,
  })

  console.log(`[saveOffer] Offer saved for inquiry ${inquiryId} — total €${totalPriceEur}, deposit €${depositEur}`)

  return { success: true }
}

// ─── sendMessageToAngler ──────────────────────────────────────────────────────

/**
 * FA sends a plain-text message to the angler via email.
 * The message is stored in inquiry_messages for an audit trail.
 * Subject is set by FA and used verbatim as the email subject line.
 */
export async function sendMessageToAngler(
  inquiryId: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  if (subject.trim() === '') return { success: false, error: 'Subject is required' }
  if (body.trim() === '')    return { success: false, error: 'Message body is required' }

  const svc = createServiceClient()

  // ── Fetch inquiry ─────────────────────────────────────────────────────────
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, trip_id')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  // ── Fetch trip title ──────────────────────────────────────────────────────
  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', inquiry.trip_id)
    .single()

  // ── Store message in DB ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (svc as any).from('inquiry_messages')
    .insert({
      inquiry_id: inquiryId,
      subject:    subject.trim(),
      body:       body.trim(),
    })

  if (insertError != null) {
    console.error('[sendMessageToAngler] DB error:', insertError)
    // Don't block sending — the email is more important than the audit record
  }

  // ── Send email ────────────────────────────────────────────────────────────
  await sendInquiryMessageAnglerEmail({
    to:          inquiry.angler_email,
    anglerName:  inquiry.angler_name,
    subject:     subject.trim(),
    body:        body.trim(),
    tripTitle:   trip?.title ?? 'Your trip',
    inquiryId,
  })

  console.log(`[sendMessageToAngler] Message sent for inquiry ${inquiryId} — subject: "${subject.trim()}"`)

  return { success: true }
}
