'use server'

/**
 * FA Inquiry Server Actions.
 *
 * sendDepositLink(inquiryId)
 *   FA sends a Stripe Checkout deposit link to the angler.
 *
 * submitOfferAnswers(token, answers)
 *   Angler submits their answers on the public /offers/[token] page.
 *   Returns a Stripe Checkout URL for the deposit payment.
 *
 * getOfferByToken(token)
 *   Fetches an inquiry (with guide + trip) by its offer token.
 *   Public — no auth required; token IS the authentication.
 */

import type { Json } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/server'
import { createInquiry } from '@/lib/inquiries/create'
import { tripCountryPatchFromGuide } from '@/lib/inquiries/trip-country'
import { computeFallbackDepositCents } from '@/lib/inquiries/deposit-fallback'
import {
  getInquiryExperience,
  tripTitleOf,
  GUIDE_NAME_FALLBACK,
  type InquiryExperience,
} from '@/lib/inquiries/experience-lookup'
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
import { requireAdmin, requireGuide, requireToken, UnauthorizedError } from '@/lib/auth/guards'
import {
  transition,
  TransitionError,
  isInquiryStatus,
} from '@/lib/inquiries/state'
import { setQualified, QualifiedError, type QualifiedValue } from '@/lib/inquiries/qualified'

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
 *
 * `channel` is the acquisition channel (instagram/whatsapp/email/…) and is stored
 * in `internal_notes` for visibility in the deal tracker — it is a different concept
 * from `inquiries.source`, which always records `'manual'` for rows created here
 * (the creation path, not the channel).
 */
export async function createManualInquiry(params: {
  anglerName:     string
  anglerEmail:    string
  partySize:      number
  tripId:         string | null
  requestedDates: string[]
  message:        string | null
  channel:        string | null
  /** Where the admin wants it to start: `new` (nobody replied yet) or `qualifying`. */
  status:         'new' | 'qualifying'
}): Promise<ActionResult & { inquiryId?: string }> {
  const { userId } = await requireAdmin()
  if (params.anglerName.trim() === '') return { success: false, error: 'Name is required' }
  if (params.anglerEmail.trim() === '') return { success: false, error: 'Email is required' }
  if (params.partySize < 1) return { success: false, error: 'Party size must be at least 1' }

  const internalNotes = params.channel != null && params.channel.trim() !== ''
    ? `Source: ${params.channel.trim()}`
    : null

  // Destination country comes from the experience page the admin picked, if any.
  const experiencePageId = params.tripId != null && params.tripId !== '' ? params.tripId : null
  let tripCountry: string | null = null
  if (experiencePageId != null) {
    const { data: expPage } = await createServiceClient()
      .from('experience_pages')
      .select('country')
      .eq('id', experiencePageId)
      .single()
    tripCountry = expPage?.country ?? null
  }

  let inquiry: { id: string; status: string }
  try {
    inquiry = await createInquiry({
      anglerName:       params.anglerName.trim(),
      anglerEmail:      params.anglerEmail.trim().toLowerCase(),
      partySize:        params.partySize,
      actor:            { kind: 'admin', id: userId },
      requestedDates:   params.requestedDates,
      // tripId here is experience_pages.id (the dropdown value from the admin form).
      // Store as experience_page_id — trip_id FK points to the non-existent experiences table.
      experiencePageId,
      tripCountry,
      message:          params.message != null && params.message.trim() !== '' ? params.message.trim() : null,
      internalNotes,
      source:           'manual',
    })
  } catch (error) {
    console.error('[createManualInquiry] DB error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create inquiry' }
  }

  // Every inquiry is born `new`; starting the admin's way through the process is a
  // transition of its own, so it shows up on the timeline like any other.
  if (params.status === 'qualifying') {
    try {
      await transition(createServiceClient(), inquiry.id, 'qualifying', {
        actor:  { kind: 'admin', id: userId },
        reason: 'Created manually — conversation already started',
      })
    } catch (error) {
      console.error('[createManualInquiry] transition error:', error)
      return {
        success:   false,
        error:     error instanceof TransitionError ? error.message : 'Failed to set the initial status',
        inquiryId: inquiry.id,
      }
    }
  }

  console.log(`[createManualInquiry] Created inquiry ${inquiry.id} for ${params.anglerName} (channel: ${params.channel ?? 'unspecified'})`)
  return { success: true, inquiryId: inquiry.id }
}

