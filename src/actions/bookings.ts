'use server'

/**
 * Booking Server Actions — unified model.
 *
 * Direct flow (source = 'direct'):
 *   createBookingCheckout → acceptBooking → [angler pays deposit] → confirmed
 *   → markBalancePaid / createBalanceCheckout → completed
 *
 * Inquiry flow (source = 'inquiry'):
 *   createInquiryBooking → [guide reviews] → sendOffer → acceptBookingOffer
 *   → [angler pays full amount] → confirmed → completed
 *
 * Both flows share: declineBooking, sendBookingMessage, markBalancePaid, etc.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { getPaymentModel, calcDepositEur } from '@/lib/payment-model'
import type { Json } from '@/lib/supabase/database.types'

/** Returns the correct base URL — preview deployments use VERCEL_URL, not NEXT_PUBLIC_APP_URL. */
function getAppUrl(): string {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return env.NEXT_PUBLIC_APP_URL
}
import {
  type PriceTier,
  findApplicableTierPrice,
  validatePriceTiers,
} from '@/lib/inquiry-pricing'
import {
  blockBookingDates,
  unblockBookingDates,
  expandBookingDateRange,
} from '@/lib/booking-blocks'

// ─── Input schema ─────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  experienceId: z.string().uuid(),
  // Availability window boundaries (angler's "when can you come")
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, 'Select at least one date'),
  // Actual trip duration in days — price is based on this, NOT dates.length
  numDays: z.number().int().min(1).max(30).optional(),
  guests: z.number().int().min(1).max(50),
  durationOptionLabel: z.string().optional(),
  anglerName: z.string().max(100).optional(),
  anglerEmail: z.string().email('Valid email required'),
  anglerPhone: z.string().optional(),
  anglerCountry: z.string().optional(),
  specialRequests: z.string().max(1000).optional(),
  marketingConsent: z.boolean().optional(),
})

type CreateBookingInput = z.infer<typeof createBookingSchema>

// ─── createBookingCheckout ────────────────────────────────────────────────────
//
// Creates a DB booking row and returns bookingId.
// No payment at this stage — payment happens only after guide accepts.
//
// Flow for all booking types:
//   1. Angler submits → DB row (status: pending)
//   2. Guide accepts → acceptBooking() → Stripe Checkout (destination charge)
//   3. Angler pays  → webhook → status: confirmed

export async function createBookingCheckout(
  input: CreateBookingInput,
): Promise<{ bookingId: string } | { error: string }> {
  // ── Auth (optional — guest bookings allowed) ──────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Validate ──────────────────────────────────────────────────────────────
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    experienceId,
    dates,
    numDays,
    guests,
    durationOptionLabel,
    anglerName,
    anglerEmail,
    anglerPhone,
    anglerCountry,
    specialRequests,
    marketingConsent,
  } = parsed.data

  // Use explicit numDays (trip duration) if provided; fall back to dates.length
  // for backward compat with any legacy calls that send individual date arrays.
  const tripDays = numDays ?? dates.length

  // ── Fetch experience + guide ───────────────────────────────────────────────
  const { data: experience } = await supabase
    .from('experiences')
    .select(
      'id, title, price_per_person_eur, max_guests, guide_id, guides(id, full_name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, pricing_model, commission_rate)',
    )
    .eq('id', experienceId)
    .eq('published', true)
    .single()

  if (!experience) return { error: 'Experience not found or no longer available.' }

  const guideRaw = experience.guides as unknown as {
    id: string
    full_name: string
    stripe_account_id: string | null
    stripe_charges_enabled: boolean | null
    stripe_payouts_enabled: boolean | null
    pricing_model: string
    commission_rate: number
  } | null

  if (!guideRaw) return { error: 'Guide not found.' }

  // ── Validate guests ────────────────────────────────────────────────────────
  const maxGuests = experience.max_guests ?? 20
  if (guests > maxGuests) {
    return { error: `Maximum ${maxGuests} guests allowed for this experience.` }
  }

  // ── Derive payment model ───────────────────────────────────────────────────
  const paymentModel = getPaymentModel({
    stripe_account_id:       guideRaw.stripe_account_id,
    stripe_charges_enabled:  guideRaw.stripe_charges_enabled,
    stripe_payouts_enabled:  guideRaw.stripe_payouts_enabled,
  })

  // ── Calculate pricing ─────────────────────────────────────────────────────
  const pricePerPerson = experience.price_per_person_eur ?? 0
  const subtotal = Math.round(pricePerPerson * guests * tripDays * 100) / 100
  const serviceFee = Math.round(subtotal * 0.05 * 100) / 100 // 5% angler-side fee
  const totalEur = Math.round((subtotal + serviceFee) * 100) / 100
  const commissionRate = guideRaw.commission_rate ?? env.PLATFORM_COMMISSION_RATE
  const platformFeeEur = Math.round(subtotal * commissionRate * 100) / 100
  const guidePayoutEur = Math.round((subtotal - platformFeeEur) * 100) / 100
  // manual: angler pays only platform fee via Stripe, pays guide directly
  // stripe_connect: angler pays 40% deposit via Stripe (balance due before trip)
  const depositEur = calcDepositEur(subtotal, commissionRate, paymentModel)

  // ── Insert booking row ────────────────────────────────────────────────────
  const serviceClient = createServiceClient()

  const { data: booking, error: insertError } = await serviceClient
    .from('bookings')
    .insert({
      experience_id: experienceId,
      angler_id: user?.id ?? null,
      angler_email: anglerEmail,
      guide_id: guideRaw.id,
      booking_date: dates[0], // primary date (first selected)
      requested_dates: dates, // all selected dates
      guests,
      total_eur: totalEur,
      platform_fee_eur: platformFeeEur,
      guide_payout_eur: guidePayoutEur,
      deposit_eur: depositEur,
      commission_rate: commissionRate,
      angler_full_name: anglerName ?? null,
      angler_country: anglerCountry ?? null,
      angler_phone: anglerPhone ?? null,
      special_requests: specialRequests ?? null,
      duration_option: durationOptionLabel ?? null,
      marketing_consent: marketingConsent ?? false,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !booking) {
    console.error('[createBookingCheckout] insert error:', insertError)
    return { error: 'Failed to create booking. Please try again.' }
  }

  return { bookingId: booking.id }
}

