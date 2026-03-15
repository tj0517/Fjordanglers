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
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      accommodation: z.boolean().optional(),
      riverType: z.string().optional(),
      notes: z.string().max(2000).optional(),
    })
    .default({}),
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
    })
    .select('id')
    .single()

  if (error || !inquiry) {
    console.error('[submitInquiry]', error)
    return { error: 'Failed to submit inquiry. Please try again.' }
  }

  // Placeholder for email notification
  console.log(`[submitInquiry] New inquiry ${inquiry.id} from ${anglerEmail}`)

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

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('trip_inquiries')
    .update({
      status: 'offer_sent',
      assigned_guide_id: offer.assignedGuideId,
      assigned_river: offer.assignedRiver,
      offer_price_eur: offer.offerPriceEur,
      offer_details: offer.offerDetails,
    })
    .eq('id', inquiryId)

  if (error) {
    console.error('[sendOffer]', error)
    return { error: 'Failed to send offer.' }
  }

  // Placeholder email
  console.log(`[sendOffer] Offer sent for inquiry ${inquiryId} — €${offer.offerPriceEur}`)

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

  // Guide without Stripe → redirect to trip page with confirmation
  return {
    checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/account/trips/${inquiryId}?status=accepted`,
  }
}
