'use server'

/**
 * FA Inquiry Server Actions.
 *
 * sendDepositLink(inquiryId)
 *   FA sends a Stripe Checkout deposit link to the angler.
 *
 * saveRichOffer(inquiryId, params)
 *   FA builds a full offer: trip plan, license, inclusions, questions, price,
 *   deposit, refund reason. Generates a unique magic-link token, saves everything
 *   to the inquiry, and sends the offer email to the angler.
 *
 * submitOfferAnswers(token, answers)
 *   Angler submits their answers on the public /offers/[token] page.
 *   Returns a Stripe Checkout URL for the deposit payment.
 *
 * getOfferByToken(token)
 *   Fetches an inquiry (with guide + trip) by its offer token.
 *   Public — no auth required; token IS the authentication.
 *
 * sendMessageToAngler(inquiryId, subject, body)
 *   FA sends a plain-text email to the angler from the admin.
 *   Message is stored in inquiry_messages for audit trail.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import {
  sendDepositLinkAnglerEmail,
  sendInquiryMessageAnglerEmail,
  sendRichOfferAnglerEmail,
  sendGuideAssignedEmail,
} from '@/lib/email'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendDepositLinkResult =
  | { success: true;  checkoutUrl: string }
  | { success: false; error: string }

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

export interface OfferQuestion {
  id: string
  question: string
}

export interface ScheduleEntry {
  id: string
  label: string       // "Day 1", "Evening", "Arrival"
  title: string       // "Arrival & Briefing"
  description: string
}

export interface OfferAnswer {
  id: string
  question: string
  answer: string
}

// ─── Offer option (multi-option proposal support) ─────────────────────────────

export interface OfferOptionInput {
  id:           string
  title:        string
  totalEur:     number
  depositEur:   number
  refundReason: string | null
  inclusions:   string[]
  schedule:     ScheduleEntry[]
  notes:        string | null
}

export interface RichOfferParams {
  totalPriceEur: number
  depositEur: number
  notes: string | null
  tripPlan: string | null
  licenseInfo: string | null
  licenseHeading: string | null
  inclusions: string[]
  questions: OfferQuestion[]
  refundReason: string | null
  photos: string[]
  location: string | null
  whatToBring: string[]
  schedule: ScheduleEntry[]
  locationLat: number | null
  locationLng: number | null
  locationZoom: number
  locationGeoJson: object | null
  /** Multi-option proposal. When provided, takes precedence over flat fields for display. */
  options?: OfferOptionInput[]
}

export interface OfferPageData {
  inquiryId: string
  anglerName: string
  anglerCountry: string
  tripTitle: string
  guideName: string
  guidePhotoUrl: string | null
  guideBio: string | null
  requestedDates: string[]
  partySize: number
  offerTotalEur: number
  offerDepositEur: number
  notes: string | null
  tripPlan: string | null
  /** Multi-option proposal — empty array means single-option (legacy) */
  options: OfferOptionInput[]
  /** Which option the angler selected when accepting */
  selectedOptionId: string | null
  licenseInfo: string | null
  licenseHeading: string | null
  inclusions: string[]
  questions: OfferQuestion[]
  answers: OfferAnswer[]
  refundReason: string | null
  status: string
  photos: string[]
  location: string | null
  whatToBring: string[]
  schedule: ScheduleEntry[]
  locationLat: number | null
  locationLng: number | null
  locationZoom: number
  locationGeoJson: object | null
}

// ─── createManualInquiry ──────────────────────────────────────────────────────

/**
 * FA creates an inquiry manually — for leads that came via Instagram, WhatsApp,
 * email, or any channel outside the website form.
 */