// ─── sendBookingMessage ───────────────────────────────────────────────────────

/**
 * Send a message within a booking's chat thread.
 * Both the angler and the guide for the booking may send.
 */
export type SentMessage = {
  id: string
  body: string
  sender_id: string
  created_at: string
}

export async function sendBookingMessage(
  bookingId: string,
  body: string,
): Promise<{ error?: string; message?: SentMessage }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Message cannot be empty.' }
  if (trimmed.length > 2000) return { error: 'Message is too long (max 2000 characters).' }

  // Verify the caller is the angler or guide for this booking (RLS does this too,
  // but we want a friendly error rather than a silent DB reject).
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, angler_id, angler_email, guide_id, guides(user_id)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }

  const guide = booking.guides as unknown as { user_id: string } | null
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const userEmail = authUser?.email

  const isAngler =
    booking.angler_id === user.id ||
    (userEmail != null && booking.angler_email === userEmail)
  const isGuide  = guide?.user_id === user.id

  if (!isAngler && !isGuide) return { error: 'You do not have access to this booking.' }

  // Insert and return the created row so the client can replace the optimistic placeholder
  const { data: msg, error } = await supabase
    .from('booking_messages')
    .insert({ booking_id: bookingId, sender_id: user.id, body: trimmed })
    .select('id, body, sender_id, created_at')
    .single()

  if (error || !msg) {
    console.error('[sendBookingMessage]', error)
    return { error: 'Failed to send message. Please try again.' }
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`)
  revalidatePath(`/account/bookings/${bookingId}`)
  return { message: { id: msg.id, body: msg.body, sender_id: msg.sender_id, created_at: msg.created_at } }
}

// ─── acceptBooking ────────────────────────────────────────────────────────────
//
// Guide accepts a pending booking:
//   → Stripe Checkout created (destination charge: Stripe auto-splits on payment)
//   → status: 'accepted'
//   → Angler receives PayDepositBanner → pays deposit → webhook → 'confirmed'
//
// 40% deposit now, 60% balance before the trip.
// application_fee = proportional platform fee (service fee + commission).

export async function acceptBooking(
  bookingId: string,
  options?: {
    confirmedDays?:     string[]   // guide-picked individual days (multi-day picker)
    confirmedDateFrom?: string     // legacy / booking-actions fallback
    confirmedDateTo?:   string
    guideNote?:         string
    customTotalEur?:    number     // guide-set total override (angler-facing, incl. service fee)
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, default_balance_payment_method')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  // Derive payment model from guide's current Stripe status
  const guidePaymentModel = getPaymentModel({
    stripe_account_id:       guide.stripe_account_id,
    stripe_charges_enabled:  guide.stripe_charges_enabled,
    stripe_payouts_enabled:  guide.stripe_payouts_enabled,
  })

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, guide_id, total_eur, platform_fee_eur, guide_payout_eur, angler_email, stripe_checkout_id, guests, commission_rate, experience_id, requested_dates, booking_date, offer_days, offer_date_from, offer_date_to, experiences(title, price_per_person_eur)')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'pending') {
    return { error: 'Only pending bookings can be accepted.' }
  }

  // ── Recalculate pricing if guide confirmed specific days or set custom total ─
  const confirmedDays = options?.confirmedDays
  let effectiveTotalEur       = booking.total_eur
  let effectiveGuidePayoutEur = booking.guide_payout_eur
  let pricingUpdate: Partial<{ total_eur: number; guide_payout_eur: number; deposit_eur: number; platform_fee_eur: number }> = {}

  if (options?.customTotalEur != null && options.customTotalEur > 0) {
    // Guide manually set the total — back-calculate payout/fee (total includes 5% service fee)
    effectiveTotalEur       = Math.round(options.customTotalEur * 100) / 100
    const subtotal          = effectiveTotalEur / 1.05
    const platformFeeEur    = Math.round(subtotal * booking.commission_rate * 100) / 100
    effectiveGuidePayoutEur = Math.round((subtotal - platformFeeEur) * 100) / 100
    const depositEur        = calcDepositEur(subtotal, booking.commission_rate, guidePaymentModel)
    pricingUpdate = {
      total_eur:        effectiveTotalEur,
      guide_payout_eur: effectiveGuidePayoutEur,
      deposit_eur:      depositEur,
      platform_fee_eur: platformFeeEur,
    }
  } else if (confirmedDays && confirmedDays.length > 0) {
    const exp = booking.experiences as unknown as { title: string; price_per_person_eur: number | null } | null
    const pricePerPerson = exp?.price_per_person_eur
    if (pricePerPerson != null && booking.guests > 0) {
      const numDays        = confirmedDays.length
      const subtotal       = Math.round(pricePerPerson * booking.guests * numDays * 100) / 100
      const serviceFee     = Math.round(subtotal * 0.05 * 100) / 100
      effectiveTotalEur    = Math.round((subtotal + serviceFee) * 100) / 100
      const platformFeeEur = Math.round(subtotal * booking.commission_rate * 100) / 100
      effectiveGuidePayoutEur = Math.round((subtotal - platformFeeEur) * 100) / 100
      const depositEur     = calcDepositEur(subtotal, booking.commission_rate, guidePaymentModel)
      pricingUpdate = {
        total_eur:        effectiveTotalEur,
        guide_payout_eur: effectiveGuidePayoutEur,
        deposit_eur:      depositEur,
        platform_fee_eur: platformFeeEur,
      }
    }
  }

  // ── Stripe Checkout ────────────────────────────────────────────────────────
  //
  // manual model:
  //   Charge = platformFeeEur + serviceFeeEur (platform's full cut in one go)
  //   Angler pays guide directly (cash / IBAN) for the remainder
  //
  // stripe_connect model:
  //   Charge = 40% deposit of (tripTotal + serviceFee)
  //   Remaining 60% collected before the trip

  let stripeCheckoutId: string | null = null

  if (!booking.stripe_checkout_id) {
    try {
      const experienceTitle =
        (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

      let chargeCents: number
      let lineItemName: string
      let lineItemDesc: string

      if (guidePaymentModel === 'manual') {
        // manual: charge platform fee + service fee only
        const serviceFeeEur = Math.round((effectiveTotalEur - effectiveTotalEur / 1.05) * 100) / 100
        const platformFeeEur = booking.platform_fee_eur ?? 0
        const payNowEur = Math.round((platformFeeEur + serviceFeeEur) * 100) / 100
        chargeCents   = Math.round(payNowEur * 100)
        lineItemName  = `${experienceTitle} — Platform fee`
        lineItemDesc  = 'Platform & service fee to confirm your booking. You\'ll pay the guide\'s fee directly (cash or bank transfer).'
      } else {
        // stripe_connect: 40% deposit
        chargeCents   = Math.round(calcDepositEur(effectiveTotalEur / 1.05, booking.commission_rate, 'stripe_connect') * 100)
        lineItemName  = `${experienceTitle} — Deposit`
        lineItemDesc  = 'Deposit to confirm your booking. Remaining balance is due before the trip.'
      }

      // Stripe minimum: €0.50 for EUR charges.
      // For PLN-based Stripe accounts the effective minimum is ~200 grosz ≈ €0.47.
      // We use 100 cents (€1.00) as a safe floor so test bookings / very cheap trips
      // never reach Stripe at all.  The booking is still accepted; Checkout is skipped
      // and can be created later by the admin if needed.
      if (chargeCents < 100) {
        console.warn(
          `[acceptBooking] charge ${chargeCents}¢ below safe minimum — skipping Checkout for booking ${bookingId}`,
        )
      } else {
        const session = await stripe.checkout.sessions.create(
          {
            mode:                 'payment',
            payment_method_types: ['card'],
            customer_email:       booking.angler_email ?? undefined,
            line_items: [
              {
                price_data: {
                  currency:     'eur',
                  product_data: {
                    name:        lineItemName,
                    description: lineItemDesc,
                  },
                  unit_amount: chargeCents,
                },
                quantity: 1,
              },
            ],
            metadata:    { bookingId, guideId: guide.id, paymentModel: guidePaymentModel },
            success_url: `${getAppUrl()}/account/bookings/${bookingId}?status=paid`,
            cancel_url:  `${getAppUrl()}/account/bookings/${bookingId}`,
            payment_intent_data: { metadata: { bookingId, paymentModel: guidePaymentModel } },
          },
          { idempotencyKey: `booking-accept-${bookingId}` },
        )

        stripeCheckoutId = session.id
      }
    } catch (err) {
      console.error('[acceptBooking] Stripe Checkout error:', err)
      // Non-fatal: accept without payment link, admin can create checkout manually
    }
  } else {
    stripeCheckoutId = booking.stripe_checkout_id
  }

  // For manual model, guide collects the balance directly from the angler — set to cash.
  const balanceMethod = guidePaymentModel === 'manual'
    ? 'cash'
    : (guide.default_balance_payment_method ?? 'cash') as 'stripe' | 'cash'

  const { error } = await serviceClient
    .from('bookings')
    .update({
      status:                  'accepted',
      accepted_at:             new Date().toISOString(),
      balance_payment_method:  balanceMethod,
      ...(stripeCheckoutId != null ? { stripe_checkout_id: stripeCheckoutId } : {}),
      // Trip start date: first confirmed day takes priority, then legacy confirmedDateFrom
      ...(confirmedDays?.[0]          ? { booking_date: confirmedDays[0] } :
          options?.confirmedDateFrom  ? { booking_date: options.confirmedDateFrom } : {}),
      // Overwrite requested_dates with guide-confirmed days so the calendar always
      // shows the actual confirmed dates — not the angler's original availability window.
      // Only applied when guide explicitly picked days; otherwise leave angler dates intact.
      ...(confirmedDays != null && confirmedDays.length > 0
        ? { requested_dates: confirmedDays }
        : {}),
      // Updated pricing when guide confirmed specific days
      ...pricingUpdate,
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[acceptBooking]', error)
    return { error: 'Failed to accept booking.' }
  }

  // ── Block calendar dates ───────────────────────────────────────────────────
  // Write rows to experience_blocked_dates so all calendars use one source of truth.
  //
  // Fallback priority (most → least specific):
  //   1. confirmedDays   — guide explicitly picked days in the accept form
  //   2. offer_days      — guide picked exact days when sending the offer
  //   3. requested_dates — individual dates the angler selected (never an envelope)
  //   4. offer range     — guide's offered range (last resort; range may be broad)
  {
    const bookingOfferDays   = booking.offer_days as string[] | null
    const bookingReqDates    = booking.requested_dates as string[] | null
    const bookingOfferFrom   = booking.offer_date_from as string | null
    const bookingOfferTo     = booking.offer_date_to   as string | null

    const datesToBlock =
      confirmedDays != null && confirmedDays.length > 0
        ? confirmedDays
        : bookingOfferDays != null && bookingOfferDays.length > 0
          ? bookingOfferDays
          : bookingReqDates != null && bookingReqDates.length > 0
            ? bookingReqDates
            : expandBookingDateRange(bookingOfferFrom, bookingOfferTo)

    if (datesToBlock.length > 0) {
      // Pass experience_id so blocking respects calendar boundaries:
      // only sibling experiences in the same named calendar get blocked.
      blockBookingDates(serviceClient, bookingId, booking.guide_id!, datesToBlock, booking.experience_id ?? undefined)
        .catch(e => console.error('[acceptBooking] blockBookingDates:', e))
    }
  }

  // ── Guide note → booking chat ─────────────────────────────────────────────
  {
    const fmtD = (d: string) => {
      try {
        return new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
        })
      } catch { return d }
    }

    const manualNote = options?.guideNote?.trim() ?? ''
    let body = ''

    if (confirmedDays && confirmedDays.length > 0) {
      // Multi-day: list every confirmed day
      const n = confirmedDays.length
      const dayLines = confirmedDays.map(d => `• ${fmtD(d)}`).join('\n')
      body = `✅ Booking accepted!\n\n📅 Trip days confirmed (${n} day${n !== 1 ? 's' : ''}):\n${dayLines}`
      if (Object.keys(pricingUpdate).length > 0) {
        body += `\n\n💰 Updated total: €${effectiveTotalEur}`
      }
      if (manualNote) body += `\n\n${manualNote}`
    } else if (options?.confirmedDateFrom) {
      // Legacy single-date (from old BookingActions component)
      body = `✅ Booking accepted! Trip date confirmed: ${fmtD(options.confirmedDateFrom)}`
      if (manualNote) body += `\n\n${manualNote}`
    } else if (manualNote) {
      body = manualNote
    } else {
      // No dates, no note — still send acceptance notice
      body = '✅ Booking accepted! I\'ll be in touch to confirm the exact dates.'
    }

    try {
      await serviceClient
        .from('booking_messages')
        .insert({ booking_id: bookingId, sender_id: user.id, body })
    } catch (msgErr) {
      // Non-fatal — booking is accepted; message failure doesn't block confirmation
      console.error('[acceptBooking] Failed to send guide note:', msgErr)
    }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath(`/dashboard/bookings/${bookingId}`)
  revalidatePath(`/account/bookings/${bookingId}`)
  return {}
}

// ─── renewDepositCheckout ─────────────────────────────────────────────────────
//
// Called when the angler's Stripe Checkout session has expired (24h Stripe limit).
// Creates a fresh destination-charge session and updates the DB.
// Only valid for 'accepted' bookings (guide has already confirmed).

export async function renewDepositCheckout(
  bookingId: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select(
      'id, status, angler_id, total_eur, deposit_eur, guide_payout_eur, angler_email, guide_id, experiences(title), guides(stripe_account_id, stripe_payouts_enabled)',
    )
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .eq('status', 'accepted')
    .single()

  if (!booking) return { error: 'Booking not found or not ready for payment.' }

  const experienceTitle =
    (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

  const depositCents = Math.round((booking.deposit_eur ?? Math.round(booking.total_eur * 0.4)) * 100)

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      customer_email:       booking.angler_email ?? undefined,
      line_items: [
        {
          price_data: {
            currency:     'eur',
            product_data: {
              name:        `${experienceTitle} — Deposit`,
              description: 'Deposit to confirm your booking. Remaining balance is due before the trip.',
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      metadata:            { bookingId, guideId: booking.guide_id },
      success_url: `${getAppUrl()}/account/bookings/${bookingId}?status=paid`,
      cancel_url:  `${getAppUrl()}/account/bookings/${bookingId}`,
      // No transfer_data — full amount stays on platform; admin sends payout manually.
      payment_intent_data: {
        metadata:               { bookingId },
      },
    })

    // Update DB with fresh checkout ID (overwrites the expired one)
    await serviceClient
      .from('bookings')
      .update({ stripe_checkout_id: session.id })
      .eq('id', bookingId)

    return { url: session.url! }
  } catch (err) {
    console.error('[renewDepositCheckout]', err)
    return { error: 'Failed to create payment session — please try again.' }
  }
}

// ─── declineBooking ───────────────────────────────────────────────────────────
//
// Handles three states:
//  'pending'  no payment     → just cancel (no money moved)
//  'accepted' + checkout_id  → guide accepted, angler hasn't paid → expire Checkout session
//  'confirmed'+ payment_intent → angler paid (destination charge) → refund + auto-reverses transfer
//
// Optional `alternatives.from / .to` — guide proposes new dates.
// Auto-composes a chat message sent to the angler with the suggested window.

export async function declineBooking(
  bookingId: string,
  reason?: string,
  alternatives?: { from: string; to: string },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, guide_id, stripe_checkout_id, stripe_payment_intent_id')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }

  const declineable = ['pending', 'reviewing', 'offer_sent', 'offer_accepted', 'accepted', 'confirmed']
  if (!declineable.includes(booking.status)) {
    return { error: 'This booking cannot be declined at its current status.' }
  }

  // ── Stripe cleanup ────────────────────────────────────────────────────────

  if (booking.status === 'accepted' && booking.stripe_checkout_id) {
    // Icelandic — guide accepted, angler hasn't paid yet → expire so they can't complete
    try {
      await stripe.checkout.sessions.expire(booking.stripe_checkout_id)
    } catch (err) {
      // Session may already be expired — not fatal
      console.warn('[declineBooking] Could not expire checkout session:', err)
    }
  }

  if (booking.status === 'confirmed' && booking.stripe_payment_intent_id) {
    // Icelandic confirmed (destination charge) — refund auto-reverses the transfer to guide
    try {
      await stripe.refunds.create({
        payment_intent:   booking.stripe_payment_intent_id,
        reason:           'requested_by_customer',
        reverse_transfer: true, // explicit for destination charges
      })
    } catch (err) {
      console.error('[declineBooking] Stripe refund error:', err)
      return { error: 'Failed to refund payment — please contact support.' }
    }
  }

  const { error } = await serviceClient
    .from('bookings')
    .update({
      status:          'declined',
      declined_at:     new Date().toISOString(),
      declined_reason: reason ?? null,
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[declineBooking]', error)
    return { error: 'Failed to decline booking.' }
  }

  // ── Unblock calendar dates ─────────────────────────────────────────────────
  unblockBookingDates(serviceClient, bookingId)
    .catch(e => console.error('[declineBooking] unblockBookingDates:', e))

  // ── Auto-compose alternatives message → booking chat ──────────────────────
  if (alternatives?.from && alternatives?.to) {
    const fmt = (d: string) => {
      try {
        return new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
        })
      } catch { return d }
    }

    const datesStr =
      alternatives.from === alternatives.to
        ? fmt(alternatives.from)
        : `${fmt(alternatives.from)} – ${fmt(alternatives.to)}`

    const reasonPart = reason?.trim()
      ? `Unfortunately those dates don't work for me — ${reason.trim().replace(/\.$/, '')}.\n\n`
      : `Unfortunately I'm unable to take the booking for those dates.\n\n`

    const autoMessage =
      `${reasonPart}📅 I'm available on: ${datesStr}\n\n` +
      `Feel free to send a new booking request for those dates, or message me here if you'd like to discuss other options.`

    try {
      await serviceClient
        .from('booking_messages')
        .insert({ booking_id: bookingId, sender_id: user.id, body: autoMessage })
    } catch (msgErr) {
      // Non-fatal — decline has already gone through
      console.error('[declineBooking] Failed to send alternatives message:', msgErr)
    }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath(`/dashboard/bookings/${bookingId}`)
  revalidatePath(`/account/bookings/${bookingId}`)
  return {}
}