// ─── sendDepositLink ──────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session and sends the link to the angler via email.
 *
 * Deposit amount priority:
 *   1. inquiry.offer_deposit_eur — if FA created an offer, always use that exact amount.
 *   2. Otherwise depositPercent × the experience's list price (per person or flat, EUR only) —
 *      see computeFallbackDepositCents. A price on request or in another currency is refused.
 *
 * Allowed statuses: any status from which `awaiting_payment` is reachable, plus
 * `awaiting_payment` itself (resend — the status does not move a second time).
 * Blocked statuses: paid, completed, cancelled.
 */
export async function sendDepositLink(
  inquiryId: string,
  depositPercent: number = 30,
): Promise<SendDepositLinkResult> {
  const { userId } = await requireAdmin()
  if (depositPercent < 1 || depositPercent > 100) {
    return { success: false, error: 'depositPercent must be 1–100' }
  }

  const svc = createServiceClient()

  const { data: rawInquiry } = await svc
    .from('inquiries')
    .select('id, status, angler_email, angler_name, angler_country, requested_dates, party_size, trip_id, experience_page_id, message, offer_deposit_eur')
    .eq('id', inquiryId)
    .single()

  if (rawInquiry == null) {
    return { success: false, error: 'Inquiry not found' }
  }

  const blocked = ['paid', 'completed', 'cancelled', 'handed_over', 'lost']
  if (blocked.includes(rawInquiry.status)) {
    return { success: false, error: `Cannot send deposit link — inquiry is ${rawInquiry.status}` }
  }

  const offerDepositEur = rawInquiry.offer_deposit_eur as number | null

  const exp = await getInquiryExperience(rawInquiry)

  // The saved offer deposit always wins. Only when there is none do we fall back to the
  // experience's list price × party size × deposit % (see deposit-fallback.ts) — and that
  // refuses a price on request or a non-EUR price instead of guessing an amount.
  let depositCents: number
  if (offerDepositEur != null && offerDepositEur > 0) {
    depositCents = Math.round(offerDepositEur * 100)
  } else {
    const fallback = computeFallbackDepositCents(exp, rawInquiry.party_size ?? 1, depositPercent)
    if (!fallback.ok) {
      return { success: false, error: fallback.error }
    }
    depositCents = fallback.cents
  }

  const depositPctUsed = depositPercent
  const tripTitle      = tripTitleOf(exp)

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
              name: `Booking & Curation Fee — ${tripTitle}`,
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
        success_url: `${baseUrl}/inquiry/${inquiryId}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  baseUrl,
      },
      {
        idempotencyKey: `deposit-${inquiryId}-${Date.now()}`,
      },
    )
  } catch (err) {
    console.error('[sendDepositLink] Stripe error:', err)
    return { success: false, error: 'Failed to create Stripe checkout session' }
  }

  const { error: updateError } = await svc
    .from('inquiries')
    .update({
      deposit_amount:            depositCents / 100,
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiryId)

  if (updateError != null) {
    console.error('[sendDepositLink] DB update error:', updateError)
  }

  // Resending the link to an inquiry that is already awaiting payment is not a
  // transition — the status is where it should be, so there is nothing to record.
  if (rawInquiry.status !== 'awaiting_payment') {
    try {
      await transition(svc, inquiryId, 'awaiting_payment', {
        actor:  { kind: 'admin', id: userId },
        reason: 'Deposit link sent',
      })
    } catch (error) {
      console.error('[sendDepositLink] transition error:', error)
      return {
        success: false,
        error:   error instanceof TransitionError
          ? error.message
          : 'Deposit link created, but the status could not be updated',
      }
    }
  }

  sendDepositLinkAnglerEmail({
    to:               rawInquiry.angler_email,
    anglerName:       rawInquiry.angler_name,
    tripTitle,
    requestedDates,
    partySize:        rawInquiry.party_size ?? 1,
    depositAmountEur: depositCents / 100,
    depositPercent:   depositPctUsed,
    checkoutUrl:      session.url!,
    inquiryId,
  }).catch(err => console.error('[sendDepositLink] Email error:', err))

  console.log(`[sendDepositLink] Deposit link sent for inquiry ${inquiryId} — session ${session.id} — €${(depositCents / 100).toFixed(2)}`)

  return { success: true, checkoutUrl: session.url! }
}

/**
 * Guide row shown on an offer: the assigned guide first, else the guide who owns the
 * inquiry's experience page. Null when neither resolves (callers fall back to
 * GUIDE_NAME_FALLBACK). Not exported — this file is 'use server', so every export
 * would become a client-callable action.
 */
async function resolveOfferGuide(
  assignedGuideId: string | null,
  exp: InquiryExperience | null,
): Promise<{ full_name: string | null; bio: string | null; avatar_url: string | null } | null> {
  const svc = createServiceClient()
  const candidates = [assignedGuideId, exp?.guideId ?? null]

  for (const guideId of candidates) {
    if (guideId == null) continue
    const { data } = await svc
      .from('guides')
      .select('full_name, bio, avatar_url')
      .eq('id', guideId)
      .maybeSingle()
    if (data != null) return data
  }
  return null
}

// ─── getOfferByToken ──────────────────────────────────────────────────────────

/**
 * Public action — fetches an inquiry with guide + trip data by offer token.
 * Returns null if token not found or expired.
 */
export async function getOfferByToken(token: string): Promise<OfferPageData | null> {
  const svc = createServiceClient()

  const { data: inquiry } = await svc
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

  const exp   = await getInquiryExperience(inquiry)
  const guide = await resolveOfferGuide(inquiry.assigned_guide_id, exp)

  return {
    inquiryId:        inquiry.id,
    anglerName:       inquiry.angler_name,
    anglerCountry:    (inquiry.angler_country as string | null) ?? '',
    tripTitle:        tripTitleOf(exp),
    guideName:        guide?.full_name ?? GUIDE_NAME_FALLBACK,
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
  const { id: inquiryId } = await requireToken('offer', token)

  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status, angler_email, angler_name, trip_id, experience_page_id, party_size, offer_deposit_eur')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) {
    return { success: false, error: 'Offer not found or link has expired' }
  }

  if (['paid', 'handed_over', 'completed', 'cancelled'].includes(inquiry.status)) {
    return { success: false, error: `Inquiry is already ${inquiry.status}` }
  }

  // Save answers
  await svc
    .from('inquiries')
    .update({ offer_answers: answers as unknown as Json })
    .eq('id', inquiry.id)

  const depositCents = Math.round(Number(inquiry.offer_deposit_eur ?? 0) * 100)
  if (depositCents < 50) {
    return { success: false, error: 'Deposit amount is too low' }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL
  const exp     = await getInquiryExperience(inquiry)

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
              name: `Refundable Deposit — ${tripTitleOf(exp)}`,
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
        success_url: `${baseUrl}/inquiry/${inquiry.id}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
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

  await svc
    .from('inquiries')
    .update({
      deposit_amount:            depositCents / 100,
      deposit_stripe_session_id: session.id,
    })
    .eq('id', inquiry.id)

  // The angler is on the payment page — we are waiting for their money, not for them
  // to answer. The actor is the angler: they, not an admin, took this step.
  if (inquiry.status !== 'awaiting_payment') {
    try {
      await transition(svc, inquiry.id, 'awaiting_payment', {
        actor:  { kind: 'angler' },
        reason: 'Angler submitted the offer answers and went to checkout',
      })
    } catch (error) {
      console.error('[submitOfferAnswers] transition error:', error)
      return {
        success: false,
        error:   error instanceof TransitionError
          ? error.message
          : 'Could not move the inquiry to awaiting payment',
      }
    }
  }

  return { success: true, checkoutUrl: session.url! }
}