export async function createManualInquiry(params: {
  anglerName:     string
  anglerEmail:    string
  partySize:      number
  tripId:         string | null
  requestedDates: string[]
  message:        string | null
  source:         string | null
  status:         string
}): Promise<ActionResult & { inquiryId?: string }> {
  if (params.anglerName.trim() === '') return { success: false, error: 'Name is required' }
  if (params.anglerEmail.trim() === '') return { success: false, error: 'Email is required' }
  if (params.partySize < 1) return { success: false, error: 'Party size must be at least 1' }

  const svc = createServiceClient()

  const row: Record<string, unknown> = {
    angler_name:     params.anglerName.trim(),
    angler_email:    params.anglerEmail.trim().toLowerCase(),
    party_size:      params.partySize,
    status:          params.status,
    requested_dates: params.requestedDates,
  }
  if (params.tripId != null && params.tripId !== '') row.trip_id = params.tripId
  if (params.message != null && params.message.trim() !== '') row.message = params.message.trim()
  // Store source in internal_notes so it's visible in the deal tracker
  if (params.source != null && params.source.trim() !== '') {
    row.internal_notes = `Source: ${params.source.trim()}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('inquiries')
    .insert(row)
    .select('id')
    .single()

  if (error != null) {
    console.error('[createManualInquiry] DB error:', error)
    return { success: false, error: error.message }
  }

  console.log(`[createManualInquiry] Created inquiry ${data.id} for ${params.anglerName} (source: ${params.source ?? 'manual'})`)
  return { success: true, inquiryId: data.id }
}

// ─── sendDepositLink ──────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session and sends the link to the angler via email.
 *
 * Deposit amount priority:
 *   1. inquiry.offer_deposit_eur — if FA created an offer, always use that exact amount.
 *   2. depositPercent × trip price — legacy fallback.
 *
 * Allowed statuses: any active status or deposit_sent (resend).
 * Blocked statuses: deposit_paid, completed, cancelled.
 */
export async function sendDepositLink(
  inquiryId: string,
  depositPercent: number = 30,
): Promise<SendDepositLinkResult> {
  if (depositPercent < 1 || depositPercent > 100) {
    return { success: false, error: 'depositPercent must be 1–100' }
  }

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawInquiry } = await (svc as any)
    .from('inquiries')
    .select('id, status, angler_email, angler_name, angler_country, requested_dates, party_size, trip_id, message, offer_deposit_eur')
    .eq('id', inquiryId)
    .single()

  if (rawInquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  const blocked = ['deposit_paid', 'completed', 'cancelled']
  if (blocked.includes(rawInquiry.status)) {
    return { success: false, error: `Cannot send deposit link — inquiry is ${rawInquiry.status}` }
  }

  const offerDepositEur = rawInquiry.offer_deposit_eur as number | null

  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, slug, price_per_person_eur, guide_id')
    .eq('id', rawInquiry.trip_id)
    .single()

  if (trip == null) {
    return { success: false, error: 'Trip not found' }
  }

  let depositCents: number
  let depositPctUsed: number

  if (offerDepositEur != null && offerDepositEur > 0) {
    depositCents   = Math.round(offerDepositEur * 100)
    depositPctUsed = 0
  } else {
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
        cancel_url:  trip.slug != null ? `${baseUrl}/experiences/${trip.slug}` : baseUrl,
      },
      {
        idempotencyKey: `deposit-${inquiryId}-${Date.now()}`,
      },
    )
  } catch (err) {
    console.error('[sendDepositLink] Stripe error:', err)
    return { success: false, error: 'Failed to create Stripe checkout session' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (svc as any)
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

// ─── saveRichOffer ────────────────────────────────────────────────────────────

/**
 * FA creates a rich personalised offer.
 * Generates a unique magic-link token, saves all offer fields, and sends the
 * offer email containing a link to /offers/[token].
 */
export async function saveRichOffer(
  inquiryId: string,
  params: RichOfferParams,
): Promise<ActionResult & { offerUrl?: string }> {
  const {
    totalPriceEur, depositEur, notes,
    tripPlan, licenseInfo, licenseHeading, inclusions,
    questions, refundReason,
    photos, location, whatToBring,
    schedule, locationLat, locationLng, locationZoom, locationGeoJson,
  } = params

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
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

  const { data: trip } = await svc
    .from('experiences')
    .select('title, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  // Generate unique token (crypto.randomUUID is available in Node 19+/Edge)
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  const baseUrl  = env.NEXT_PUBLIC_APP_URL
  const offerUrl = `${baseUrl}/offers/${token}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (svc as any)
    .from('inquiries')
    .update({
      offer_total_eur:         totalPriceEur,
      offer_deposit_eur:       depositEur,
      offer_notes:             notes?.trim() || null,
      offer_trip_plan:         tripPlan?.trim() || null,
      offer_license_info:      licenseInfo?.trim() || null,
      offer_inclusions:        inclusions,
      offer_questions:         questions,
      offer_refund_reason:     refundReason?.trim() || null,
      offer_photos:            photos,
      offer_location:          location?.trim() || null,
      offer_what_to_bring:     whatToBring,
      offer_schedule:          schedule,
      offer_license_heading:   licenseHeading?.trim() || null,
      offer_location_lat:      locationLat,
      offer_location_lng:      locationLng,
      offer_location_zoom:     locationZoom,
      offer_location_geojson:  locationGeoJson,
      offer_options:           params.options ?? null,
      offer_token:             token,
      offer_token_expires_at:  expiresAt,
      offer_sent_at:           new Date().toISOString(),
      stage_reached:           'offer_sent',
    })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[saveRichOffer] DB error:', updateError)
    return { success: false, error: 'Failed to save offer' }
  }

  // Fetch guide info for the email
  const guideId = trip?.guide_id
  const { data: guide } = guideId
    ? await svc.from('guides').select('full_name').eq('id', guideId).single()
    : { data: null }

  await sendRichOfferAnglerEmail({
    to:              inquiry.angler_email,
    anglerName:      inquiry.angler_name,
    tripTitle:       trip?.title ?? 'Your trip',
    guideName:       guide?.full_name ?? 'Your guide',
    requestedDates:  (inquiry.requested_dates as string[] | null) ?? [],
    partySize:       inquiry.party_size ?? 1,
    offerTotalEur:   totalPriceEur,
    offerDepositEur: depositEur,
    notes:           notes?.trim() || null,
    offerUrl,
    inquiryId,
  })

  console.log(`[saveRichOffer] Rich offer saved for inquiry ${inquiryId} — total €${totalPriceEur}, deposit €${depositEur} — token ${token}`)

  return { success: true, offerUrl }
}