// ─── createBalanceCheckout ────────────────────────────────────────────────────
//
// Angler pays the remaining 70% balance via Stripe.
// Manual payout model — full amount stays on platform; admin sends payout to guide.
// Idempotency: if a balance checkout already exists and is open, returns its URL.

export async function createBalanceCheckout(
  bookingId: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select(
      'id, status, angler_id, total_eur, angler_email, guide_id, balance_payment_method, balance_paid_at, balance_stripe_checkout_id, experiences(title)',
    )
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .eq('status', 'confirmed')
    .single()

  if (!booking) return { error: 'Booking not found or not ready for balance payment.' }
  if (booking.balance_payment_method !== 'stripe') return { error: 'This booking uses cash payment.' }
  if (booking.balance_paid_at != null) return { error: 'Balance already paid.' }

  // Idempotency: if a Checkout session already exists and is still open, return its URL
  if (booking.balance_stripe_checkout_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.balance_stripe_checkout_id)
      if (existing.status === 'open' && existing.url) {
        return { url: existing.url }
      }
    } catch {
      // Session expired or invalid — fall through to create a new one
    }
  }

  const experienceTitle =
    (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

  const balanceCents = Math.round(booking.total_eur * 0.7 * 100)

  if (balanceCents < 100) {
    return { error: 'Balance amount is too small to process via Stripe — please collect payment directly.' }
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode:                 'payment',
        payment_method_types: ['card'],
        customer_email:       booking.angler_email ?? undefined,
        line_items: [
          {
            price_data: {
              currency:     'eur',
              product_data: {
                name:        `${experienceTitle} — Remaining Balance`,
                description: 'Remaining 70% balance for your confirmed fishing trip.',
              },
              unit_amount: balanceCents,
            },
            quantity: 1,
          },
        ],
        metadata: { bookingId, guideId: booking.guide_id, paymentType: 'balance' },
        success_url: `${getAppUrl()}/account/bookings/${bookingId}?status=balance_paid`,
        cancel_url:  `${getAppUrl()}/account/bookings/${bookingId}`,
        // No transfer_data — full amount stays on platform; admin sends payout manually.
        payment_intent_data: {
          metadata: { bookingId, paymentType: 'balance' },
        },
      },
      { idempotencyKey: `booking-balance-${bookingId}` },
    )

    await serviceClient
      .from('bookings')
      .update({ balance_stripe_checkout_id: session.id })
      .eq('id', bookingId)

    return { url: session.url! }
  } catch (err) {
    console.error('[createBalanceCheckout]', err)
    return { error: 'Failed to create payment session — please try again.' }
  }
}

