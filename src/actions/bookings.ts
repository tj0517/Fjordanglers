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
import { getAppUrl } from '@/lib/app-url'
import { getPaymentModel } from '@/lib/payment-model'
import { computeBookingPricing, calcSubtotalFromOption, type DurationOption } from '@/lib/booking-pricing'
import { buildBookingReference } from '@/lib/sepa-qr'
import type { Json } from '@/lib/supabase/database.types'
import {
  fmtEmailDate,
  fmtEmailDateRange,
  fmtEmailDays,
  sendBookingRequestAnglerEmail,
  sendBookingRequestGuideEmail,
  sendBookingAcceptedAnglerEmail,
  sendBookingDeclinedAnglerEmail,
  sendBalancePaidAnglerEmail,
  sendInquiryReceivedAnglerEmail,
  sendInquiryReceivedGuideEmail,
  sendOfferReceivedAnglerEmail,
  sendOfferAcceptedGuideEmail,
} from '@/lib/email'

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
  // ── Auth — required ────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to book a trip.' }

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
      'id, title, price_per_person_eur, max_guests, guide_id, duration_options, guides(id, user_id, full_name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, pricing_model, commission_rate)',
    )
    .eq('id', experienceId)
    .eq('published', true)
    .single()

  if (!experience) return { error: 'Experience not found or no longer available.' }

  const guideRaw = experience.guides as unknown as {
    id: string
    user_id: string | null
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

  // ── Calculate pricing (single source of truth) ────────────────────────────
  const pricePerPerson = experience.price_per_person_eur ?? 0
  const commissionRate = guideRaw.commission_rate ?? env.PLATFORM_COMMISSION_RATE

  // Resolve subtotal: if a duration option label was supplied, look up the option
  // and use its pricing_type (per_person / per_boat / per_group).
  // Falls back to the base per-person rate if no match is found.
  let subtotal: number
  const rawOpts = experience.duration_options as DurationOption[] | null
  const matchedOpt = durationOptionLabel
    ? rawOpts?.find(o => o.label === durationOptionLabel) ?? null
    : null

  if (matchedOpt) {
    subtotal = calcSubtotalFromOption(matchedOpt, guests, tripDays)
  } else {
    subtotal = Math.round(pricePerPerson * guests * tripDays * 100) / 100
  }

  const pricing = computeBookingPricing(subtotal, commissionRate)

  // ── Insert booking row ────────────────────────────────────────────────────
  const serviceClient = createServiceClient()

  const { data: booking, error: insertError } = await serviceClient
    .from('bookings')
    .insert({
      experience_id: experienceId,
      angler_id: user.id,
      angler_email: anglerEmail,
      guide_id: guideRaw.id,
      booking_date: dates[0], // primary date (first selected)
      requested_dates: dates, // all selected dates
      guests,
      total_eur:        pricing.totalEur,
      service_fee_eur:  pricing.serviceFeeEur,
      platform_fee_eur: pricing.commissionEur,
      guide_payout_eur: pricing.guidePayoutEur,
      deposit_eur:      pricing.depositEur,
      commission_rate:  commissionRate,
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

  // ── Fire-and-forget emails ────────────────────────────────────────────────
  {
    const appUrl   = await getAppUrl()
    const datesLbl = fmtEmailDateRange(dates[0], dates[dates.length - 1])

    // To angler — "your request is on its way"
    sendBookingRequestAnglerEmail({
      to:              anglerEmail,
      anglerName:      anglerName ?? anglerEmail,
      experienceTitle: experience.title,
      guideName:       guideRaw.full_name,
      datesLabel:      datesLbl,
      guests,
      totalEur:  pricing.totalEur,
      bookingUrl: `${appUrl}/account/bookings/${booking.id}`,
    }).catch(e => console.error('[createBookingCheckout] angler email:', e))

    // To guide — "new booking request"
    if (guideRaw.user_id) {
      serviceClient.auth.admin.getUserById(guideRaw.user_id)
        .then(({ data }) => {
          const guideEmail = data.user?.email
          if (!guideEmail) return
          return sendBookingRequestGuideEmail({
            to:              guideEmail,
            guideName:       guideRaw.full_name,
            anglerName:      anglerName ?? anglerEmail,
            anglerEmail,
            anglerCountry:   anglerCountry ?? null,
            experienceTitle: experience.title,
            datesLabel:      datesLbl,
            guests,
            totalEur:  pricing.totalEur,
            specialRequests: specialRequests ?? null,
            bookingUrl: `${appUrl}/dashboard/bookings/${booking.id}`,
          })
        })
        .catch(e => console.error('[createBookingCheckout] guide email:', e))
    }
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
    locationText?:      string     // river / location name set by guide when accepting
    meetingLat?:        number     // optional meeting point pin
    meetingLng?:        number
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, default_balance_payment_method')
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
    .select('id, status, guide_id, total_eur, service_fee_eur, platform_fee_eur, guide_payout_eur, angler_email, angler_full_name, angler_phone, deposit_eur, stripe_checkout_id, guests, commission_rate, experience_id, requested_dates, booking_date, offer_days, offer_date_from, offer_date_to, duration_option, experiences(title, price_per_person_eur, duration_options)')
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
  let pricingUpdate: Partial<{
    total_eur:        number
    service_fee_eur:  number
    guide_payout_eur: number
    deposit_eur:      number
    platform_fee_eur: number
  }> = {}

  if (options?.customTotalEur != null && options.customTotalEur > 0) {
    // Guide set a custom price — treat it as their SUBTOTAL (excl. service fee).
    // computeBookingPricing() adds the service fee on top and returns all price fields.
    const subtotal  = Math.round(options.customTotalEur * 100) / 100
    const pricing   = computeBookingPricing(subtotal, booking.commission_rate)
    effectiveTotalEur       = pricing.totalEur
    effectiveGuidePayoutEur = pricing.guidePayoutEur
    pricingUpdate = {
      total_eur:        pricing.totalEur,
      service_fee_eur:  pricing.serviceFeeEur,
      guide_payout_eur: pricing.guidePayoutEur,
      deposit_eur:      pricing.depositEur,
      platform_fee_eur: pricing.commissionEur,
    }
  } else if (confirmedDays && confirmedDays.length > 0) {
    const exp = booking.experiences as unknown as {
      title: string
      price_per_person_eur: number | null
      duration_options: DurationOption[] | null
    } | null
    const pricePerPerson = exp?.price_per_person_eur
    if (pricePerPerson != null && booking.guests > 0) {
      const numDays = confirmedDays.length

      // Use the stored duration option (if any) for correct per_boat / per_group pricing.
      // Falls back to base per-person rate if no matching option found.
      const storedLabel = booking.duration_option ?? null
      const matchedOpt  = storedLabel
        ? (exp?.duration_options ?? []).find(o => o.label === storedLabel) ?? null
        : null

      const subtotal = matchedOpt
        ? calcSubtotalFromOption(matchedOpt, booking.guests, numDays)
        : Math.round(pricePerPerson * booking.guests * numDays * 100) / 100

      const pricing = computeBookingPricing(subtotal, booking.commission_rate)
      effectiveTotalEur       = pricing.totalEur
      effectiveGuidePayoutEur = pricing.guidePayoutEur
      pricingUpdate = {
        total_eur:        pricing.totalEur,
        service_fee_eur:  pricing.serviceFeeEur,
        guide_payout_eur: pricing.guidePayoutEur,
        deposit_eur:      pricing.depositEur,
        platform_fee_eur: pricing.commissionEur,
      }
    }
  }

  // ── Stripe Checkouts — two-step payment model ─────────────────────────────
  //
  // Step 1 — Booking fee (all models):
  //   Charge = commission + service_fee (platform's full cut)
  //   No transfer_data — money stays on FjordAnglers main account
  //   Confirms the booking slot. Angler gets booking confirmed once paid.
  //
  // Step 2 — Guide amount (stripe_connect only):
  //   Charge = guide_payout_eur (subtotal − commission)
  //   transfer_data → guide's connected account (guide gets 100%, no application_fee)
  //   For manual model: angler pays guide directly via IBAN or cash

  const appUrl = await getAppUrl()
  let stripeCheckoutId: string | null = null
  let guideStripeCheckoutId: string | null = null

  if (!booking.stripe_checkout_id) {
    try {
      const experienceTitle =
        (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

      // ── Step 1: Booking fee ─────────────────────────────────────────────────
      // Always = commission + service_fee (same for both models).
      // payNow = total − guide_payout avoids any reverse-1.05 calculation.
      const bookingFeeEur = Math.round((effectiveTotalEur - effectiveGuidePayoutEur) * 100) / 100
      const bookingFeeCents = Math.round(bookingFeeEur * 100)

      // Stripe minimum: €1.00 safe floor. Booking is still accepted; Checkout skipped
      // for very cheap trips. Admin can create checkout manually if needed.
      if (bookingFeeCents < 100) {
        console.warn(
          `[acceptBooking] booking fee ${bookingFeeCents}¢ below safe minimum — skipping Checkout for booking ${bookingId}`,
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
                    name:        `${experienceTitle} — Booking fee`,
                    description: 'Platform & service fee to confirm your booking.',
                  },
                  unit_amount: bookingFeeCents,
                },
                quantity: 1,
              },
            ],
            metadata:    { bookingId, guideId: guide.id, paymentType: 'booking_fee' },
            success_url: `${appUrl}/account/bookings/${bookingId}?status=paid`,
            cancel_url:  `${appUrl}/account/bookings/${bookingId}`,
            payment_intent_data: {
              // No transfer_data — full booking fee stays on FjordAnglers platform.
              // Guide amount is collected separately (step 2 below).
              metadata: { bookingId, paymentType: 'booking_fee' },
            },
          },
          { idempotencyKey: `booking-accept-${bookingId}` },
        )
        stripeCheckoutId = session.id
      }

      // ── Step 2: Guide amount (Stripe Connect guides only) ───────────────────
      // Creates a second Checkout session where angler pays the guide's portion
      // directly to the guide's connected account. No application_fee — guide
      // receives 100% of this amount. Session link is shown after booking fee is paid.
      if (guidePaymentModel === 'stripe_connect' && guide.stripe_account_id) {
        const guideAmountCents = Math.round(effectiveGuidePayoutEur * 100)

        if (guideAmountCents >= 100) {
          const guideSession = await stripe.checkout.sessions.create(
            {
              mode:                 'payment',
              payment_method_types: ['card'],
              customer_email:       booking.angler_email ?? undefined,
              line_items: [
                {
                  price_data: {
                    currency:     'eur',
                    product_data: {
                      name:        `${experienceTitle} — Trip payment`,
                      description: 'Payment for your confirmed fishing trip, paid directly to your guide.',
                    },
                    unit_amount: guideAmountCents,
                  },
                  quantity: 1,
                },
              ],
              metadata:    { bookingId, guideId: guide.id, paymentType: 'guide_amount' },
              success_url: `${appUrl}/account/bookings/${bookingId}?status=guide_paid`,
              cancel_url:  `${appUrl}/account/bookings/${bookingId}`,
              payment_intent_data: {
                // Transfer 100% to guide's connected account — no application_fee.
                // Platform fee was already collected in full via the booking fee checkout.
                transfer_data: { destination: guide.stripe_account_id },
                metadata: { bookingId, paymentType: 'guide_amount' },
              },
            },
            { idempotencyKey: `booking-guide-${bookingId}` },
          )
          guideStripeCheckoutId = guideSession.id
        }
      }
    } catch (err) {
      console.error('[acceptBooking] Stripe Checkout error:', err)
      // Non-fatal: accept without payment link, admin can create checkout manually
    }
  } else {
    stripeCheckoutId = booking.stripe_checkout_id
    guideStripeCheckoutId = (booking as Record<string, unknown>).guide_stripe_checkout_id as string | null ?? null
  }

  // Guide amount delivery method (for display on angler's booking page):
  //   stripe_connect → angler pays via Stripe (guide_stripe_checkout_id)
  //   manual + IBAN  → angler pays via bank transfer (guide shares IBAN details)
  //   manual no IBAN → angler arranges payment directly with guide
  const balanceMethod = guidePaymentModel === 'stripe_connect'
    ? 'stripe'
    : 'cash'

  const { error } = await serviceClient
    .from('bookings')
    .update({
      status:                  'accepted',
      accepted_at:             new Date().toISOString(),
      balance_payment_method:  balanceMethod,
      ...(stripeCheckoutId      != null ? { stripe_checkout_id:       stripeCheckoutId      } : {}),
      ...(guideStripeCheckoutId != null ? { guide_stripe_checkout_id: guideStripeCheckoutId } : {}),
      // Confirmed trip dates.
      // confirmed_days  = canonical array of SPECIFIC days (non-consecutive safe).
      // confirmed_date_from/to = first/last day — envelope for display/sorting ONLY.
      //
      // INVARIANT: booking_date and requested_dates are NEVER mutated after INSERT.
      // They always represent the angler's original request, not the guide's confirmation.
      ...(confirmedDays != null && confirmedDays.length > 0 ? {
        confirmed_days:      confirmedDays,
        confirmed_date_from: confirmedDays[0],
        confirmed_date_to:   confirmedDays[confirmedDays.length - 1],
      } : options?.confirmedDateFrom ? {
        confirmed_date_from: options.confirmedDateFrom,
        confirmed_date_to:   options.confirmedDateTo ?? options.confirmedDateFrom,
      } : {}),
      // Updated pricing when guide confirmed specific days
      ...pricingUpdate,
      // Location set by guide when accepting
      ...(options?.locationText ? { assigned_river: options.locationText } : {}),
      ...(options?.meetingLat != null && options?.meetingLng != null
        ? { offer_meeting_lat: options.meetingLat, offer_meeting_lng: options.meetingLng }
        : {}),
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[acceptBooking]', error)
    return { error: 'Failed to accept booking.' }
  }

  // ── Block calendar dates ───────────────────────────────────────────────────
  // Writes to calendar_blocked_dates (single source of truth, post-migration 20260402200000).
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

  // ── Email to angler: "booking accepted — pay your deposit" ───────────────
  {
    const anglerEmail = booking.angler_email
    if (anglerEmail) {
      // Build a human-readable confirmed dates label
      const confirmedDays = options?.confirmedDays
      const confirmedDatesLabel = (() => {
        if (confirmedDays && confirmedDays.length > 0) return fmtEmailDays(confirmedDays)
        if (options?.confirmedDateFrom) {
          return fmtEmailDateRange(options.confirmedDateFrom, options.confirmedDateTo ?? options.confirmedDateFrom)
        }
        const reqDates = booking.requested_dates as string[] | null
        if (reqDates && reqDates.length > 0) return fmtEmailDateRange(reqDates[0], reqDates[reqDates.length - 1])
        return fmtEmailDate(booking.booking_date)
      })()

      const emailDepositEur = pricingUpdate.deposit_eur ?? (booking.deposit_eur as number | null) ?? Math.round(effectiveTotalEur * 0.4 * 100) / 100
      const expTitle = (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'
      const guideFullName = (guide as unknown as { full_name?: string }).full_name ?? 'Your guide'

      sendBookingAcceptedAnglerEmail({
        to:              anglerEmail,
        anglerName:      (booking.angler_full_name as string | null) ?? anglerEmail,
        experienceTitle: expTitle,
        guideName:       guideFullName,
        confirmedDates:  confirmedDatesLabel,
        depositEur:      emailDepositEur,
        totalEur:        effectiveTotalEur,
        guideNote:       options?.guideNote?.trim() ?? null,
        bookingUrl:      `${await getAppUrl()}/account/bookings/${bookingId}`,
      }).catch(e => console.error('[acceptBooking] angler email:', e))
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
// Creates a fresh booking-fee session and updates the DB.
// Only valid for 'accepted' bookings (guide has already confirmed).
//
// Booking fee = commission + service_fee (= deposit_eur stored on booking).
// No transfer_data — money stays on FjordAnglers platform.

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
      'id, status, angler_id, total_eur, deposit_eur, guide_payout_eur, angler_email, guide_id, experiences(title)',
    )
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .in('status', ['accepted', 'offer_accepted'])
    .single()

  if (!booking) return { error: 'Booking not found or not ready for payment.' }

  const experienceTitle =
    (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

  // Booking fee = stored deposit_eur (commission + service_fee).
  // Fall back to total − guide_payout if deposit_eur is missing (legacy rows).
  const bookingFeeEur = booking.deposit_eur
    ?? Math.round((booking.total_eur - (booking.guide_payout_eur ?? booking.total_eur * 0.87)) * 100) / 100
  const bookingFeeCents = Math.round(bookingFeeEur * 100)

  if (bookingFeeCents < 100) {
    return { error: 'Booking fee is too small to process via Stripe.' }
  }

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
              name:        `${experienceTitle} — Booking fee`,
              description: 'Platform & service fee to confirm your booking.',
            },
            unit_amount: bookingFeeCents,
          },
          quantity: 1,
        },
      ],
      metadata:    { bookingId, guideId: booking.guide_id, paymentType: 'booking_fee' },
      success_url: `${await getAppUrl()}/account/bookings/${bookingId}?status=paid`,
      cancel_url:  `${await getAppUrl()}/account/bookings/${bookingId}`,
      payment_intent_data: {
        // No transfer_data — booking fee stays on FjordAnglers platform.
        metadata: { bookingId, paymentType: 'booking_fee' },
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
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, guide_id, angler_email, angler_full_name, stripe_checkout_id, stripe_payment_intent_id, experiences(title)')
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

  // Track whether we issue a refund — determines the final booking status.
  const didRefund = booking.status === 'confirmed' && booking.stripe_payment_intent_id != null

  if (didRefund) {
    // Angler has paid — refund the Stripe charge.
    // No reverse_transfer: current Checkout sessions have no transfer_data
    // (full amount stays on platform), so reverse_transfer would error.
    try {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id!,
        reason:         'requested_by_customer',
      })
    } catch (err) {
      console.error('[declineBooking] Stripe refund error:', err)
      return { error: 'Failed to refund payment — please contact support.' }
    }
  }

  const { error } = await serviceClient
    .from('bookings')
    .update({
      // Use 'refunded' when money was returned so the angler sees the correct state.
      // The charge.refunded webhook will also fire; idempotency guard there handles that.
      status:          didRefund ? 'refunded' : 'declined',
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

  // ── Email to angler: "booking declined" ──────────────────────────────────
  {
    const anglerEmail = booking.angler_email as string | null
    if (anglerEmail) {
      const expTitle   = (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'
      const altDates   = alternatives ? fmtEmailDateRange(alternatives.from, alternatives.to) : null
      sendBookingDeclinedAnglerEmail({
        to:               anglerEmail,
        anglerName:       (booking.angler_full_name as string | null) ?? anglerEmail,
        experienceTitle:  expTitle,
        guideName:        (guide as unknown as { full_name?: string }).full_name ?? 'Your guide',
        declinedReason:   reason?.trim() ?? null,
        alternativeDates: altDates,
        didRefund,
        searchUrl:        `${await getAppUrl()}/guides`,
      }).catch(e => console.error('[declineBooking] angler email:', e))
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
      'id, status, angler_id, total_eur, deposit_eur, angler_email, guide_id, balance_payment_method, balance_paid_at, balance_stripe_checkout_id, experiences(title), guides(stripe_account_id, stripe_payouts_enabled)',
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

  const guideStripe = booking.guides as unknown as {
    stripe_account_id:    string | null
    stripe_payouts_enabled: boolean | null
  } | null

  // Guide has active Stripe Connect → balance goes directly to guide (application_fee
  // was already taken in full on the deposit payment, so no second fee here).
  const isStripeConnect =
    guideStripe?.stripe_account_id != null && guideStripe.stripe_payouts_enabled === true

  // Use the stored deposit amount — NOT a hardcoded percentage.
  // deposit_eur is written at booking creation; fall back to 40% only for legacy rows.
  const depositEur   = booking.deposit_eur ?? Math.round(booking.total_eur * 0.4 * 100) / 100
  const balanceCents = Math.round((booking.total_eur - depositEur) * 100)

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
                description: 'Remaining balance for your confirmed fishing trip.',
              },
              unit_amount: balanceCents,
            },
            quantity: 1,
          },
        ],
        metadata: { bookingId, guideId: booking.guide_id, paymentType: 'balance' },
        success_url: `${await getAppUrl()}/account/bookings/${bookingId}?status=balance_paid`,
        cancel_url:  `${await getAppUrl()}/account/bookings/${bookingId}`,
        payment_intent_data: {
          // stripe_connect: full balance → guide directly (platform fee already taken on deposit).
          // manual: full amount stays on platform; guide was paid directly by angler already.
          ...(isStripeConnect && guideStripe?.stripe_account_id
            ? {
                transfer_data: { destination: guideStripe.stripe_account_id },
              }
            : {}),
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
    .select('id, status, guide_id, angler_email, angler_full_name, guests, total_eur, balance_payment_method, balance_paid_at, confirmed_date_from, confirmed_date_to, confirmed_days, experiences(title), guides(full_name)')
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

  // ── Email to angler: "trip fully paid" ────────────────────────────────────
  {
    const anglerEmail = booking.angler_email as string | null
    if (anglerEmail) {
      const confDays = booking.confirmed_days as string[] | null
      const confirmedDatesLabel =
        confDays && confDays.length > 0
          ? fmtEmailDays(confDays)
          : fmtEmailDateRange(
              (booking.confirmed_date_from as string | null) ?? '',
              (booking.confirmed_date_to   as string | null) ?? '',
            )
      const expTitle   = (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'
      const guideData  = booking.guides as unknown as { full_name: string } | null

      sendBalancePaidAnglerEmail({
        to:               anglerEmail,
        anglerName:       (booking.angler_full_name as string | null) ?? anglerEmail,
        experienceTitle:  expTitle,
        guideName:        guideData?.full_name ?? 'Your guide',
        confirmedDates:   confirmedDatesLabel,
        guests:           booking.guests as number,
        totalEur:         booking.total_eur as number,
        bookingUrl:       `${await getAppUrl()}/account/bookings/${bookingId}`,
      }).catch(e => console.error('[markBalancePaid] angler email:', e))
    }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath(`/dashboard/bookings/${bookingId}`)
  return {}
}

// ─── markTripCompleted ────────────────────────────────────────────────────────
//
// Guide marks a confirmed booking as completed after the trip happened.
// This is the trigger that lets admin release the payout from the admin panel.
//
// Only valid for confirmed bookings owned by the calling guide.

export async function markTripCompleted(
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
    .select('id, status, guide_id')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status === 'completed') return { error: 'Trip already marked as completed.' }
  if (booking.status !== 'confirmed') return { error: 'Only confirmed bookings can be marked as completed.' }

  const { error } = await serviceClient
    .from('bookings')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[markTripCompleted]', error)
    return { error: 'Failed to mark trip as completed. Please try again.' }
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

// ─── createGuideAmountCheckout ────────────────────────────────────────────────
//
// Creates a fresh Stripe Checkout session for the guide amount payment.
// Only relevant when the guide has Stripe Connect active.
//
// Called on-demand when the angler clicks "Pay guide" on their booking page.
// Idempotency: if a valid session already exists, returns its URL.
//
// The guide receives 100% of this payment — no application_fee_amount.
// Platform fee was collected in full via the booking fee checkout (step 1).

export async function createGuideAmountCheckout(
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
      'id, status, angler_id, total_eur, guide_payout_eur, angler_email, guide_id, guide_amount_paid_at, guide_stripe_checkout_id, experiences(title), guides(stripe_account_id, stripe_payouts_enabled)',
    )
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .eq('status', 'confirmed')
    .single()

  if (!booking) return { error: 'Booking not found or not confirmed yet.' }
  if (booking.guide_amount_paid_at != null) return { error: 'Guide amount already paid.' }

  const guideStripe = booking.guides as unknown as {
    stripe_account_id:    string | null
    stripe_payouts_enabled: boolean | null
  } | null

  if (!guideStripe?.stripe_account_id || guideStripe.stripe_payouts_enabled !== true) {
    return { error: 'This guide does not accept Stripe payments — please arrange payment directly.' }
  }

  // Idempotency: if we already have a valid open session, return its URL
  if (booking.guide_stripe_checkout_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.guide_stripe_checkout_id)
      if (existing.status === 'open' && existing.url) {
        return { url: existing.url }
      }
    } catch {
      // Session expired or invalid — fall through to create a new one
    }
  }

  const experienceTitle =
    (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

  const guideAmountCents = Math.round((booking.guide_payout_eur ?? 0) * 100)
  if (guideAmountCents < 100) {
    return { error: 'Guide amount is too small to process via Stripe.' }
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
                name:        `${experienceTitle} — Trip payment`,
                description: 'Payment for your confirmed fishing trip, paid directly to your guide.',
              },
              unit_amount: guideAmountCents,
            },
            quantity: 1,
          },
        ],
        metadata:    { bookingId, guideId: booking.guide_id ?? '', paymentType: 'guide_amount' },
        success_url: `${await getAppUrl()}/account/bookings/${bookingId}?status=guide_paid`,
        cancel_url:  `${await getAppUrl()}/account/bookings/${bookingId}`,
        payment_intent_data: {
          // Transfer 100% to guide — no application_fee.
          // Booking fee was already collected in step 1.
          transfer_data: { destination: guideStripe.stripe_account_id },
          metadata: { bookingId, paymentType: 'guide_amount' },
        },
      },
      { idempotencyKey: `booking-guide-refresh-${bookingId}-${Date.now()}` },
    )

    await serviceClient
      .from('bookings')
      .update({ guide_stripe_checkout_id: session.id })
      .eq('id', bookingId)

    return { url: session.url! }
  } catch (err) {
    console.error('[createGuideAmountCheckout]', err)
    return { error: 'Failed to create payment session — please try again.' }
  }
}