// ─── getOfferByToken ──────────────────────────────────────────────────────────

/**
 * Public action — fetches an inquiry with guide + trip data by offer token.
 * Returns null if token not found or expired.
 */
export async function getOfferByToken(token: string): Promise<OfferPageData | null> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('*, trip_id, guide_id')
    .eq('offer_token', token)
    .single()

  if (inquiry == null) return null

  // Check expiry
  if (inquiry.offer_token_expires_at != null) {
    const expires = new Date(inquiry.offer_token_expires_at)
    if (expires < new Date()) return null
  }

  const { data: trip } = await svc
    .from('experiences')
    .select('title, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  const guideId = (inquiry.assigned_guide_id as string | null) ?? trip?.guide_id ?? null
  const { data: guide } = guideId
    ? await svc
        .from('guides')
        .select('full_name, bio, avatar_url')
        .eq('id', guideId)
        .single()
    : { data: null }

  return {
    inquiryId:        inquiry.id,
    anglerName:       inquiry.angler_name,
    anglerCountry:    (inquiry.angler_country as string | null) ?? '',
    tripTitle:        trip?.title ?? 'Your trip',
    guideName:        guide?.full_name ?? 'Your guide',
    guidePhotoUrl:    guide?.avatar_url ?? null,
    guideBio:         guide?.bio ?? null,
    requestedDates:   (inquiry.requested_dates as string[] | null) ?? [],
    partySize:        inquiry.party_size ?? 1,
    offerTotalEur:    Number(inquiry.offer_total_eur ?? 0),
    offerDepositEur:  Number(inquiry.offer_deposit_eur ?? 0),
    notes:            inquiry.offer_notes ?? null,
    tripPlan:         inquiry.offer_trip_plan ?? null,
    licenseInfo:      inquiry.offer_license_info ?? null,
    inclusions:       (inquiry.offer_inclusions as string[] | null) ?? [],
    questions:        (inquiry.offer_questions as OfferQuestion[] | null) ?? [],
    answers:          (inquiry.offer_answers as OfferAnswer[] | null) ?? [],
    refundReason:     inquiry.offer_refund_reason ?? null,
    status:           inquiry.status,
    photos:           (inquiry.offer_photos as string[] | null) ?? [],
    location:         inquiry.offer_location ?? null,
    whatToBring:      (inquiry.offer_what_to_bring as string[] | null) ?? [],
    schedule:         (inquiry.offer_schedule as ScheduleEntry[] | null) ?? [],
    licenseHeading:   inquiry.offer_license_heading ?? null,
    locationLat:      inquiry.offer_location_lat != null ? Number(inquiry.offer_location_lat) : null,
    locationLng:      inquiry.offer_location_lng != null ? Number(inquiry.offer_location_lng) : null,
    locationZoom:     inquiry.offer_location_zoom != null ? Number(inquiry.offer_location_zoom) : 10,
    locationGeoJson:  (inquiry.offer_location_geojson as object | null) ?? null,
    options:          (inquiry.offer_options as OfferOptionInput[] | null) ?? [],
    selectedOptionId: inquiry.selected_option_id ?? null,
  }
}

// ─── submitOfferAnswers ───────────────────────────────────────────────────────

/**
 * Angler submits answers to FA's questions on the public offer page.
 * Returns a Stripe Checkout URL for the deposit payment.
 */
export async function submitOfferAnswers(
  token: string,
  answers: OfferAnswer[],
): Promise<SendDepositLinkResult> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id, status, angler_email, angler_name, trip_id, party_size, offer_deposit_eur, offer_token_expires_at')
    .eq('offer_token', token)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Offer not found or link has expired' }
  }

  if (inquiry.offer_token_expires_at != null && new Date(inquiry.offer_token_expires_at) < new Date()) {
    return { success: false, error: 'This offer link has expired. Please contact us for a new one.' }
  }

  if (['deposit_paid', 'completed', 'cancelled'].includes(inquiry.status)) {
    return { success: false, error: `Inquiry is already ${inquiry.status}` }
  }

  // Save answers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({ offer_answers: answers })
    .eq('id', inquiry.id)

  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', inquiry.trip_id)
    .single()

  const depositCents = Math.round(Number(inquiry.offer_deposit_eur ?? 0) * 100)
  if (depositCents < 50) {
    return { success: false, error: 'Deposit amount is too low' }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL

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
              name: `Refundable Deposit — ${trip?.title ?? 'Your Trip'}`,
              description: `Secures your spot. The deposit is refundable — ${inquiry.party_size} person(s).`,
            },
          },
          quantity: 1,
        }],
        customer_email: inquiry.angler_email,
        metadata: {
          inquiry_id:   inquiry.id,
          trip_id:      inquiry.trip_id,
          payment_type: 'inquiry_deposit',
        },
        success_url: `${baseUrl}/inquiry-confirmed?inquiry_id=${inquiry.id}`,
        cancel_url:  `${baseUrl}/offers/${token}`,
      },
      {
        idempotencyKey: `offer-deposit-${inquiry.id}-${Date.now()}`,
      },
    )
  } catch (err) {
    console.error('[submitOfferAnswers] Stripe error:', err)
    return { success: false, error: 'Failed to create payment session. Please try again.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({
      status:                    'deposit_sent',
      deposit_amount:            depositCents / 100,
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiry.id)

  return { success: true, checkoutUrl: session.url! }
}

