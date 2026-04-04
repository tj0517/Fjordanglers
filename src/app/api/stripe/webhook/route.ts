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
import { getAppUrl } from '@/lib/app-url'
import {
  fmtEmailDateRange,
  fmtEmailDays,
  sendBookingConfirmedAnglerEmail,
  sendBookingConfirmedGuideEmail,
  sendBalancePaidAnglerEmail,
} from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody  = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Verify signature — try the regular webhook secret first.
  // Connect events (e.g. account.updated from connected accounts) arrive with the
  // STRIPE_CONNECT_WEBHOOK_SECRET, which is different in production but identical
  // to STRIPE_WEBHOOK_SECRET when using `stripe listen --forward-connect-to` locally.
  // We try both so a single endpoint handles both regular and Connect events.
  let event: Stripe.Event
  const connectSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, connectSecret)
    } catch (err) {
      console.error('[webhook] Invalid signature (tried both secrets):', err)
      return new Response('Invalid signature', { status: 400 })
    }
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

  // ── Guide amount payment (Stripe Connect — step 2) ─────────────────────────
  if (paymentType === 'guide_amount') {
    const { data: existing } = await db
      .from('bookings')
      .select('id, status, guide_amount_paid_at')
      .eq('id', bookingId)
      .single()

    if (!existing) {
      console.error(`[webhook] Guide amount: booking ${bookingId} not found`)
      return
    }

    // Idempotency
    if (existing.guide_amount_paid_at != null) {
      console.log(`[webhook] Guide amount for ${bookingId} already recorded — skipping`)
      return
    }

    await db
      .from('bookings')
      .update({
        guide_amount_paid_at:   new Date().toISOString(),
        guide_amount_stripe_pi_id: paymentIntentId,
      })
      .eq('id', bookingId)

    console.log(`[webhook] Booking ${bookingId} guide amount paid via Stripe Connect`)
    return
  }

  // ── Balance payment (legacy flow — kept for backward compat) ──────────────
  if (paymentType === 'balance') {
    const { data: existing } = await db
      .from('bookings')
      .select('id, status, balance_paid_at, angler_email, angler_full_name, guests, total_eur, confirmed_date_from, confirmed_date_to, confirmed_days, experiences(title), guides(full_name)')
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

    // Email to angler: "trip fully paid"
    {
      const anglerEmail = existing.angler_email as string | null
      if (anglerEmail) {
        const confDays      = existing.confirmed_days as string[] | null
        const confirmedLbl  = confDays && confDays.length > 0
          ? fmtEmailDays(confDays)
          : fmtEmailDateRange(
              (existing.confirmed_date_from as string | null) ?? '',
              (existing.confirmed_date_to   as string | null) ?? '',
            )
        const expTitle  = (existing.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'
        const guideData = existing.guides as unknown as { full_name: string } | null

        sendBalancePaidAnglerEmail({
          to:              anglerEmail,
          anglerName:      (existing.angler_full_name as string | null) ?? anglerEmail,
          experienceTitle: expTitle,
          guideName:       guideData?.full_name ?? 'Your guide',
          confirmedDates:  confirmedLbl,
          guests:          existing.guests as number,
          totalEur:        existing.total_eur as number,
          bookingUrl:      `${await getAppUrl()}/account/bookings/${bookingId}`,
        }).catch(e => console.error('[webhook] balance email:', e))
      }
    }
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
    .select('id, status, stripe_payment_intent_id, source, angler_email, angler_full_name, angler_phone, guests, total_eur, deposit_eur, guide_payout_eur, balance_payment_method, confirmed_date_from, confirmed_date_to, confirmed_days, booking_date, requested_dates, experiences(title), guides(user_id, full_name, iban, iban_holder_name)')
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

  // ── Confirmation emails ────────────────────────────────────────────────────
  {
    const anglerEmail = existing.angler_email as string | null
    if (!anglerEmail) return

    const isInquiry    = existing.source === 'inquiry'
    const confDays     = existing.confirmed_days as string[] | null
    const reqDates     = existing.requested_dates as string[] | null
    const confirmedLbl =
      confDays && confDays.length > 0
        ? fmtEmailDays(confDays)
        : (existing.confirmed_date_from as string | null)
            ? fmtEmailDateRange(
                existing.confirmed_date_from as string,
                (existing.confirmed_date_to as string | null) ?? (existing.confirmed_date_from as string),
              )
            : reqDates && reqDates.length > 0
              ? fmtEmailDateRange(reqDates[0], reqDates[reqDates.length - 1])
              : (existing.booking_date as string | null) ?? ''

    const expTitle   = (existing.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'
    const guideData  = existing.guides as unknown as {
      user_id:         string | null
      full_name:       string
      iban:            string | null
      iban_holder_name: string | null
    } | null

    const totalEur     = existing.total_eur   as number
    const depositEur   = (existing.deposit_eur as number | null) ?? totalEur
    const balanceEur   = isInquiry ? 0 : Math.max(0, Math.round((totalEur - depositEur) * 100) / 100)
    const amountPaid   = isInquiry ? totalEur : depositEur
    const balanceMethod = (existing.balance_payment_method as string | null) as 'stripe' | 'cash' | null

    const appUrl = await getAppUrl()

    // To angler
    sendBookingConfirmedAnglerEmail({
      to:              anglerEmail,
      anglerName:      (existing.angler_full_name as string | null) ?? anglerEmail,
      experienceTitle: expTitle,
      guideName:       guideData?.full_name ?? 'Your guide',
      confirmedDates:  confirmedLbl,
      guests:          existing.guests as number,
      amountPaidEur:   amountPaid,
      isPaidInFull:    isInquiry,
      balanceEur,
      balanceMethod:   isInquiry ? null : balanceMethod,
      guidePayoutEur:  (existing.guide_payout_eur as number | null) ?? 0,
      guideIban:       isInquiry ? null : (guideData?.iban ?? null),
      guideIbanHolder: isInquiry ? null : (guideData?.iban_holder_name ?? null),
      bookingUrl:      `${appUrl}/account/bookings/${bookingId}`,
    }).catch(e => console.error('[webhook] confirmed angler email:', e))

    // To guide
    if (guideData?.user_id) {
      db.auth.admin.getUserById(guideData.user_id)
        .then(({ data }) => {
          const guideEmail = data.user?.email
          if (!guideEmail) return
          return sendBookingConfirmedGuideEmail({
            to:              guideEmail,
            guideName:       guideData.full_name,
            anglerName:      (existing.angler_full_name as string | null) ?? anglerEmail,
            anglerEmail,
            anglerPhone:     (existing.angler_phone as string | null) ?? null,
            experienceTitle: expTitle,
            confirmedDates:  confirmedLbl,
            guests:          existing.guests as number,
            guidePayoutEur:  (existing.guide_payout_eur as number | null) ?? 0,
            isPaidInFull:    isInquiry,
            bookingUrl:      `${appUrl}/dashboard/bookings/${bookingId}`,
          })
        })
        .catch(e => console.error('[webhook] confirmed guide email:', e))
    }
  }
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
