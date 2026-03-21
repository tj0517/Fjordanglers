'use server'

/**
 * Trip Inquiry Server Actions — Wave 4C (Icelandic Flow).
 *
 * submitInquiry        — angler submits a custom trip request
 * updateInquiryStatus  — admin marks inquiry as 'reviewing'
 * sendOffer            — admin sends offer to angler
 * acceptOffer          — angler accepts offer → creates Stripe Checkout
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { createBookingFromInquiry } from '@/lib/create-booking-from-inquiry'
import { env } from '@/lib/env'
import type { Json } from '@/lib/supabase/database.types'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const submitInquirySchema = z.object({
  anglerName: z.string().min(1, 'Name is required').max(100),
  anglerEmail: z.string().email('Valid email required'),
  datesFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  datesTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  targetSpecies: z.array(z.string()).min(1, 'Select at least one species'),
  experienceLevel: z.enum(['beginner', 'intermediate', 'expert']),
  groupSize: z.number().int().min(1).max(50),
  preferences: z
    .object({
      // Duration & scheduling
      durationType:     z.enum(['half_day', 'full_day', 'multi_day']).optional(),
      numDays:          z.number().int().min(1).max(30).optional(),
      flexibleDates:    z.boolean().optional(),
      preferredMonths:  z.array(z.string()).optional(),
      // Group composition
      hasBeginners:     z.boolean().optional(),
      hasChildren:      z.boolean().optional(),
      // Logistics
      gearNeeded:       z.enum(['own', 'need_some', 'need_all']).optional(),
      accommodation:    z.union([
        z.boolean(),   // backward-compat with old boolean values
        z.enum(['needed', 'not_needed', 'flexible']),
      ]).optional(),
      transport:        z.enum(['need_pickup', 'self_drive', 'flexible']).optional(),
      boatPreference:   z.string().max(200).optional(),
      dietaryRestrictions: z.string().max(500).optional(),
      // Nice to have
      stayingAt:        z.string().max(200).optional(),

      photographyPackage: z.boolean().optional(),
      regionExperience: z.string().max(500).optional(),
      // Budget (existing)
      budgetMin:        z.number().optional(),
      budgetMax:        z.number().optional(),
      // Full multi-period selection (from MultiPeriodPicker)
      allDatePeriods:   z.array(
        z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      ).optional(),
      // Legacy
      riverType:        z.string().optional(),
      notes:            z.string().max(2000).optional(),
    })
    .default({}),
  guideId: z.string().uuid().optional(),
})

// ─── submitInquiry ────────────────────────────────────────────────────────────

export async function submitInquiry(
  formData: z.infer<typeof submitInquirySchema>,
): Promise<{ inquiryId: string } | { error: string }> {
  const parsed = submitInquirySchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    anglerName,
    anglerEmail,
    datesFrom,
    datesTo,
    targetSpecies,
    experienceLevel,
    groupSize,
    preferences,
    guideId,
  } = parsed.data

  // Validate date range
  if (datesFrom > datesTo) {
    return { error: 'Start date must be before end date.' }
  }

  // Get user if authenticated (optional)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()
  const { data: inquiry, error } = await serviceClient
    .from('trip_inquiries')
    .insert({
      angler_id: user?.id ?? null,
      angler_email: anglerEmail,
      angler_name: anglerName,
      dates_from: datesFrom,
      dates_to: datesTo,
      target_species: targetSpecies,
      experience_level: experienceLevel,
      group_size: groupSize,
      preferences: preferences as unknown as Json,
      status: 'inquiry',
      assigned_guide_id: guideId ?? null,
    })
    .select('id')
    .single()

  if (error || !inquiry) {
    console.error('[submitInquiry]', error)
    return { error: 'Failed to submit inquiry. Please try again.' }
  }

  // Placeholder for email notification
  console.log(`[submitInquiry] New inquiry ${inquiry.id} from ${anglerEmail}`)

  revalidatePath('/dashboard/inquiries')
  return { inquiryId: inquiry.id }
}

// ─── updateInquiryStatus ──────────────────────────────────────────────────────

export async function updateInquiryStatus(
  inquiryId: string,
  status: 'reviewing',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Admin check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Admin access required.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('trip_inquiries')
    .update({ status })
    .eq('id', inquiryId)

  if (error) {
    console.error('[updateInquiryStatus]', error)
    return { error: 'Failed to update inquiry status.' }
  }

  revalidatePath('/admin/inquiries')
  revalidatePath(`/admin/inquiries/${inquiryId}`)
  return {}
}

// ─── sendOffer ────────────────────────────────────────────────────────────────

export async function sendOffer(
  inquiryId: string,
  offer: {
    assignedGuideId: string
    assignedRiver: string
    offerPriceMinEur?: number
    offerPriceEur: number
    offerDetails: string
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Admin access required.' }

  if (offer.offerPriceEur <= 0) return { error: 'Offer price must be greater than 0.' }
  if (offer.offerPriceMinEur != null && offer.offerPriceMinEur >= offer.offerPriceEur) {
    return { error: 'Minimum price must be less than the maximum price.' }
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('trip_inquiries')
    .update({
      status: 'offer_sent',
      assigned_guide_id: offer.assignedGuideId,
      assigned_river: offer.assignedRiver,
      offer_price_min_eur: offer.offerPriceMinEur ?? null,
      offer_price_eur: offer.offerPriceEur,
      offer_details: offer.offerDetails,
    })
    .eq('id', inquiryId)

  if (error) {
    console.error('[sendOffer]', error)
    return { error: 'Failed to send offer.' }
  }

  const priceLabel = offer.offerPriceMinEur != null
    ? `€${offer.offerPriceMinEur}–€${offer.offerPriceEur}`
    : `€${offer.offerPriceEur}`
  console.log(`[sendOffer] Offer sent for inquiry ${inquiryId} — ${priceLabel}`)

  revalidatePath('/admin/inquiries')
  revalidatePath(`/admin/inquiries/${inquiryId}`)
  return {}
}

// ─── acceptOffer ──────────────────────────────────────────────────────────────

export async function acceptOffer(
  inquiryId: string,
): Promise<{ checkoutUrl: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to accept this offer.' }

  const serviceClient = createServiceClient()

  // Fetch inquiry — verify ownership
  const { data: inquiry } = await serviceClient
    .from('trip_inquiries')
    .select('*, guides(id, full_name, stripe_account_id, stripe_charges_enabled)')
    .eq('id', inquiryId)
    .single()

  if (!inquiry) return { error: 'Inquiry not found.' }

  // Ownership check: angler_id or email match
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const userEmail = authUser?.email
  const isOwner =
    inquiry.angler_id === user.id ||
    (userEmail != null && inquiry.angler_email === userEmail)

  if (!isOwner) return { error: 'You do not have permission to accept this offer.' }
  if (inquiry.status !== 'offer_sent') {
    return { error: 'No pending offer to accept.' }
  }
  if (!inquiry.offer_price_eur) return { error: 'No offer price set.' }

  const guide = inquiry.guides as unknown as {
    id: string
    full_name: string
    stripe_account_id: string | null
    stripe_charges_enabled: boolean
  } | null

  // Mark as offer_accepted
  await serviceClient
    .from('trip_inquiries')
    .update({ status: 'offer_accepted' })
    .eq('id', inquiryId)

  // If guide has Stripe → create Checkout session
  if (guide?.stripe_account_id && guide.stripe_charges_enabled) {
    try {
      const commissionRate = env.PLATFORM_COMMISSION_RATE
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: inquiry.angler_email,
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: `Custom Fishing Trip — ${inquiry.dates_from} to ${inquiry.dates_to}`,
                  description: `Guide: ${guide.full_name}${inquiry.assigned_river ? ` · ${inquiry.assigned_river}` : ''} · ${inquiry.group_size} ${inquiry.group_size === 1 ? 'angler' : 'anglers'}`,
                },
                unit_amount: Math.round(inquiry.offer_price_eur * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            inquiryId,
            guideId: guide.id,
          },
          success_url: `${env.NEXT_PUBLIC_APP_URL}/account/trips/${inquiryId}?status=paid`,
          cancel_url: `${env.NEXT_PUBLIC_APP_URL}/account/trips/${inquiryId}`,
          payment_intent_data: {
            application_fee_amount: Math.round(
              inquiry.offer_price_eur * commissionRate * 100,
            ),
            transfer_data: { destination: guide.stripe_account_id },
            metadata: { inquiryId },
          },
        },
        { idempotencyKey: `inquiry-checkout-${inquiryId}` },
      )

      await serviceClient
        .from('trip_inquiries')
        .update({ stripe_checkout_id: session.id })
        .eq('id', inquiryId)

      return { checkoutUrl: session.url! }
    } catch (err) {
      console.error('[acceptOffer] Stripe error:', err)
      // Revert to offer_sent
      await serviceClient
        .from('trip_inquiries')
        .update({ status: 'offer_sent' })
        .eq('id', inquiryId)
      return { error: 'Payment setup failed. Please try again.' }
    }
  }

  // Guide without Stripe → confirm directly (no payment needed)
  await serviceClient
    .from('trip_inquiries')
    .update({ status: 'confirmed' })
    .eq('id', inquiryId)

  // Create a real booking record so the chat & booking dashboard work
  await createBookingFromInquiry(inquiryId, serviceClient, null)

  return {
    checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/account/trips/${inquiryId}?status=accepted`,
  }
}

// ─── declineInquiry ───────────────────────────────────────────────────────────

export async function declineInquiry(
  inquiryId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Find guide profile
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  const serviceClient = createServiceClient()

  // Fetch inquiry to verify authorization
  const { data: inquiry } = await serviceClient
    .from('trip_inquiries')
    .select('id, assigned_guide_id, status')
    .eq('id', inquiryId)
    .single()

  if (!inquiry) return { error: 'Inquiry not found.' }

  // Auth: must be assigned to this guide or unassigned
  if (inquiry.assigned_guide_id !== null && inquiry.assigned_guide_id !== guide.id) {
    return { error: 'Not authorized.' }
  }

  // Can only decline open/reviewing inquiries
  const declineable: string[] = ['inquiry', 'reviewing', 'offer_sent']
  if (!declineable.includes(inquiry.status)) {
    return { error: 'This inquiry cannot be declined at its current status.' }
  }

  const { error } = await serviceClient
    .from('trip_inquiries')
    .update({ status: 'cancelled' })
    .eq('id', inquiryId)

  if (error) {
    console.error('[declineInquiry]', error)
    return { error: 'Failed to decline inquiry. Please try again.' }
  }

  revalidatePath('/dashboard/inquiries')
  revalidatePath(`/dashboard/inquiries/${inquiryId}`)
  return {}
}

// ─── sendOfferByGuide ─────────────────────────────────────────────────────────

export async function sendOfferByGuide(
  inquiryId: string,
  offer: {
    assignedRiver:   string
    offerPriceMinEur?: number
    offerPriceEur:   number
    offerDetails:    string
    /** Confirmed trip date range (guide may differ from angler's request) */
    offerDateFrom?:  string   // YYYY-MM-DD
    offerDateTo?:    string   // YYYY-MM-DD
    /** Meeting / departure point GPS pin */
    offerMeetingLat?: number
    offerMeetingLng?: number
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Find the guide profile for this user
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) return { error: 'Guide profile not found.' }

  // Validate offer price
  if (offer.offerPriceEur <= 0) return { error: 'Offer price must be greater than 0.' }
  if (offer.offerPriceMinEur != null && offer.offerPriceMinEur >= offer.offerPriceEur) {
    return { error: 'Minimum price must be less than the maximum price.' }
  }

  const serviceClient = createServiceClient()

  // Fetch the inquiry
  const { data: inquiry } = await serviceClient
    .from('trip_inquiries')
    .select('id, assigned_guide_id, status')
    .eq('id', inquiryId)
    .single()

  if (!inquiry) return { error: 'Inquiry not found.' }

  // Authorization: must be assigned to this guide, or unassigned
  if (
    inquiry.assigned_guide_id !== null &&
    inquiry.assigned_guide_id !== guide.id
  ) {
    return { error: 'You are not authorized to send an offer for this inquiry.' }
  }

  // Status check
  if (inquiry.status !== 'inquiry' && inquiry.status !== 'reviewing') {
    return { error: 'An offer can only be sent for inquiries in inquiry or reviewing status.' }
  }

  const { error: updateError } = await serviceClient
    .from('trip_inquiries')
    .update({
      status:              'offer_sent',
      assigned_guide_id:   guide.id,
      assigned_river:      offer.assignedRiver,
      offer_price_min_eur: offer.offerPriceMinEur ?? null,
      offer_price_eur:     offer.offerPriceEur,
      offer_details:       offer.offerDetails,
      offer_date_from:     offer.offerDateFrom    ?? null,
      offer_date_to:       offer.offerDateTo      ?? null,
      offer_meeting_lat:   offer.offerMeetingLat  ?? null,
      offer_meeting_lng:   offer.offerMeetingLng  ?? null,
    })
    .eq('id', inquiryId)

  if (updateError) {
    console.error('[sendOfferByGuide]', updateError)
    return { error: 'Failed to send offer. Please try again.' }
  }

  revalidatePath('/dashboard/inquiries')
  revalidatePath(`/dashboard/inquiries/${inquiryId}`)
  return {}
}