// ─── saveOffer (compatibility alias) ─────────────────────────────────────────

/**
 * Legacy alias — used by the admin InquiryActionPanel.
 * Wraps saveRichOffer with the old minimal interface.
 */
export async function saveOffer(
  inquiryId: string,
  params: { totalPriceEur: number; depositEur: number; notes: string | null },
): Promise<ActionResult> {
  return saveRichOffer(inquiryId, {
    totalPriceEur:  params.totalPriceEur,
    depositEur:     params.depositEur,
    notes:          params.notes,
    tripPlan:       null,
    licenseInfo:    null,
    inclusions:     [],
    questions:      [],
    refundReason:   null,
    photos:         [],
    location:       null,
    whatToBring:    [],
    schedule:       [],
    licenseHeading: null,
    locationLat:    null,
    locationLng:    null,
    locationZoom:   10,
    locationGeoJson: null,
  })
}

// ─── updateInquiryStatus ──────────────────────────────────────────────────────

/**
 * Manually update an inquiry's status.
 * Used by FA from the admin panel — communication with angler happens via
 * external email, so the status must be manually kept in sync.
 *
 * When marking as 'lost', optionally supply a reason (stored in lost_reason).
 * All other status transitions clear lost_reason.
 */
export async function updateInquiryStatus(
  inquiryId: string,
  status: string,
  lostReason?: string | null,
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { status }
  if (status === 'lost') {
    update.lost_reason = lostReason?.trim() || null
  } else {
    update.lost_reason = null
  }
  if (status === 'completed') {
    update.stage_reached = 'completed'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update(update)
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  console.log(`[updateInquiryStatus] Inquiry ${inquiryId} → ${status}`)
  return { success: true }
}

// ─── saveInternalDeal ─────────────────────────────────────────────────────────

/**
 * Save deal amounts for FA's internal tracking — no email sent to angler.
 * Used to track the agreed deal total and FA's commission for stats/reporting.
 */
export async function saveInternalDeal(
  inquiryId: string,
  params: {
    dealTotalEur:  number | null
    commissionEur: number | null
    internalNotes: string | null
    dealCurrency:  'EUR' | 'USD'
  },
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      internal_deal_total_eur: params.dealTotalEur,
      internal_commission_eur: params.commissionEur,
      internal_notes:          params.internalNotes,
      deal_currency:           params.dealCurrency,
    })
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  console.log(`[saveInternalDeal] Inquiry ${inquiryId} — total ${params.dealCurrency} ${params.dealTotalEur}, commission ${params.dealCurrency} ${params.commissionEur}`)
  return { success: true }
}

// ─── sendMessageToAngler ──────────────────────────────────────────────────────

/**
 * FA sends a plain-text message to the angler via email.
 * Stored in inquiry_messages for audit trail.
 */