// ─── shareIbanWithAngler ──────────────────────────────────────────────────────
//
// Guide shares their IBAN bank transfer details with the angler for a specific booking.
// Sets iban_shared_at on the booking row — this is the signal that makes the
// IBAN transfer details visible on the angler's booking page.
//
// Only valid for confirmed bookings where the guide has an IBAN saved.

export async function shareIbanWithAngler(
  bookingId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, iban, iban_holder_name')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  if (!guide.iban || guide.iban.trim() === '') {
    return { error: 'No IBAN saved. Add your IBAN in account settings first.' }
  }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, guide_id, iban_shared_at, guide_payout_eur')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (!['accepted', 'offer_accepted', 'confirmed', 'completed'].includes(booking.status)) {
    return { error: 'Can only share payment details after accepting the booking.' }
  }
  if (booking.iban_shared_at != null) {
    // Already shared — idempotent, not an error
    return {}
  }

  const { error } = await serviceClient
    .from('bookings')
    .update({ iban_shared_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) {
    console.error('[shareIbanWithAngler]', error)
    return { error: 'Failed to share payment details.' }
  }

  // ── Post a chat message from the guide so the angler sees a notification ──
  // The message contains the key transfer details inline for quick reference.
  // Full details are also shown on the angler's booking page.
  if (booking.guide_payout_eur != null) {
    const reference    = buildBookingReference(bookingId)
    const holderName   = guide.iban_holder_name ?? guide.full_name ?? 'Guide'
    const cleanIban    = guide.iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
    const amount       = booking.guide_payout_eur

    const chatBody = [
      `💳 I've shared my bank transfer details with you.`,
      ``,
      `Recipient: ${holderName}`,
      `IBAN: ${cleanIban}`,
      `Amount: €${amount}`,
      `Reference: ${reference}`,
      ``,
      `Open your booking page for the full transfer details.`,
    ].join('\n')

    await serviceClient
      .from('booking_messages')
      .insert({ booking_id: bookingId, sender_id: user.id, body: chatBody })
      .then(({ error: msgErr }) => {
        if (msgErr) console.error('[shareIbanWithAngler] chat message insert failed:', msgErr)
      })
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`)
  revalidatePath(`/account/bookings/${bookingId}`)
  return {}
}

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
  guideId:      z.string().uuid().optional(),
  // When inquiry is started from a specific trip page ("Message the guide first"
  // or Icelandic flow), pin the booking to that experience so calendar blocking
  // stays scoped to the right calendar and the angler sees trip details.
  experienceId: z.string().uuid().optional(),
})

export async function createInquiryBooking(
  formData: z.infer<typeof createInquirySchema>,
): Promise<{ bookingId: string } | { error: string }> {
  const parsed = createInquirySchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    anglerName, anglerEmail, datesFrom, datesTo,
    targetSpecies, experienceLevel, groupSize, preferences, guideId, experienceId,
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
  if (!user) return { error: 'You must be signed in to send an inquiry.' }

  const serviceClient = createServiceClient()
  const { data: booking, error } = await serviceClient
    .from('bookings')
    .insert({
      source:            'inquiry',
      angler_id:         user.id,
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
      guide_id:          guideId      ?? null,
      experience_id:     experienceId ?? null,
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


  // ── Fire-and-forget emails ────────────────────────────────────────────────
  {
    const appUrl   = await getAppUrl()
    const datesLbl = fmtEmailDateRange(datesFrom, datesTo)
    const budgetLbl = preferences.budgetMin != null || preferences.budgetMax != null
      ? [
          preferences.budgetMin  != null ? `€${preferences.budgetMin}`  : null,
          preferences.budgetMax != null ? `€${preferences.budgetMax}` : null,
        ].filter(Boolean).join('–')
      : null

    // To angler — "request sent"
    // Guide name is available only if guideId is known
    let guideNameForEmail = 'your guide'
    if (guideId) {
      const { data: guideRow } = await serviceClient.from('guides').select('full_name').eq('id', guideId).single()
      if (guideRow?.full_name) guideNameForEmail = guideRow.full_name
    }

    sendInquiryReceivedAnglerEmail({
      to:        anglerEmail,
      anglerName,
      guideName: guideNameForEmail,
      datesLabel: datesLbl,
      species:   targetSpecies,
      guests:    groupSize,
      notes:     preferences.notes ?? null,
      tripUrl:   `${appUrl}/account/trips/${booking.id}`,
    }).catch(e => console.error('[createInquiryBooking] angler email:', e))

    // To guide — "new inquiry request"
    if (guideId) {
      serviceClient.auth.admin
        .getUserById(
          await serviceClient.from('guides').select('user_id').eq('id', guideId).single()
            .then(r => (r.data?.user_id as string | null) ?? ''),
        )
        .then(({ data }) => {
          const guideEmail = data.user?.email
          if (!guideEmail) return
          return sendInquiryReceivedGuideEmail({
            to:               guideEmail,
            guideName:        guideNameForEmail,
            anglerName,
            anglerEmail,
            anglerCountry:    null,  // inquiry form doesn't collect country
            datesLabel:       datesLbl,
            species:          targetSpecies,
            guests:           groupSize,
            experienceLevel,
            budget:           budgetLbl,
            notes:            preferences.notes ?? null,
            inquiryUrl:       `${appUrl}/dashboard/bookings/${booking.id}`,
          })
        })
        .catch(e => console.error('[createInquiryBooking] guide email:', e))
    }
  }

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
    .select('id, full_name')
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
    .select('id, guide_id, status, source, guests, requested_dates, angler_email, angler_full_name, booking_date, date_to')
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

  // NOTE: calendar blocking happens at acceptBookingOffer() when the angler confirms —
  // the same as acceptBooking() for direct bookings. Sending an offer is not yet a
  // commitment — the angler may decline. Blocking at this stage would cause false
  // unavailability on the calendar.


  // ── Email to angler: "you have a new offer" ───────────────────────────────
  {
    const anglerEmail = booking.angler_email as string | null
    if (anglerEmail) {
      // Build offer dates label: specific days > date range > booking window
      const offerDatesLabel = (() => {
        if (offer.offerDays && offer.offerDays.length > 0) return fmtEmailDays(offer.offerDays)
        if (offer.offerDateFrom)
          return fmtEmailDateRange(offer.offerDateFrom, offer.offerDateTo ?? offer.offerDateFrom)
        return fmtEmailDateRange(
          booking.booking_date as string ?? '',
          (booking.date_to as string | null) ?? (booking.booking_date as string ?? ''),
        )
      })()

      sendOfferReceivedAnglerEmail({
        to:           anglerEmail,
        anglerName:   (booking.angler_full_name as string | null) ?? anglerEmail,
        guideName:    (guide as unknown as { full_name?: string }).full_name ?? 'Your guide',
        location:     offer.assignedRiver,
        offerDates:   offerDatesLabel,
        priceEur:     effectivePriceEur,
        offerDetails: offer.offerDetails,
        offerUrl:     `${await getAppUrl()}/account/trips/${bookingId}`,
      }).catch(e => console.error('[sendOffer] angler email:', e))
    }
  }

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
    .select('*, guides(id, user_id, full_name, stripe_account_id, stripe_payouts_enabled, commission_rate)')
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
    user_id: string | null
    full_name: string
    stripe_account_id: string | null
    stripe_payouts_enabled: boolean
    commission_rate: number
  } | null

  // ── Compute confirmed days from offer (before Stripe, before blocking) ───────
  //
  // offer_days  = guide explicitly picked individual days (non-consecutive safe).
  // offer_date_from/to = envelope dates (may span non-trip days).
  //
  // Rule: always prefer the specific days array over the envelope.
  // confirmedDaysForOffer is the canonical array written to confirmed_days column.
  const offerDaysRaw = booking.offer_days as string[] | null
  const confirmedDaysForOffer: string[] =
    offerDaysRaw != null && offerDaysRaw.length > 0
      ? offerDaysRaw
      : expandBookingDateRange(
          booking.offer_date_from as string | null,
          booking.offer_date_to   as string | null,
        )

  const confirmedFromOffer = confirmedDaysForOffer[0]                               ?? booking.offer_date_from ?? null
  const confirmedToOffer   = confirmedDaysForOffer[confirmedDaysForOffer.length - 1] ?? booking.offer_date_to   ?? null

  // Mark as offer_accepted
  await serviceClient
    .from('bookings')
    .update({ status: 'offer_accepted' })
    .eq('id', bookingId)

  // ── Block calendar dates ───────────────────────────────────────────────────
  // Exact same trigger as acceptBooking() for direct bookings.
  // Angler accepted the offer → dates are committed → block the calendar.
  // Inquiry bookings have no experience_id → blockBookingDates blocks ALL guide calendars.
  {
    const offerDays   = booking.offer_days as string[] | null
    const daysToBlock =
      offerDays != null && offerDays.length > 0
        ? offerDays
        : expandBookingDateRange(
            booking.offer_date_from as string | null,
            booking.offer_date_to   as string | null,
          )

    const guideIdForBlock = (booking.guide_id as string | null) ?? guide?.id ?? ''
    if (daysToBlock.length > 0 && guideIdForBlock) {
      blockBookingDates(
        serviceClient,
        bookingId,
        guideIdForBlock,
        daysToBlock,
        (booking.experience_id as string | null) ?? undefined,
      ).catch(e => console.error('[acceptBookingOffer] blockBookingDates:', e))
    }
  }

  // Guide has Stripe → destination charge (platform takes commission + service fee automatically)
  //
  // Fee model:
  //   - Guide quoted price (effectiveOfferPrice) → guide receives this minus commission
  //   - Service fee (5%, capped €50) → added ON TOP for angler, NOT deducted from guide
  //   - Angler pays: guide_price + service_fee
  //   - Platform application_fee = commission + service_fee
  //   - Guide receives: guide_price - commission  (service fee never touches guide's earnings)
  if (guide?.stripe_account_id && guide.stripe_payouts_enabled) {
    try {
      const commissionRate   = guide.commission_rate ?? env.PLATFORM_COMMISSION_RATE
      const SERVICE_FEE_CAP  = 50
      const serviceFeeEur    = Math.min(
        Math.round(effectiveOfferPrice * 0.05 * 100) / 100,
        SERVICE_FEE_CAP,
      )
      const commissionEur    = Math.round(effectiveOfferPrice * commissionRate * 100) / 100
      const totalChargeEur   = Math.round((effectiveOfferPrice + serviceFeeEur) * 100) / 100
      const appFeeEur        = Math.round((commissionEur + serviceFeeEur) * 100) / 100
      // Guide receives their full quoted price minus platform commission only.
      // Service fee is purely an angler-side charge.
      const guidePayoutEur   = Math.round((effectiveOfferPrice - commissionEur) * 100) / 100

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
                  name: booking.assigned_river
                    ? `Fishing Trip — ${booking.assigned_river}`
                    : 'Custom Fishing Trip',
                  description: [
                    `Guide: ${guide.full_name}`,
                    booking.assigned_river ? booking.assigned_river : null,
                    `${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`,
                    confirmedDaysForOffer.length > 0
                      ? `${confirmedDaysForOffer.length} day${confirmedDaysForOffer.length !== 1 ? 's' : ''}`
                      : null,
                  ].filter(Boolean).join(' · '),
                },
                unit_amount: Math.round(effectiveOfferPrice * 100),
              },
              quantity: 1,
            },
            {
              price_data: {
                currency:     'eur',
                product_data: {
                  name:        'FjordAnglers service fee',
                  description: 'Booking & service fee',
                },
                unit_amount: Math.round(serviceFeeEur * 100),
              },
              quantity: 1,
            },
          ],
          metadata: { bookingId, guideId: guide.id },
          success_url: `${await getAppUrl()}/account/bookings/${bookingId}?status=paid`,
          cancel_url:  `${await getAppUrl()}/account/bookings/${bookingId}`,
          payment_intent_data: {
            application_fee_amount: Math.round(appFeeEur * 100),
            transfer_data:          { destination: guide.stripe_account_id },
            metadata:               { bookingId },
          },
        },
        { idempotencyKey: `offer-accept-${bookingId}` },
      )

      await serviceClient
        .from('bookings')
        .update({
          stripe_checkout_id:  session.id,
          total_eur:           totalChargeEur,   // total angler pays (guide price + service fee)
          service_fee_eur:     serviceFeeEur,    // stored separately for Stripe application_fee calc
          deposit_eur:         totalChargeEur,   // paid in full upfront
          platform_fee_eur:    appFeeEur,        // commission + service fee (inquiry: combined field)
          guide_payout_eur:    guidePayoutEur,   // guide price − commission
          commission_rate:     commissionRate,
          // Canonical confirmed days array — non-consecutive safe.
          // from/to = first/last (envelope for display only).
          confirmed_days:      confirmedDaysForOffer.length > 0 ? confirmedDaysForOffer : null,
          confirmed_date_from: confirmedFromOffer,
          confirmed_date_to:   confirmedToOffer,
        })
        .eq('id', bookingId)

      // Email to guide: "angler accepted offer — payment processing"
      if (guide?.user_id) {
        const appUrlForGuide = await getAppUrl()
        serviceClient.auth.admin.getUserById(guide.user_id)
          .then(({ data }) => {
            const guideEmail = data.user?.email
            if (!guideEmail) return
            return sendOfferAcceptedGuideEmail({
              to:             guideEmail,
              guideName:      guide.full_name,
              anglerName:     (booking.angler_full_name as string | null) ?? (booking.angler_email ?? 'Angler'),
              location:       (booking.assigned_river as string | null) ?? 'TBC',
              confirmedDates: confirmedDaysForOffer.length > 0
                ? fmtEmailDays(confirmedDaysForOffer)
                : fmtEmailDateRange(confirmedFromOffer ?? '', confirmedToOffer ?? ''),
              priceEur:       effectiveOfferPrice,
              bookingUrl:     `${appUrlForGuide}/dashboard/bookings/${bookingId}`,
            })
          })
          .catch(e => console.error('[acceptBookingOffer] guide email (stripe):', e))
      }

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

  // Guide without Stripe Connect → manual model.
  // Angler pays the platform fee (commission + service fee) via Stripe Direct Charge.
  // The remainder is paid by the angler directly to the guide (cash / IBAN).
  const manualCommissionRate = guide?.commission_rate ?? env.PLATFORM_COMMISSION_RATE
  const SERVICE_FEE_RATE     = 0.05
  const SERVICE_FEE_CAP_EUR  = 50

  const commissionEur  = Math.round(effectiveOfferPrice * manualCommissionRate * 100) / 100
  const serviceFeeEur  = Math.min(
    Math.round(effectiveOfferPrice * SERVICE_FEE_RATE * 100) / 100,
    SERVICE_FEE_CAP_EUR,
  )
  const bookingFeeEur  = Math.round((commissionEur + serviceFeeEur) * 100) / 100
  const guidePayoutEur = Math.round((effectiveOfferPrice - commissionEur) * 100) / 100

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode:                 'payment',
        payment_method_types: ['card'],
        customer_email:       booking.angler_email ?? undefined,
        line_items: [{
          price_data: {
            currency:     'eur',
            product_data: {
              name: booking.assigned_river
                ? `Booking fee — ${booking.assigned_river}`
                : `Booking fee — ${guide?.full_name ?? 'Fishing Trip'}`,
              description: [
                confirmedDaysForOffer.length > 0
                  ? `${confirmedDaysForOffer.length} day${confirmedDaysForOffer.length !== 1 ? 's' : ''}`
                  : (confirmedFromOffer ?? null),
                `${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`,
                `Remaining €${guidePayoutEur} paid directly to guide`,
              ].filter(Boolean).join(' · '),
            },
            unit_amount: Math.round(bookingFeeEur * 100),
          },
          quantity: 1,
        }],
        metadata: { bookingId, guideId: guide?.id ?? '' },
        success_url: `${await getAppUrl()}/account/bookings/${bookingId}?status=paid`,
        cancel_url:  `${await getAppUrl()}/account/bookings/${bookingId}`,
      },
      { idempotencyKey: `offer-accept-${bookingId}` },
    )

    await serviceClient
      .from('bookings')
      .update({
        stripe_checkout_id:  session.id,
        // total_eur = full angler cost (guide price + service fee) so that
        // balanceEur (total - deposit) = guide_payout_eur on the booking detail page
        total_eur:           Math.round((effectiveOfferPrice + serviceFeeEur) * 100) / 100,
        service_fee_eur:     serviceFeeEur,        // stored separately (manual: combined in platform_fee_eur too)
        deposit_eur:         bookingFeeEur,        // platform fee charged via Stripe
        platform_fee_eur:    bookingFeeEur,        // commission + service fee (total platform take, manual model)
        guide_payout_eur:    guidePayoutEur,       // guide price − commission
        commission_rate:     manualCommissionRate,
        // Canonical confirmed days array — non-consecutive safe.
        confirmed_days:      confirmedDaysForOffer.length > 0 ? confirmedDaysForOffer : null,
        confirmed_date_from: confirmedFromOffer,
        confirmed_date_to:   confirmedToOffer,
      })
      .eq('id', bookingId)

    // Email to guide: "angler accepted offer — payment processing" (manual model)
    if (guide?.user_id) {
      const appUrlForGuide = await getAppUrl()
      serviceClient.auth.admin.getUserById(guide.user_id)
        .then(({ data }) => {
          const guideEmail = data.user?.email
          if (!guideEmail) return
          return sendOfferAcceptedGuideEmail({
            to:             guideEmail,
            guideName:      guide?.full_name ?? 'Guide',
            anglerName:     (booking.angler_full_name as string | null) ?? (booking.angler_email ?? 'Angler'),
            location:       (booking.assigned_river as string | null) ?? 'TBC',
            confirmedDates: confirmedDaysForOffer.length > 0
              ? fmtEmailDays(confirmedDaysForOffer)
              : fmtEmailDateRange(confirmedFromOffer ?? '', confirmedToOffer ?? ''),
            priceEur:       effectiveOfferPrice,
            bookingUrl:     `${appUrlForGuide}/dashboard/bookings/${bookingId}`,
          })
        })
        .catch(e => console.error('[acceptBookingOffer] guide email (manual):', e))
    }

    return { checkoutUrl: session.url! }
  } catch (err) {
    console.error('[acceptBookingOffer] Stripe error (manual):', err)
    await serviceClient
      .from('bookings')
      .update({ status: 'offer_sent' })
      .eq('id', bookingId)
    return { error: 'Payment setup failed. Please try again.' }
  }
}

export async function declineBookingOffer(
  bookingId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const serviceClient = createServiceClient()

  const { data: booking } = await serviceClient
    .from('bookings')
    .select('id, status, angler_id, angler_email')
    .eq('id', bookingId)
    .eq('source', 'inquiry')
    .single()

  if (!booking) return { error: 'Booking not found.' }

  const isOwner =
    booking.angler_id === user.id ||
    (user.email != null && booking.angler_email === user.email)
  if (!isOwner) return { error: 'Unauthorized.' }

  if (booking.status !== 'offer_sent') return { error: 'No active offer to decline.' }

  const { error } = await serviceClient
    .from('bookings')
    .update({
      status:            'declined',
      cancelled_by:      'angler',
      cancelled_at:      new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) return { error: 'Failed to decline offer. Please try again.' }

  // ── Unblock calendar dates ─────────────────────────────────────────────────
  // Mirrors declineBooking() — angler declined, dates are no longer committed.
  unblockBookingDates(serviceClient, bookingId)
    .catch(e => console.error('[declineBookingOffer] unblockBookingDates:', e))

  return {}
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