// ─── updateInquiryStatus ──────────────────────────────────────────────────────

/**
 * The admin moves an inquiry by hand from the StatusChanger.
 *
 * This is one caller of `transition()` among several (webhooks and the angler's own
 * actions are others); the machine, not this function, decides whether the move is
 * allowed, and the event is written by the same call.
 *
 * When marking as `lost` a reason code is required (FA-0.16); any other status clears
 * the previous loss reason.
 */
export async function updateInquiryStatus(
  inquiryId: string,
  status: string,
  lostReasonCode?: string | null,
  lostReason?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()

  if (!isInquiryStatus(status)) {
    return { success: false, error: `Unknown status ${status}` }
  }

  try {
    await transition(createServiceClient(), inquiryId, status, {
      actor:          { kind: 'admin', id: userId },
      lostReasonCode,
      lostReason,
    })
  } catch (error) {
    if (error instanceof TransitionError) return { success: false, error: error.message }
    console.error('[updateInquiryStatus] error:', error)
    return { success: false, error: 'Failed to update the status' }
  }

  console.log(`[updateInquiryStatus] Inquiry ${inquiryId} → ${status}`)
  return { success: true }
}

// ─── setInquiryQualified ──────────────────────────────────────────────────────

export async function setInquiryQualified(
  inquiryId: string,
  value: QualifiedValue,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()

  try {
    await setQualified(createServiceClient(), inquiryId, value, { kind: 'admin', id: userId })
  } catch (error) {
    if (error instanceof QualifiedError) return { success: false, error: error.message }
    console.error('[setInquiryQualified] error:', error)
    return { success: false, error: 'Failed to update qualified flag' }
  }

  console.log(`[setInquiryQualified] Inquiry ${inquiryId} → ${value}`)
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
  await requireAdmin()
  const svc = createServiceClient()

  const updatePayload: Record<string, unknown> = {
    internal_deal_total_eur: params.dealTotalEur,
    internal_commission_eur: params.commissionEur,
    internal_notes:          params.internalNotes,
    deal_currency:           params.dealCurrency,
  }
  // Once a deal amount is recorded the offer is considered sent — never flip back to false.
  if (params.dealTotalEur != null || params.commissionEur != null) {
    updatePayload.external_offer_sent = true
  }

  const { error } = await svc
    .from('inquiries')
    .update(updatePayload)
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/' + inquiryId)
  revalidatePath('/admin/inquiries')
  console.log(`[saveInternalDeal] Inquiry ${inquiryId} — total ${params.dealCurrency} ${params.dealTotalEur}, commission ${params.dealCurrency} ${params.commissionEur}`)
  return { success: true }
}