export async function sendMessageToAngler(
  inquiryId: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  if (subject.trim() === '') return { success: false, error: 'Subject is required' }
  if (body.trim() === '')    return { success: false, error: 'Message body is required' }

  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, trip_id')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', inquiry.trip_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (svc as any).from('inquiry_messages')
    .insert({
      inquiry_id: inquiryId,
      subject:    subject.trim(),
      body:       body.trim(),
    })

  if (insertError != null) {
    console.error('[sendMessageToAngler] DB error:', insertError)
  }

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

// ─── logLeadMessage ───────────────────────────────────────────────────────────

/**
 * FA logs a manual communication with a client or guide.
 * No email is sent — this is purely an internal CRM record.
 * Also updates last_contact_at on the inquiry.
 */

export type LeadMessage = {
  id:           string
  inquiry_id:   string
  direction:    'inbound' | 'outbound'
  channel:      'whatsapp' | 'email' | 'note'
  contact_type: 'client' | 'guide'
  contact_name: string
  content:      string
  created_at:   string
  created_by:   string
}

export interface LogLeadMessageParams {
  direction:   'inbound' | 'outbound'
  channel:     'whatsapp' | 'email' | 'note'
  contactType: 'client' | 'guide'
  contactName: string
  content:     string
  createdBy?:  string
}

export async function logLeadMessage(
  inquiryId: string,
  params: LogLeadMessageParams,
): Promise<ActionResult> {
  if (params.content.trim()     === '') return { success: false, error: 'Content is required' }
  if (params.contactName.trim() === '') return { success: false, error: 'Contact name is required' }

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from('lead_messages').insert({
    inquiry_id:   inquiryId,
    direction:    params.direction,
    channel:      params.channel,
    contact_type: params.contactType,
    contact_name: params.contactName.trim(),
    content:      params.content.trim(),
    created_by:   params.createdBy ?? 'tymon',
  })

  if (error != null) {
    console.error('[logLeadMessage] DB error:', error)
    return { success: false, error: error.message }
  }

  // Bump last_contact_at on the parent inquiry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', inquiryId)

  console.log(`[logLeadMessage] ${params.direction} ${params.channel} logged for inquiry ${inquiryId}`)
  return { success: true }
}

// ─── bulkLogLeadMessages ──────────────────────────────────────────────────────

/**
 * Bulk-insert multiple lead_messages in one transaction.
 * Used by the conversation importer (paste WhatsApp/email thread).
 * Each message may carry its own createdAt for historical imports.
 * Content is stored as Markdown for AI readability.
 */

export interface BulkLeadMessage {
  direction:   'inbound' | 'outbound'
  channel:     'whatsapp' | 'email' | 'note'
  contactType: 'client' | 'guide'
  contactName: string
  content:     string          // Markdown-formatted text
  createdAt?:  string          // ISO — use parsed timestamp if available
  createdBy?:  string
}

export async function bulkLogLeadMessages(
  inquiryId: string,
  messages:  BulkLeadMessage[],
): Promise<ActionResult & { count?: number }> {
  if (messages.length === 0) return { success: false, error: 'No messages to save' }

  const svc = createServiceClient()

  const now = new Date().toISOString()
  const rows = messages.map(m => ({
    inquiry_id:   inquiryId,
    direction:    m.direction,
    channel:      m.channel,
    contact_type: m.contactType,
    contact_name: m.contactName.trim() || 'Unknown',
    content:      m.content.trim(),
    created_by:   m.createdBy ?? 'tymon',
    created_at:   m.createdAt ?? now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from('lead_messages').insert(rows)
  if (error != null) {
    console.error('[bulkLogLeadMessages] DB error:', error)
    return { success: false, error: error.message }
  }

  // Bump last_contact_at to the most recent message
  const latestAt = messages
    .map(m => m.createdAt ?? new Date().toISOString())
    .sort()
    .at(-1) ?? new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({ last_contact_at: latestAt })
    .eq('id', inquiryId)

  console.log(`[bulkLogLeadMessages] Saved ${messages.length} messages for inquiry ${inquiryId}`)
  return { success: true, count: messages.length }
}

// ─── updateNextAction ─────────────────────────────────────────────────────────

/**
 * FA sets the "next action" reminder on an inquiry.
 * Internal only — no email sent.
 */
export async function updateNextAction(
  inquiryId: string,
  nextAction: string | null,
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({ next_action: nextAction?.trim() || null })
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  console.log(`[updateNextAction] Inquiry ${inquiryId} — "${nextAction}"`)
  return { success: true }
}

// ─── Trip brief + Todo types ─────────────────────────────────────────────────

export interface GuideOption {
  spot:          string
  species:       string[] | null   // multi-select; null = not filled
  currency:      'EUR' | 'USD' | 'ISK'
  license_price: number | null
  guide_price:   number | null
  description:   string | null
  photos:        string[]
}

export interface TripDetails {
  // FA fills (shown to guide as brief):
  confirmed_date:    string | null   // FA-editable override of inquiry dates (free text)
  confirmed_party_size: number | null // FA-editable override of inquiry party size
  price_range:       string | null
  date_flexibility:  string | null  // 'fixed' | 'flexible_1_2' | 'flexible_week' | 'very_flexible'
  target_species:    string | null
  accommodation:     string | null
  guide_notes:       string | null
  // Guide fills (shown to FA as their offer response):
  guide_final_dates: string | null   // guide's confirmed/adjusted dates (free text)
  guide_options:     GuideOption[]
}


// ─── assignGuideToInquiry ─────────────────────────────────────────────────────

/**
 * FA assigns a guide to an inquiry.
 * Saves assigned_guide_id + assigned_at, then emails the guide.
 */
export async function assignGuideToInquiry(
  inquiryId: string,
  guideId: string,
): Promise<ActionResult> {
  const svc = createServiceClient()

  // Update inquiry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (svc as any)
    .from('inquiries')
    .update({ assigned_guide_id: guideId, assigned_at: new Date().toISOString() })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[assignGuideToInquiry] DB error:', updateError)
    return { success: false, error: updateError.message }
  }

  // Fetch guide email + name
  const { data: guide } = await svc
    .from('guides')
    .select('id, full_name, invite_email, user_id')
    .eq('id', guideId)
    .single()

  if (guide == null) {
    return { success: false, error: 'Guide not found' }
  }

  // Resolve email: prefer invite_email, fall back to auth user email
  let guideEmail: string | null = guide.invite_email ?? null
  if ((guideEmail == null || guideEmail.trim() === '') && guide.user_id != null) {
    const { data: authUser } = await svc.auth.admin.getUserById(guide.user_id)
    guideEmail = authUser?.user?.email ?? null
  }

  // Fetch inquiry info for email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('angler_name, angler_country, message, requested_dates, party_size')
    .eq('id', inquiryId)
    .single()

  // Fetch trip brief (graceful — table may not exist yet)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tripDetails: Record<string, unknown> | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: td } = await (svc as any)
      .from('inquiry_trip_details')
      .select('confirmed_date, confirmed_party_size, price_range, date_flexibility, target_species, accommodation, guide_notes')
      .eq('inquiry_id', inquiryId)
      .maybeSingle()
    tripDetails = td ?? null
  } catch {
    // Table not yet migrated — graceful fallback
  }

  const baseUrl   = await getAppUrl()
  const tripsUrl  = `${baseUrl}/dashboard/trips/${inquiryId}`
  const acceptUrl = `${baseUrl}/dashboard/trips/${inquiryId}?action=accept`

  if (guideEmail != null && inquiry != null) {
    sendGuideAssignedEmail({
      to:             guideEmail,
      guideName:      guide.full_name ?? 'Guide',
      anglerName:     inquiry.angler_name,
      anglerCountry:  (inquiry.angler_country as string | null) ?? null,
      confirmedDate:   (tripDetails?.confirmed_date as string | null) ?? null,
      requestedDates:  (inquiry.requested_dates as string[] | null) ?? [],
      dateFlexibility: (tripDetails?.date_flexibility as string | null) ?? null,
      partySize:       (tripDetails?.confirmed_party_size as number | null) ?? (inquiry.party_size as number) ?? 1,
      targetSpecies:  (tripDetails?.target_species as string | null) ?? null,
      priceRange:     (tripDetails?.price_range as string | null) ?? null,
      accommodation:  (tripDetails?.accommodation as string | null) ?? null,
      guideNotes:     (tripDetails?.guide_notes as string | null) ?? null,
      anglerMessage:  (inquiry.message as string | null) ?? null,
      acceptUrl,
      tripsUrl,
    }).catch(err => console.error('[assignGuideToInquiry] Email error:', err))
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[assignGuideToInquiry] Inquiry ${inquiryId} → guide ${guideId}`)
  return { success: true }
}

// ─── unassignGuide ────────────────────────────────────────────────────────────

/**
 * FA removes the currently assigned guide from an inquiry.
 * Clears assignment fields so a new guide can be assigned.
 */
export async function unassignGuide(inquiryId: string): Promise<ActionResult> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      assigned_guide_id:    null,
      assigned_at:          null,
      guide_acceptance:     null,
      guide_decline_reason: null,
      guide_offer_eta:      null,
    })
    .eq('id', inquiryId)

  if (error != null) {
    console.error('[unassignGuide] DB error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[unassignGuide] Inquiry ${inquiryId} — guide unassigned`)
  return { success: true }
}

// ─── setExternalOffer ─────────────────────────────────────────────────────────

/**
 * Mark (or unmark) an inquiry's offer as handled externally
 * (e.g. via WhatsApp / email outside the system).
 */
export async function setExternalOffer(
  inquiryId: string,
  value: boolean,
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({ external_offer_sent: value })
    .eq('id', inquiryId)
  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/' + inquiryId)
  revalidatePath('/admin/inquiries')
  return { success: true }
}

// ─── assignGuideSilently ──────────────────────────────────────────────────────

/**
 * FA links a guide to an inquiry without sending any notification.
 * Used for "old-way" offers FA built manually — guide is visible in admin only.
 */
export async function assignGuideSilently(
  inquiryId: string,
  guideId: string,
): Promise<ActionResult> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      assigned_guide_id: guideId,
      assigned_at:       new Date().toISOString(),
      guide_acceptance:  'accepted',   // silent = no need to accept, treat as already confirmed
    })
    .eq('id', inquiryId)

  if (error != null) {
    console.error('[assignGuideSilently] DB error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[assignGuideSilently] Inquiry ${inquiryId} → guide ${guideId} (silent, auto-accepted)`)
  return { success: true }
}

// ─── respondToAssignment ──────────────────────────────────────────────────────

/**
 * Guide accepts or declines the assignment to an inquiry.
 * Verifies ownership: the inquiry must have assigned_guide_id = this guide.
 */
export async function respondToAssignment(
  inquiryId: string,
  accepted: boolean,
  declineReason?: string,
): Promise<ActionResult> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (guide == null) return { success: false, error: 'Guide profile not found' }

  // Verify the inquiry is assigned to this guide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)
    .single()

  if (inquiry == null) return { success: false, error: 'Inquiry not found or not assigned to you' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      guide_acceptance:     accepted ? 'accepted' : 'declined',
      guide_decline_reason: accepted ? null : (declineReason?.trim() || null),
      guide_responded_at:   new Date().toISOString(),
    })
    .eq('id', inquiryId)

  if (error != null) {
    console.error('[respondToAssignment] DB error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/trips/' + inquiryId)
  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[respondToAssignment] Inquiry ${inquiryId} — ${accepted ? 'accepted' : 'declined'}`)
  return { success: true }
}

// ─── saveGuideOfferEta ────────────────────────────────────────────────────────

/**
 * Guide: save when they expect to send the offer (free text).
 * Verifies ownership: the inquiry must be assigned to this guide.
 */
export async function saveGuideOfferEta(
  inquiryId: string,
  eta: string,
): Promise<ActionResult> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (guide == null) return { success: false, error: 'Guide profile not found' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({ guide_offer_eta: eta.trim() || null })
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)

  if (error != null) {
    console.error('[saveGuideOfferEta] DB error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ─── saveTripDetails ──────────────────────────────────────────────────────────

/**
 * Admin: upsert the trip brief for an inquiry.
 */
export async function saveTripDetails(
  inquiryId: string,
  data: Partial<Omit<TripDetails, never>>,
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiry_trip_details')
    .upsert(
      { inquiry_id: inquiryId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'inquiry_id' },
    )

  if (error != null) {
    console.error('[saveTripDetails] DB error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[saveTripDetails] Saved trip details for inquiry ${inquiryId}`)
  return { success: true }
}

