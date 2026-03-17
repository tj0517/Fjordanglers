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
  anglerName: z.string().max(100).optional(),
  anglerEmail: z.string().email('Valid email required'),
  anglerPhone: z.string().optional(),
  anglerCountry: z.string().optional(),
  specialRequests: z.string().max(1000).optional(),
})

type CreateBookingInput = z.infer<typeof createBookingSchema>

// ─── createBookingCheckout ────────────────────────────────────────────────────

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
      angler_id: user?.id ?? null,
      angler_email: anglerEmail,
      guide_id: guideRaw.id,
      booking_date: dates[0], // primary date
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
