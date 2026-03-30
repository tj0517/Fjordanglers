'use server'

/**
 * Booking Server Actions — Wave 4B.
 *
 * createBookingCheckout — creates a DB row + Stripe Checkout session (30% deposit)
 * acceptBooking         — guide accepts a pending booking
 * declineBooking        — guide declines a pending booking
 * updateGuideIban       — guide saves IBAN for manual payment model
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { getPaymentModel } from '@/lib/payment-model'

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
  // stripe_connect: angler pays 30% deposit via Stripe (balance due before trip)
  const depositEur = paymentModel === 'manual'
    ? Math.round((platformFeeEur + serviceFee) * 100) / 100
    : Math.round(totalEur * 0.3 * 100) / 100

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
    .select('id, angler_id, guide_id, guides(user_id)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }

  const guide = booking.guides as unknown as { user_id: string } | null
  const isAngler = booking.angler_id === user.id
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
// 30% deposit now, 70% balance before the trip.
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
    .select('id, status, guide_id, total_eur, platform_fee_eur, guide_payout_eur, angler_email, stripe_checkout_id, guests, commission_rate, experiences(title, price_per_person_eur)')
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
    const depositEur        = Math.round(effectiveTotalEur * 0.3 * 100) / 100
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
      const depositEur     = Math.round(effectiveTotalEur * 0.3 * 100) / 100
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
  //   Charge = 30% deposit of (tripTotal + serviceFee)
  //   Remaining 70% collected before the trip

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
        // stripe_connect: 30% deposit
        chargeCents   = Math.round(effectiveTotalEur * 0.3 * 100)
        lineItemName  = `${experienceTitle} — 30% Deposit`
        lineItemDesc  = 'Deposit to confirm your booking. Remaining balance is due before the trip.'
      }

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
          success_url: `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}?status=paid`,
          cancel_url:  `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}`,
          payment_intent_data: { metadata: { bookingId, paymentModel: guidePaymentModel } },
        },
        { idempotencyKey: `booking-accept-${bookingId}` },
      )

      stripeCheckoutId = session.id
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
      // Updated pricing when guide confirmed specific days
      ...pricingUpdate,
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[acceptBooking]', error)
    return { error: 'Failed to accept booking.' }
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
      'id, status, angler_id, total_eur, guide_payout_eur, angler_email, guide_id, experiences(title), guides(stripe_account_id, stripe_payouts_enabled)',
    )
    .eq('id', bookingId)
    .eq('angler_id', user.id)
    .eq('status', 'accepted')
    .single()

  if (!booking) return { error: 'Booking not found or not ready for payment.' }

  const experienceTitle =
    (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing Trip'

  const depositCents = Math.round(booking.total_eur * 0.3 * 100)

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
              name:        `${experienceTitle} — 30% Deposit`,
              description: 'Deposit to confirm your booking. Remaining balance is due before the trip.',
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      metadata:            { bookingId, guideId: booking.guide_id },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}?status=paid`,
      cancel_url:  `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}`,
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

  const declineable = ['pending', 'accepted', 'confirmed']
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
        success_url: `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}?status=balance_paid`,
        cancel_url:  `${env.NEXT_PUBLIC_APP_URL}/account/bookings/${bookingId}`,
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