// ─── saveGuideOfferResponse ───────────────────────────────────────────────────

/**
 * Guide: saves their offer response (spot options + description) for an inquiry.
 * Verifies ownership: the inquiry must be assigned to this guide.
 */
export async function saveGuideOfferResponse(
  inquiryId: string,
  data: {
    guide_final_dates?: string | null
    guide_options: GuideOption[]
  },
): Promise<ActionResult> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (guide == null) return { success: false, error: 'Guide profile not found' }

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)
    .single()
  if (inquiry == null) return { success: false, error: 'Inquiry not found or not assigned to you' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiry_trip_details')
    .upsert(
      { inquiry_id: inquiryId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'inquiry_id' },
    )

  if (error != null) {
    console.error('[saveGuideOfferResponse] DB error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/trips/' + inquiryId)
  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[saveGuideOfferResponse] Saved offer response for inquiry ${inquiryId}`)
  return { success: true }
}

// ─── saveOfferDraft ───────────────────────────────────────────────────────────

/**
 * Save a rich offer draft WITHOUT sending the email to the angler.
 * Used by FA to build + preview the offer before sending.
 * Does NOT set offer_sent_at — call sendOfferEmail() to send.
 */
export async function saveOfferDraft(
  inquiryId: string,
  params: RichOfferParams,
): Promise<ActionResult & { offerUrl?: string }> {
  const {
    totalPriceEur, depositEur, notes,
    tripPlan, licenseInfo, licenseHeading, inclusions,
    questions, refundReason,
    photos, location, whatToBring,
    schedule, locationLat, locationLng, locationZoom, locationGeoJson,
  } = params

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id, status, offer_token')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Inquiry not found' }

  if (['deposit_paid', 'completed', 'cancelled'].includes(inquiry.status)) {
    return { success: false, error: `Cannot modify offer — inquiry is ${inquiry.status}` }
  }

  // Reuse existing token if available, otherwise generate a new one
  const token     = (inquiry.offer_token as string | null) ?? crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const offerUrl  = `${env.NEXT_PUBLIC_APP_URL}/offers/${token}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (svc as any)
    .from('inquiries')
    .update({
      offer_total_eur:         totalPriceEur,
      offer_deposit_eur:       depositEur,
      offer_notes:             notes?.trim() || null,
      offer_trip_plan:         tripPlan?.trim() || null,
      offer_license_info:      licenseInfo?.trim() || null,
      offer_inclusions:        inclusions,
      offer_questions:         questions,
      offer_refund_reason:     refundReason?.trim() || null,
      offer_photos:            photos,
      offer_location:          location?.trim() || null,
      offer_what_to_bring:     whatToBring,
      offer_schedule:          schedule,
      offer_license_heading:   licenseHeading?.trim() || null,
      offer_location_lat:      locationLat,
      offer_location_lng:      locationLng,
      offer_location_zoom:     locationZoom,
      offer_location_geojson:  locationGeoJson,
      offer_options:           params.options ?? null,
      offer_token:             token,
      offer_token_expires_at:  expiresAt,
      // NOTE: offer_sent_at is intentionally NOT set here
    })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[saveOfferDraft] DB error:', updateError)
    return { success: false, error: 'Failed to save offer draft' }
  }

  console.log(`[saveOfferDraft] Draft saved for inquiry ${inquiryId} — token ${token}`)
  return { success: true, offerUrl }
}

