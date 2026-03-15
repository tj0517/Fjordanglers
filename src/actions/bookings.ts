'use server'

/**
 * Booking Server Actions — Wave 4B.
 *
 * createBookingCheckout — creates a DB row + Stripe Checkout session (30% deposit)
 * acceptBooking         — guide accepts a pending booking
 * declineBooking        — guide declines a pending booking
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'

// ─── Input schema ─────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  experienceId: z.string().uuid(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, 'Select at least one date'),
  guests: z.number().int().min(1).max(50),
  durationOptionLabel: z.string().optional(),
  anglerName: z.string().min(1, 'Name is required').max(100),
  anglerEmail: z.string().email('Valid email required'),
  anglerPhone: z.string().optional(),
  anglerCountry: z.string().optional(),
  specialRequests: z.string().max(1000).optional(),
})

type CreateBookingInput = z.infer<typeof createBookingSchema>

// ─── createBookingCheckout ────────────────────────────────────────────────────

export async function createBookingCheckout(
  input: CreateBookingInput,
): Promise<{ checkoutUrl: string } | { error: string }> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to book this experience.' }

  // ── Validate ──────────────────────────────────────────────────────────────
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    experienceId,
    dates,
    guests,
    durationOptionLabel,
    anglerName,
    anglerEmail,
    anglerPhone,
    anglerCountry,
    specialRequests,
  } = parsed.data

  // ── Fetch experience + guide ───────────────────────────────────────────────
  const { data: experience } = await supabase
    .from('experiences')
    .select(
      'id, title, price_per_person_eur, max_guests, guide_id, guides(id, full_name, stripe_account_id, stripe_charges_enabled, pricing_model)',
    )
    .eq('id', experienceId)
    .eq('published', true)
    .single()

  if (!experience) return { error: 'Experience not found or no longer available.' }

  const guideRaw = experience.guides as unknown as {
    id: string
    full_name: string
    stripe_account_id: string | null
    stripe_charges_enabled: boolean
    pricing_model: string
  } | null

  if (!guideRaw) return { error: 'Guide not found.' }
  if (!guideRaw.stripe_account_id || !guideRaw.stripe_charges_enabled) {
    return {
      error:
        'This guide has not completed their payment setup yet. Please contact us or try another experience.',
    }
  }

  // ── Validate guests ────────────────────────────────────────────────────────
  const maxGuests = experience.max_guests ?? 20
  if (guests > maxGuests) {
    return { error: `Maximum ${maxGuests} guests allowed for this experience.` }
  }

  // ── Calculate pricing ─────────────────────────────────────────────────────
  const pricePerPerson = experience.price_per_person_eur ?? 0
  const subtotal = Math.round(pricePerPerson * guests * dates.length * 100) / 100
  const serviceFee = Math.round(subtotal * 0.07 * 100) / 100 // 7% angler-side fee
  const totalEur = Math.round((subtotal + serviceFee) * 100) / 100
  const commissionRate = env.PLATFORM_COMMISSION_RATE // 0.10 by default
  const platformFeeEur = Math.round(subtotal * commissionRate * 100) / 100
  const guidePayoutEur = Math.round((subtotal - platformFeeEur) * 100) / 100
  const depositEur = Math.round(totalEur * 0.3 * 100) / 100 // 30% deposit now

  // ── Insert booking row ────────────────────────────────────────────────────
  const serviceClient = createServiceClient()

  const { data: booking, error: insertError } = await serviceClient
    .from('bookings')
    .insert({
      experience_id: experienceId,
      angler_id: user.id,
      guide_id: guideRaw.id,
      booking_date: dates[0], // primary date
      guests,
      total_eur: totalEur,
      platform_fee_eur: platformFeeEur,
      guide_payout_eur: guidePayoutEur,
      deposit_eur: depositEur,
      commission_rate: commissionRate,
      angler_full_name: anglerName,
      angler_country: anglerCountry ?? null,
      angler_phone: anglerPhone ?? null,
      special_requests: specialRequests ?? null,
      duration_option: durationOptionLabel ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !booking) {
    console.error('[createBookingCheckout] insert error:', insertError)
    return { error: 'Failed to create booking. Please try again.' }
  }

  // ── Create Stripe Checkout session ────────────────────────────────────────
  const datesSummary =
    dates.length === 1
      ? new Date(`${dates[0]}T12:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : `${dates.length} dates (${dates[0]} – ${dates[dates.length - 1]})`

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: anglerEmail,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `${experience.title} — 30% Deposit`,
                description: `${datesSummary} · ${guests} ${guests === 1 ? 'angler' : 'anglers'} · Balance due on confirmation`,
              },
              unit_amount: Math.round(depositEur * 100), // cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking.id,
          guideId: guideRaw.id,
          experienceId,
        },
        success_url: `${env.NEXT_PUBLIC_APP_URL}/book/${experienceId}/confirmation?bookingId=${booking.id}`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/experiences/${experienceId}`,
        payment_intent_data: {
          // Platform fee on the deposit portion
          application_fee_amount: Math.round(platformFeeEur * 0.3 * 100),
          transfer_data: { destination: guideRaw.stripe_account_id },
          metadata: { bookingId: booking.id },
        },
      },
      { idempotencyKey: `checkout-${booking.id}` },
    )

    // ── Save session id ──────────────────────────────────────────────────────
    await serviceClient
      .from('bookings')
      .update({ stripe_checkout_id: session.id })
      .eq('id', booking.id)

    return { checkoutUrl: session.url! }
  } catch (err) {
    console.error('[createBookingCheckout] Stripe error:', err)
    // Roll back the pending booking so the slot isn't blocked
    await serviceClient.from('bookings').delete().eq('id', booking.id)
    return { error: 'Payment setup failed. Please try again.' }
  }
}

// ─── acceptBooking ────────────────────────────────────────────────────────────

export async function acceptBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Verify caller is the guide for this booking
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guide_id')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { error: 'Only pending bookings can be accepted.' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[acceptBooking]', error)
    return { error: 'Failed to accept booking.' }
  }

  revalidatePath('/dashboard/bookings')
  return {}
}

// ─── declineBooking ───────────────────────────────────────────────────────────

export async function declineBooking(
  bookingId: string,
  reason?: string,
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

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guide_id')
    .eq('id', bookingId)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { error: 'Only pending bookings can be declined.' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      declined_reason: reason ?? null,
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[declineBooking]', error)
    return { error: 'Failed to decline booking.' }
  }

  revalidatePath('/dashboard/bookings')
  return {}
}