// ─── markBalancePaid ──────────────────────────────────────────────────────────
//
// Guide confirms receipt of cash balance.
// Only valid for confirmed bookings with balance_payment_method === 'cash'.

export async function markBalancePaid(
  bookingId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, guide_id, balance_payment_method, balance_paid_at')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'confirmed') return { error: 'Only confirmed bookings can be marked as paid.' }
  if (booking.balance_payment_method !== 'cash') return { error: 'This booking is set to Stripe payment — cannot mark manually.' }
  if (booking.balance_paid_at != null) return { error: 'Balance already marked as paid.' }

  const { error } = await serviceClient
    .from('bookings')
    .update({
      balance_paid_at: new Date().toISOString(),
      status:          'completed',
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[markBalancePaid]', error)
    return { error: 'Failed to mark balance as paid.' }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath(`/dashboard/bookings/${bookingId}`)
  return {}
}

// ─── mockConfirmDeposit ───────────────────────────────────────────────────────
//
// DEV / TEST ONLY — simulates the Stripe webhook that confirms a booking.
// Directly sets status = 'confirmed' without any Stripe interaction.
// Use this when guide has no Stripe account connected yet.

export async function mockConfirmDeposit(
  bookingId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, angler_id')
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'accepted') return { error: 'Booking must be in accepted state.' }

  const { error } = await serviceClient
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)

  if (error) {
    console.error('[mockConfirmDeposit]', error)
    return { error: 'Failed to confirm booking.' }
  }

  revalidatePath('/account/bookings')
  revalidatePath(`/account/bookings/${bookingId}`)
  return {}
}