// ─── sendOfferEmail ───────────────────────────────────────────────────────────

/**
 * Send the offer email to the angler for an already-saved draft.
 * Sets offer_sent_at to now.
 */
export async function sendOfferEmail(
  inquiryId: string,
): Promise<ActionResult & { offerUrl?: string }> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id, angler_name, angler_email, requested_dates, party_size, trip_id, offer_token, offer_total_eur, offer_deposit_eur, offer_notes, status')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Inquiry not found' }
  if (inquiry.offer_token == null) return { success: false, error: 'No offer draft — save a draft first' }

  const { data: trip } = await svc
    .from('experiences')
    .select('title, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  const guideId = trip?.guide_id
  const { data: guide } = guideId
    ? await svc.from('guides').select('full_name').eq('id', guideId).single()
    : { data: null }

  const offerUrl = `${env.NEXT_PUBLIC_APP_URL}/offers/${inquiry.offer_token}`

  await sendRichOfferAnglerEmail({
    to:              inquiry.angler_email,
    anglerName:      inquiry.angler_name,
    tripTitle:       trip?.title ?? 'Your trip',
    guideName:       guide?.full_name ?? 'Your guide',
    requestedDates:  (inquiry.requested_dates as string[] | null) ?? [],
    partySize:       inquiry.party_size ?? 1,
    offerTotalEur:   Number(inquiry.offer_total_eur ?? 0),
    offerDepositEur: Number(inquiry.offer_deposit_eur ?? 0),
    notes:           inquiry.offer_notes ?? null,
    offerUrl,
    inquiryId,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({ offer_sent_at: new Date().toISOString(), stage_reached: 'offer_sent' })
    .eq('id', inquiryId)

  console.log(`[sendOfferEmail] Offer email sent for inquiry ${inquiryId}`)
  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true, offerUrl }
}

// ─── acceptOffer ──────────────────────────────────────────────────────────────

/**
 * Angler accepts the offer on the public /offers/[token] page.
 * Saves any Q&A answers and moves the inquiry to in_negotiation.
 */
export async function acceptOffer(
  token: string,
  answers: OfferAnswer[],
  selectedOptionId?: string,
): Promise<ActionResult> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id, status, offer_token_expires_at')
    .eq('offer_token', token)
    .single()

  if (inquiry == null) return { success: false, error: 'Offer not found or link has expired' }

  if (inquiry.offer_token_expires_at != null && new Date(inquiry.offer_token_expires_at) < new Date()) {
    return { success: false, error: 'This offer link has expired' }
  }

  if (['deposit_paid', 'completed', 'cancelled', 'lost'].includes(inquiry.status)) {
    return { success: false, error: `Inquiry is already ${inquiry.status}` }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      offer_answers:       answers,
      status:              'in_negotiation',
      selected_option_id:  selectedOptionId ?? null,
    })
    .eq('id', inquiry.id)

  if (error != null) {
    console.error('[acceptOffer] DB error:', error)
    return { success: false, error: 'Failed to save acceptance' }
  }

  console.log(`[acceptOffer] Inquiry ${inquiry.id} accepted by angler${selectedOptionId != null ? ` (option ${selectedOptionId})` : ''}`)
  return { success: true }
}