// ─── updateNextAction ─────────────────────────────────────────────────────────

/**
 * FA sets the "next action" reminder on an inquiry.
 * Internal only — no email sent.
 */
export async function deleteInquiry(inquiryId: string): Promise<ActionResult> {
  await requireAdmin()
  const svc = createServiceClient()
  const { error } = await svc
    .from('inquiries')
    .delete()
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  console.log(`[deleteInquiry] Inquiry ${inquiryId} hard deleted`)
  return { success: true }
}

export async function updateRequestedDates(
  inquiryId: string,
  dates: string[],
): Promise<ActionResult> {
  await requireAdmin()
  const svc = createServiceClient()
  // Normalise: keep only valid YYYY-MM-DD values, remove duplicates, sort ascending
  const clean = [...new Set(
    dates
      .map(d => d.trim().slice(0, 10))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  )].sort()
  const { error } = await svc
    .from('inquiries')
    .update({ requested_dates: clean })
    .eq('id', inquiryId)

  if (error != null) return { success: false, error: error.message }
  console.log(`[updateRequestedDates] Inquiry ${inquiryId} — ${clean.join(', ')}`)
  return { success: true }
}

export async function updateNextAction(
  inquiryId: string,
  nextAction: string | null,
): Promise<ActionResult> {
  await requireAdmin()
  const svc = createServiceClient()
  const { error } = await svc
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
  await requireAdmin()
  const svc = createServiceClient()

  // An inquiry with no destination yet (e-mail / WhatsApp) takes the guide's country.
  const countryPatch = await tripCountryPatchFromGuide(inquiryId, guideId)

  // Update inquiry
  const { error: updateError } = await svc
    .from('inquiries')
    .update({ assigned_guide_id: guideId, assigned_at: new Date().toISOString(), ...countryPatch })
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
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('angler_name, angler_country, message, requested_dates, party_size')
    .eq('id', inquiryId)
    .single()

  // Fetch trip brief (graceful — table may not exist yet)
  let tripDetails: Record<string, unknown> | null = null
  try {
    const { data: td } = await svc
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
  await requireAdmin()
  const svc = createServiceClient()

  const { error } = await svc
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
  await requireAdmin()
  const svc = createServiceClient()
  const { error } = await svc
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
  await requireAdmin()
  const svc = createServiceClient()

  const countryPatch = await tripCountryPatchFromGuide(inquiryId, guideId)

  const { error } = await svc
    .from('inquiries')
    .update({
      assigned_guide_id: guideId,
      assigned_at:       new Date().toISOString(),
      guide_acceptance:  'accepted',   // silent = no need to accept, treat as already confirmed
      ...countryPatch,
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
  const { guide } = await requireGuide()

  const svc = createServiceClient()

  // Verify the inquiry is assigned to this guide
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)
    .single()

  if (inquiry == null) throw new UnauthorizedError('Inquiry not found or not assigned to you')

  const { error } = await svc
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
  const { guide } = await requireGuide()

  const svc = createServiceClient()

  // Verify ownership — like saveGuideOfferResponse; prevents silent "0 rows updated"
  // when the inquiry is assigned to a different guide.
  const { data: owned } = await svc
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)
    .single()
  if (owned == null) throw new UnauthorizedError('Inquiry not found or not assigned to you')

  const { error } = await svc
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
  await requireAdmin()
  const svc = createServiceClient()
  const { error } = await svc
    .from('inquiry_trip_details')
    .upsert(
      { inquiry_id: inquiryId, ...data, guide_options: (data.guide_options ?? null) as unknown as Json, updated_at: new Date().toISOString() },
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
  const { guide } = await requireGuide()

  const svc = createServiceClient()

  // Verify ownership
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('assigned_guide_id', guide.id)
    .single()
  if (inquiry == null) throw new UnauthorizedError('Inquiry not found or not assigned to you')

  const { error } = await svc
    .from('inquiry_trip_details')
    .upsert(
      { inquiry_id: inquiryId, ...data, guide_options: data.guide_options as unknown as Json, updated_at: new Date().toISOString() },
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
  await requireAdmin()
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

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status, offer_token')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Inquiry not found' }

  if (['paid', 'handed_over', 'completed', 'cancelled'].includes(inquiry.status)) {
    return { success: false, error: `Cannot modify offer — inquiry is ${inquiry.status}` }
  }

  // Reuse existing token if available, otherwise generate a new one
  const token     = (inquiry.offer_token as string | null) ?? crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const offerUrl  = `${env.NEXT_PUBLIC_APP_URL}/offers/${token}`

  const { error: updateError } = await svc
    .from('inquiries')
    .update({
      offer_total_eur:         totalPriceEur,
      offer_deposit_eur:       depositEur,
      offer_notes:             notes?.trim() || null,
      offer_trip_plan:         tripPlan?.trim() || null,
      offer_license_info:      licenseInfo?.trim() || null,
      offer_inclusions:        inclusions        as unknown as Json,
      offer_questions:         questions         as unknown as Json,
      offer_refund_reason:     refundReason?.trim() || null,
      offer_photos:            photos            as unknown as Json,
      offer_location:          location?.trim() || null,
      offer_what_to_bring:     whatToBring       as unknown as Json,
      offer_schedule:          schedule          as unknown as Json,
      offer_license_heading:   licenseHeading?.trim() || null,
      offer_location_lat:      locationLat,
      offer_location_lng:      locationLng,
      offer_location_zoom:     locationZoom,
      offer_location_geojson:  locationGeoJson   as unknown as Json,
      offer_options:           (params.options ?? null) as unknown as Json,
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

// TODO FA-1.08 — jedyny wołający: OfferBuilder.tsx (żywy)
/**
 * Send the offer email to the angler for an already-saved draft.
 * Sets offer_sent_at to now.
 */
export async function sendOfferEmail(
  inquiryId: string,
): Promise<ActionResult & { offerUrl?: string }> {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, requested_dates, party_size, trip_id, experience_page_id, assigned_guide_id, offer_token, offer_total_eur, offer_deposit_eur, offer_notes, status')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Inquiry not found' }
  if (inquiry.offer_token == null) return { success: false, error: 'No offer draft — save a draft first' }

  const offerUrl = `${env.NEXT_PUBLIC_APP_URL}/offers/${inquiry.offer_token}`

  const exp = await getInquiryExperience(inquiry)
  const offerGuide = await resolveOfferGuide(inquiry.assigned_guide_id, exp)

  await sendRichOfferAnglerEmail({
    to:              inquiry.angler_email,
    anglerName:      inquiry.angler_name,
    tripTitle:       tripTitleOf(exp),
    guideName:       offerGuide?.full_name ?? GUIDE_NAME_FALLBACK,
    requestedDates:  (inquiry.requested_dates as string[] | null) ?? [],
    partySize:       inquiry.party_size ?? 1,
    offerTotalEur:   Number(inquiry.offer_total_eur ?? 0),
    offerDepositEur: Number(inquiry.offer_deposit_eur ?? 0),
    notes:           inquiry.offer_notes ?? null,
    offerUrl,
    inquiryId,
  })

  await svc
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
  const { id: inquiryId } = await requireToken('offer', token)

  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Offer not found or link has expired' }

  if (['paid', 'handed_over', 'completed', 'cancelled', 'lost'].includes(inquiry.status)) {
    return { success: false, error: `Inquiry is already ${inquiry.status}` }
  }

  const { error } = await svc
    .from('inquiries')
    .update({
      offer_answers:       answers as unknown as Json,
      selected_option_id:  selectedOptionId ?? null,
    })
    .eq('id', inquiry.id)

  if (error != null) {
    console.error('[acceptOffer] DB error:', error)
    return { success: false, error: 'Failed to save acceptance' }
  }

  // An accepted offer means we are waiting for the deposit, not for another round of
  // talking (that is why it is awaiting_payment and not qualifying).
  if (inquiry.status !== 'awaiting_payment') {
    try {
      await transition(svc, inquiry.id, 'awaiting_payment', {
        actor:   { kind: 'angler' },
        reason:  selectedOptionId != null
          ? `Angler accepted the offer (option ${selectedOptionId})`
          : 'Angler accepted the offer',
      })
    } catch (error) {
      console.error('[acceptOffer] transition error:', error)
      return {
        success: false,
        error:   error instanceof TransitionError
          ? error.message
          : 'Acceptance saved, but the status could not be updated',
      }
    }
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
  const { id: inquiryId } = await requireToken('offer', token)

  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status')
    .eq('id', inquiryId)
    .single()

  if (inquiry == null) return { success: false, error: 'Offer not found' }

  if (['paid', 'handed_over', 'completed'].includes(inquiry.status)) {
    return { success: false, error: 'Cannot decline a confirmed booking' }
  }

  try {
    await transition(svc, inquiry.id, 'lost', {
      actor:          { kind: 'angler' },
      reason:         'Angler declined the offer',
      lostReasonCode: 'went_elsewhere',
      lostReason:     note?.trim() || 'Declined by angler',
    })
  } catch (error) {
    console.error('[declineOffer] transition error:', error)
    return {
      success: false,
      error:   error instanceof TransitionError ? error.message : 'Failed to save response',
    }
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
  await requireAdmin()
  const svc = createServiceClient()
  const countryPatch = await tripCountryPatchFromGuide(inquiryId, guideId)
  const { error } = await svc
    .from('inquiries')
    .update({ assigned_guide_id: guideId, ...countryPatch })
    .eq('id', inquiryId)
  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/' + inquiryId)
  console.log(`[updateInquiryGuide] Inquiry ${inquiryId} → guide ${guideId ?? '(default)'}`)
  return { success: true }
}

// ─── getInquiryConfirmation ───────────────────────────────────────────────────

export type InquiryConfirmation = {
  tripTitle: string
  anglerName: string
  depositAmountEur: number
  depositPaidAt: string | null
}

/**
 * Public action — reads the minimal data needed for the post-checkout
 * confirmation page (/inquiry/[id]/confirmed). No auth: the inquiry id in
 * the Stripe success_url is not a secret, but this returns only non-sensitive
 * fields (no email, phone, offer token).
 * Returns null if the inquiry does not exist.
 */
export async function getInquiryConfirmation(id: string): Promise<InquiryConfirmation | null> {
  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('angler_name, deposit_amount, deposit_paid_at, trip_id, experience_page_id')
    .eq('id', id)
    .single()

  if (inquiry == null) return null

  return {
    tripTitle:         tripTitleOf(await getInquiryExperience(inquiry)),
    anglerName:        inquiry.angler_name,
    depositAmountEur:  Number(inquiry.deposit_amount ?? 0),
    depositPaidAt:     inquiry.deposit_paid_at ?? null,
  }
}