// ─── mockCompleteBalance ──────────────────────────────────────────────────────
//
// DEV / TEST ONLY — simulates balance payment without Stripe.
// Directly sets status = 'completed' and balance_paid_at = now().

export async function mockCompleteBalance(
  bookingId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, angler_id, balance_paid_at')
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'confirmed') return { error: 'Booking must be in confirmed state.' }
  if (booking.balance_paid_at != null) return { error: 'Balance already paid.' }

  const { error } = await serviceClient
    .from('bookings')
    .update({ status: 'completed', balance_paid_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) {
    console.error('[mockCompleteBalance]', error)
    return { error: 'Failed to complete balance payment.' }
  }

  revalidatePath('/account/bookings')
  revalidatePath(`/account/bookings/${bookingId}`)
  return {}
}

// ─── updateBalancePaymentMethod ───────────────────────────────────────────────
//
// Guide sets their default balance payment method (stripe | cash).
// Applied to future bookings when acceptBooking() is called.

export async function updateBalancePaymentMethod(
  method: 'stripe' | 'cash',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  if (method !== 'stripe' && method !== 'cash') {
    return { error: 'Invalid payment method.' }
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('guides')
    .update({ default_balance_payment_method: method })
    .eq('user_id', user.id)

  if (error) {
    console.error('[updateBalancePaymentMethod]', error)
    return { error: 'Failed to update balance payment method.' }
  }

  revalidatePath('/dashboard/account')
  return {}
}

// ─── updateGuideIban ──────────────────────────────────────────────────────────
//
// Guide saves their IBAN for the manual payment model.
// Used when a guide hasn't connected Stripe (or is in an unsupported country).
// Anglers are shown this IBAN after booking confirmation to pay the guide's net
// amount directly (the platform fee is collected via Stripe Direct Charge).

const updateGuideIbanSchema = z.object({
  iban:             z.string().max(34).optional().nullable(),
  iban_holder_name: z.string().max(100).optional().nullable(),
  iban_bic:         z.string().max(11).optional().nullable(),
  iban_bank_name:   z.string().max(100).optional().nullable(),
})

export async function updateGuideIban(
  data: z.infer<typeof updateGuideIbanSchema>,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = updateGuideIbanSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('guides')
    .update({
      iban:             parsed.data.iban             ?? null,
      iban_holder_name: parsed.data.iban_holder_name ?? null,
      iban_bic:         parsed.data.iban_bic         ?? null,
      iban_bank_name:   parsed.data.iban_bank_name   ?? null,
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[updateGuideIban]', error)
    return { error: 'Failed to save bank details.' }
  }

  revalidatePath('/dashboard/account')
  return {}
}

// ─── updateAcceptedPaymentMethods ─────────────────────────────────────────────
//
// Guide sets which payment methods they accept from anglers (cash, online/Stripe).
// Multi-select — at least one must be selected.
// Shown publicly on guide profile and trip pages.

// ═══════════════════════════════════════════════════════════════════════════════
// INQUIRY FLOW — source = 'inquiry'
// ═══════════════════════════════════════════════════════════════════════════════

// ─── createInquiryBooking ─────────────────────────────────────────────────────
//
// Angler submits a custom trip request (was: submitInquiry in inquiries.ts).
// Creates a booking row with source='inquiry', status='pending'.
// No payment at this stage — guide reviews and sends an offer.

const createInquirySchema = z.object({
  anglerName:       z.string().min(1, 'Name is required').max(100),
  anglerEmail:      z.string().email('Valid email required'),
  datesFrom:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  datesTo:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  targetSpecies:    z.array(z.string()).min(1, 'Select at least one species'),
  experienceLevel:  z.enum(['beginner', 'intermediate', 'expert']),
  groupSize:        z.number().int().min(1).max(50),
  preferences:      z.object({
    durationType:         z.enum(['half_day', 'full_day', 'multi_day']).optional(),
    numDays:              z.number().int().min(1).max(30).optional(),
    flexibleDates:        z.boolean().optional(),
    preferredMonths:      z.array(z.string()).optional(),
    hasBeginners:         z.boolean().optional(),
    hasChildren:          z.boolean().optional(),
    gearNeeded:           z.enum(['own', 'need_some', 'need_all']).optional(),
    accommodation:        z.union([z.boolean(), z.enum(['needed', 'not_needed', 'flexible'])]).optional(),
    transport:            z.enum(['need_pickup', 'self_drive', 'flexible']).optional(),
    boatPreference:       z.string().max(200).optional(),
    dietaryRestrictions:  z.string().max(500).optional(),
    stayingAt:            z.string().max(200).optional(),
    photographyPackage:   z.boolean().optional(),
    regionExperience:     z.string().max(500).optional(),
    budgetMin:            z.number().optional(),
    budgetMax:            z.number().optional(),
    allDatePeriods:       z.array(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).optional(),
    selectedPackageLabel: z.string().max(200).optional(),
    riverType:            z.string().optional(),
    notes:                z.string().max(2000).optional(),
  }).default({}),
  guideId: z.string().uuid().optional(),
})

export async function createInquiryBooking(
  formData: z.infer<typeof createInquirySchema>,
): Promise<{ bookingId: string } | { error: string }> {
  const parsed = createInquirySchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    anglerName, anglerEmail, datesFrom, datesTo,
    targetSpecies, experienceLevel, groupSize, preferences, guideId,
  } = parsed.data

  if (datesFrom > datesTo) return { error: 'Start date must be before end date.' }

  // Expand all selected periods into individual dates so downstream logic
  // (sendOffer blocking, acceptBooking blocking) never has to guess the
  // "envelope" range. Deduplication + sort for clean storage.
  const allPeriods = preferences.allDatePeriods
  const requestedDates: string[] = allPeriods != null && allPeriods.length > 0
    ? [...new Set(
        allPeriods.flatMap(p => expandBookingDateRange(p.from, p.to)),
      )].sort()
    : expandBookingDateRange(datesFrom, datesTo)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()
  const { data: booking, error } = await serviceClient
    .from('bookings')
    .insert({
      source:            'inquiry',
      angler_id:         user?.id ?? null,
      angler_email:      anglerEmail,
      angler_full_name:  anglerName,
      booking_date:      datesFrom,
      date_to:           datesTo,
      // All individual dates the angler is available — avoids envelope problem
      // where datesFrom/datesTo would otherwise span non-selected days.
      requested_dates:   requestedDates.length > 0 ? requestedDates : null,
      guests:            groupSize,
      target_species:    targetSpecies,
      experience_level:  experienceLevel,
      preferences:       preferences as unknown as Json,
      guide_id:          guideId ?? null,
      status:            'pending',
      total_eur:         0,
      platform_fee_eur:  0,
      guide_payout_eur:  0,
    })
    .select('id')
    .single()

  if (error || !booking) {
    console.error('[createInquiryBooking]', error)
    return { error: 'Failed to submit inquiry. Please try again.' }
  }

  console.log(`[createInquiryBooking] New inquiry booking ${booking.id} from ${anglerEmail}`)
  revalidatePath('/dashboard/bookings')
  return { bookingId: booking.id }
}

// ─── markBookingReviewing ──────────────────────────────────────────────────────
//
// Guide opens an inquiry booking — auto-advance status from 'pending' → 'reviewing'.
// Called server-side when the guide navigates to /dashboard/bookings/[id].

export async function markBookingReviewing(
  bookingId: string,
): Promise<void> {
  const serviceClient = createServiceClient()
  await serviceClient
    .from('bookings')
    .update({ status: 'reviewing' })
    .eq('id', bookingId)
    .eq('status', 'pending')
    .eq('source', 'inquiry')
  // Errors are non-fatal — page renders regardless
}

// ─── sendOffer ────────────────────────────────────────────────────────────────
//
// Guide sends a priced offer for an inquiry booking.
// Was: sendOfferByGuide() in inquiries.ts
//
// Status: pending | reviewing → offer_sent

const sendOfferSchema = z.object({
  assignedRiver:     z.string().min(1, 'Location is required'),
  offerPriceMinEur:  z.number().positive().optional(),
  offerPriceEur:     z.number().positive().optional(),
  offerPriceTiers:   z.array(z.object({
    anglers:  z.number().int().min(1),
    priceEur: z.number().positive(),
  })).optional(),
  offerDetails:  z.string().min(1, 'Please provide offer details'),
  offerDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  offerDateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  offerDays:     z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  offerMeetingLat: z.number().optional(),
  offerMeetingLng: z.number().optional(),
})

export async function sendOffer(
  bookingId: string,
  offer: z.infer<typeof sendOfferSchema>,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const hasTiers = offer.offerPriceTiers != null && offer.offerPriceTiers.length > 0

  if (hasTiers) {
    const tiersErr = validatePriceTiers(offer.offerPriceTiers!)
    if (tiersErr) return { error: tiersErr }
  } else {
    if (!offer.offerPriceEur || offer.offerPriceEur <= 0) {
      return { error: 'Enter a valid offer price.' }
    }
    if (offer.offerPriceMinEur != null && offer.offerPriceMinEur >= offer.offerPriceEur) {
      return { error: 'Minimum price must be less than the maximum price.' }
    }
  }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, guide_id, status, source, guests, requested_dates')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.source !== 'inquiry') return { error: 'Only inquiry bookings can receive an offer.' }
  if (booking.guide_id !== null && booking.guide_id !== guide.id) {
    return { error: 'You are not authorized to send an offer for this booking.' }
  }
  if (booking.status !== 'pending' && booking.status !== 'reviewing') {
    return { error: 'An offer can only be sent for bookings in pending or reviewing status.' }
  }

  const effectivePriceEur = hasTiers
    ? findApplicableTierPrice(offer.offerPriceTiers!, booking.guests)
    : (offer.offerPriceEur ?? 0)

  const { error: updateError } = await serviceClient
    .from('bookings')
    .update({
      status:              'offer_sent',
      guide_id:            guide.id,
      assigned_river:      offer.assignedRiver,
      offer_price_min_eur: hasTiers ? null : (offer.offerPriceMinEur ?? null),
      offer_price_eur:     effectivePriceEur,
      offer_price_tiers:   hasTiers ? (offer.offerPriceTiers as unknown as Json) : null,
      offer_details:       offer.offerDetails,
      offer_date_from:     offer.offerDateFrom ?? null,
      offer_date_to:       offer.offerDateTo   ?? null,
      offer_days:          offer.offerDays     ?? null,
      offer_meeting_lat:   offer.offerMeetingLat ?? null,
      offer_meeting_lng:   offer.offerMeetingLng ?? null,
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('[sendOffer]', updateError)
    return { error: 'Failed to send offer. Please try again.' }
  }

  // ── Block calendar dates ───────────────────────────────────────────────────
  // Priority: guide's exact offer_days > guide's date range > angler's
  // requested_dates (the individual dates they said they're available).
  // Using requested_dates as last resort avoids the "envelope" problem where
  // datesFrom/datesTo would block the full span including non-selected days.
  // If guide set no dates at all and angler has no requested_dates, nothing blocked.
  {
    const daysToBlock =
      offer.offerDays != null && offer.offerDays.length > 0
        ? offer.offerDays
        : offer.offerDateFrom != null
          ? expandBookingDateRange(offer.offerDateFrom, offer.offerDateTo)
          : (booking.requested_dates as string[] | null) ?? []
    if (daysToBlock.length > 0) {
      blockBookingDates(serviceClient, bookingId, guide.id, daysToBlock)
        .catch(e => console.error('[sendOffer] blockBookingDates:', e))
    }
  }

  console.log(`[sendOffer] Offer sent for booking ${bookingId} — €${effectivePriceEur}`)
  revalidatePath('/dashboard/bookings')
  revalidatePath(`/dashboard/bookings/${bookingId}`)
  return {}
}

// ─── acceptBookingOffer ───────────────────────────────────────────────────────
//
// Angler accepts a guide's offer → creates Stripe Checkout for full payment.
// Was: acceptOffer() in inquiries.ts
//
// Status: offer_sent → offer_accepted → (webhook) → confirmed

export async function acceptBookingOffer(
  bookingId: string,
): Promise<{ checkoutUrl: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to accept this offer.' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('*, guides(id, full_name, stripe_account_id, stripe_payouts_enabled, commission_rate)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }

  const { data: { user: authUser } } = await supabase.auth.getUser()
  const userEmail = authUser?.email
  const isOwner =
    booking.angler_id === user.id ||
    (userEmail != null && booking.angler_email === userEmail)

  if (!isOwner) return { error: 'You do not have permission to accept this offer.' }
  if (booking.status !== 'offer_sent') return { error: 'No pending offer to accept.' }
  if (!booking.offer_price_eur && !booking.offer_price_tiers) return { error: 'No offer price set.' }

  const rawTiers = booking.offer_price_tiers as PriceTier[] | null
  const effectiveOfferPrice =
    rawTiers != null && rawTiers.length > 0
      ? findApplicableTierPrice(rawTiers, booking.guests)
      : (booking.offer_price_eur ?? 0)

  if (effectiveOfferPrice <= 0) return { error: 'No valid offer price set.' }
  if (effectiveOfferPrice < 1) return { error: 'Offer price must be at least €1 to process via Stripe.' }

  const guide = booking.guides as unknown as {
    id: string
    full_name: string
    stripe_account_id: string | null
    stripe_payouts_enabled: boolean
    commission_rate: number
  } | null

  // Mark as offer_accepted
  await serviceClient
    .from('bookings')
    .update({ status: 'offer_accepted' })
    .eq('id', bookingId)

  // Guide has Stripe → destination charge (platform takes commission automatically)
  if (guide?.stripe_account_id && guide.stripe_payouts_enabled) {
    try {
      const commissionRate = guide.commission_rate ?? env.PLATFORM_COMMISSION_RATE
      const session = await stripe.checkout.sessions.create(
        {
          mode:                 'payment',
          payment_method_types: ['card'],
          customer_email:       booking.angler_email ?? undefined,
          line_items: [{
            price_data: {
              currency:     'eur',
              product_data: {
                name:        `Custom Fishing Trip — ${booking.booking_date} to ${booking.date_to ?? booking.booking_date}`,
                description: `Guide: ${guide.full_name}${booking.assigned_river ? ` · ${booking.assigned_river}` : ''} · ${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`,
              },
              unit_amount: Math.round(effectiveOfferPrice * 100),
            },
            quantity: 1,
          }],
          metadata: { bookingId, guideId: guide.id },
          success_url: `${getAppUrl()}/account/bookings/${bookingId}?status=paid`,
          cancel_url:  `${getAppUrl()}/account/bookings/${bookingId}`,
          payment_intent_data: {
            application_fee_amount: Math.round(effectiveOfferPrice * commissionRate * 100),
            transfer_data:          { destination: guide.stripe_account_id },
            metadata:               { bookingId },
          },
        },
        { idempotencyKey: `offer-accept-${bookingId}` },
      )

      await serviceClient
        .from('bookings')
        .update({
          stripe_checkout_id: session.id,
          total_eur:          effectiveOfferPrice,
          deposit_eur:        effectiveOfferPrice,
          platform_fee_eur:   Math.round(effectiveOfferPrice * (guide.commission_rate ?? env.PLATFORM_COMMISSION_RATE) * 100) / 100,
          guide_payout_eur:   Math.round(effectiveOfferPrice * (1 - (guide.commission_rate ?? env.PLATFORM_COMMISSION_RATE)) * 100) / 100,
          commission_rate:    guide.commission_rate ?? env.PLATFORM_COMMISSION_RATE,
        })
        .eq('id', bookingId)

      return { checkoutUrl: session.url! }
    } catch (err) {
      console.error('[acceptBookingOffer] Stripe error:', err)
      // Revert to offer_sent
      await serviceClient
        .from('bookings')
        .update({ status: 'offer_sent' })
        .eq('id', bookingId)
      return { error: 'Payment setup failed. Please try again.' }
    }
  }

  // Guide without Stripe → confirm directly (no payment)
  await serviceClient
    .from('bookings')
    .update({
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
      total_eur:    effectiveOfferPrice,
      deposit_eur:  effectiveOfferPrice,
    })
    .eq('id', bookingId)

  return {
    checkoutUrl: `${getAppUrl()}/account/bookings/${bookingId}?status=accepted`,
  }
}

export async function updateAcceptedPaymentMethods(
  methods: ('cash' | 'online')[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  if (!Array.isArray(methods) || methods.length === 0) {
    return { error: 'Select at least one accepted payment method.' }
  }

  const valid = methods.every(m => m === 'cash' || m === 'online')
  if (!valid) return { error: 'Invalid payment method value.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('guides')
    .update({ accepted_payment_methods: methods })
    .eq('user_id', user.id)

  if (error) {
    console.error('[updateAcceptedPaymentMethods]', error)
    return { error: 'Failed to save payment methods.' }
  }

  revalidatePath('/dashboard/account')
  return {}
}