// ─── declineOffer ─────────────────────────────────────────────────────────────

/**
 * Angler declines the offer on the public /offers/[token] page.
 * Moves the inquiry to lost with an optional note.
 */
export async function declineOffer(
  token: string,
  note: string | null,
): Promise<ActionResult> {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('id, status, offer_token_expires_at')
    .eq('offer_token', token)
    .single()

  if (inquiry == null) return { success: false, error: 'Offer not found' }

  if (['deposit_paid', 'completed'].includes(inquiry.status)) {
    return { success: false, error: 'Cannot decline a confirmed booking' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({
      status:      'lost',
      lost_reason: note?.trim() || 'Declined by angler',
    })
    .eq('id', inquiry.id)

  if (error != null) {
    console.error('[declineOffer] DB error:', error)
    return { success: false, error: 'Failed to save response' }
  }

  console.log(`[declineOffer] Inquiry ${inquiry.id} declined by angler`)
  return { success: true }
}

// ─── updateInquiryGuide ───────────────────────────────────────────────────────

/**
 * FA overrides which guide is shown on the offer page.
 * Silently sets assigned_guide_id without sending any notification.
 * Pass null to revert to the trip's default guide.
 */
export async function updateInquiryGuide(
  inquiryId: string,
  guideId: string | null,
): Promise<ActionResult> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({ assigned_guide_id: guideId })
    .eq('id', inquiryId)
  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[updateInquiryGuide] Inquiry ${inquiryId} → guide ${guideId ?? '(default)'}`)
  return { success: true }
}

export async function deleteUnmatchedMessages(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { success: true }
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('unmatched_messages')
    .delete()
    .in('id', ids)
  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/unmatched')
  return { success: true }
}

