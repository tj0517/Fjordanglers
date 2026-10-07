/**
 * POST /api/inquiries — create a new FA inquiry.
 *
 * Saves to the `inquiries` table with status = 'new' (set by createInquiry, which
 * also emits `inquiry.created`).
 * Fires two emails:
 *   • FA: new inquiry notification (with dashboard link)
 *   • Angler: inquiry received confirmation
 *
 * Repeat (FA-1.42): when the same e-mail already has an inquiry from the last 24 h, the
 * new one is still saved and FA is still notified, but the angler gets no e-mail and the
 * AI pipeline (classify, auto-reply) does not run. The skip is an
 * `agent.auto_send_decided` event with sent=false and the reason.
 *
 * Suspicious (FA-1.43): when the hidden trap field is filled or the form was submitted
 * less than 2 s after it was shown, the inquiry is still saved, but nothing is sent to
 * anyone (no angler e-mail, no FA e-mail, no AI) and the reason is recorded as an event.
 * The response is identical to a normal one. The signals come from the browser and are
 * forgeable: they stop simple bots only.
 *
 * Accepts either:
 *   - trip_id (UUID) — experience linked to a guide via `experiences` table
 *   - experience_page_id (UUID) — editorial page without a linked guide yet
 *
 * No auth required — anglers do not need an account to submit an inquiry.
 *
 * FA-1.55 — the v2 three-step form additionally sends `brief`: the answers that qualify the
 * angler (dates, days, party, skill level, priority, fitness, budget). It is validated by
 * `briefSchema`, stored 1:1, and the old columns (`requested_dates`, `party_size`,
 * `trip_length`, `message`) are derived **here, from the validated brief** rather than from
 * whatever the client sent next to it, so the two can never disagree. A request without a
 * brief — today's v1 widget — takes exactly the path it took before this existed: same
 * columns, same guide lookup, same event payload.
 *
 * Rate limited (FA-1.41) per client IP (checked first, before the body is read) and
 * per e-mail (checked once the body is valid). A rejected request gets 429 with
 * Retry-After and causes no database lookup, no save, no AI call and no e-mail.
 * Limits and fail-open rules: src/lib/rate-limit/inquiries.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInquiry } from '@/lib/inquiries/create'
import {
  briefSchema,
  composeBriefMessage,
  partySizeFromBrief,
  requestedDatesFromBrief,
  tripLengthFromBrief,
} from '@/lib/inquiries/brief'
import { sendInquiryReceivedFaEmail, sendInquiryReceivedAnglerEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { classifyInquiry } from '@/lib/ai/inquiry-agent'
import { autoSendReply } from '@/lib/ai/auto-send'
import { REPEAT_SKIP_REASON, REPEAT_WINDOW_MS, emitAutoSendDecision, suspicionReason } from '@/lib/ai/auto-send-guards'
import { hasRecentInquiryFromEmail, getPrimaryGuideId } from '@/lib/supabase/queries'
import { addBusinessDays, formatBusinessDay } from '@/lib/business-days'
import { checkEmailLimit, checkIpLimit, clientIpFromHeaders } from '@/lib/rate-limit/inquiries'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

// ─── Validation schema ────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const InquirySchema = z.object({
  // Exactly one of these must be present
  trip_id:            z.string().uuid().optional().nullable(),
  experience_page_id: z.string().uuid().optional().nullable(),

  angler_name:     z.string().min(1).max(100).transform(s => s.trim()),
  angler_email:    z.string().email(),
  requested_dates: z
    .array(z.string().regex(dateRegex, 'Each date must be YYYY-MM-DD'))
    .max(30)
    .default([]),
  party_size:      z.number().int().min(1).max(20),
  message:         z.string().max(2000).optional().nullable(),
  selected_option: z.string().max(200).optional().nullable(),
  angler_phone:         z.string().max(50).optional().nullable(),
  angler_phone_country: z.string().min(2).max(2).optional().nullable(),
  /** Where the angler lives, ISO 3166-1 alpha-2 — step 3 of the v2 form. */
  angler_country:       z.string().min(2).max(2).optional().nullable(),
  /** FA-1.55 — v2 form only; unknown keys inside it are rejected, see briefSchema. */
  brief:                briefSchema.optional().nullable(),
  trip_length:          z.enum(['1', '2-3', '4-7', '7+']).optional().nullable(),
  gclid:           z.string().max(200).optional().nullable(),
  // FA-1.43 — anything is accepted here on purpose: an odd value is "no information",
  // never a 400 (a 400 would tell a bot which field it got wrong). See suspicionReason.
  trip_notes_extra: z.unknown().optional(),
  form_elapsed_ms:  z.unknown().optional(),
  utm: z.object({
    utm_source:   z.string().max(200).optional(),
    utm_medium:   z.string().max(200).optional(),
    utm_campaign: z.string().max(200).optional(),
    utm_content:  z.string().max(200).optional(),
    utm_term:     z.string().max(200).optional(),
  }).optional().nullable(),
}).refine(
  d => d.trip_id != null || d.experience_page_id != null,
  { message: 'Either trip_id or experience_page_id is required' },
)

// ─── 429 response ─────────────────────────────────────────────────────────────

// No detail about thresholds or which limit was hit.
function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ipLimit = await checkIpLimit(clientIpFromHeaders(req.headers))
  if (ipLimit.blocked) return tooManyRequests(ipLimit.retryAfterSec)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = InquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const emailLimit = await checkEmailLimit(parsed.data.angler_email)
  if (emailLimit.blocked) return tooManyRequests(emailLimit.retryAfterSec)

  const svc = createServiceClient()

  let tripTitle: string
  let guideId: string | null = null
  // Destination country comes from the experience page, never from the request body.
  let tripCountry: string | null = null
  let pageId: string | null = null
  let pageVersion: number | null = null

  if (parsed.data.trip_id != null) {
    // trip_id is the expedition UUID stored in experience_pages.trip_id.
    // The legacy `experiences` table no longer exists — look up the experience_page
    // that links to this expedition to get guide_id and title.
    const { data: expPage } = await svc
      .from('experience_pages')
      .select('id, guide_id, experience_name, country, page_version')
      .eq('trip_id', parsed.data.trip_id)
      .eq('status', 'active')
      .single()

    if (expPage == null) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    tripTitle   = expPage.experience_name
    guideId     = expPage.guide_id
    tripCountry = expPage.country
    pageId      = expPage.id
    pageVersion = expPage.page_version
  } else {
    // Fetch experience page title
    const { data: expPage } = await svc
      .from('experience_pages')
      .select('id, guide_id, experience_name, country, page_version')
      .eq('id', parsed.data.experience_page_id!)
      .eq('status', 'active')
      .single()

    if (expPage == null) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 })
    }

    tripTitle   = expPage.experience_name
    guideId     = expPage.guide_id
    tripCountry = expPage.country
    pageId      = expPage.id
    pageVersion = expPage.page_version
  }

  // Sort dates before storing
  const sortedDates = [...parsed.data.requested_dates].sort()

  // ── The v2 path. Everything below is derived from the validated brief, so the brief is
  //    the single version of the answers and the old columns are a projection of it.
  const brief = parsed.data.brief ?? null

  const requestedDates = brief != null ? requestedDatesFromBrief(brief) : sortedDates
  const partySize      = brief != null ? partySizeFromBrief(brief)      : parsed.data.party_size
  const tripLength     = brief != null ? tripLengthFromBrief(brief)     : (parsed.data.trip_length ?? null)
  const message        = brief != null
    ? composeBriefMessage(parsed.data.message, brief)
    : (parsed.data.message ?? null)

  // Until CONTRACT, `inquiries.guide_id` stays "the guide of the page" — on a v2 page that
  // is the active `primary` row of `experience_guides`, not the legacy column (proposal §7
  // step 3). A page with no primary row keeps today's value rather than losing its guide.
  if (brief != null && pageId != null) {
    try {
      guideId = (await getPrimaryGuideId(svc, pageId)) ?? guideId
    } catch (err) {
      console.error(`[inquiries/POST] Primary-guide lookup failed for page ${pageId}, keeping the page's guide_id:`, err)
    }
  }

  let inquiry: { id: string; status: string }
  try {
    inquiry = await createInquiry({
      tripId:            parsed.data.trip_id ?? null,
      experiencePageId:  parsed.data.experience_page_id ?? null,
      guideId,
      tripCountry,
      anglerName:        parsed.data.angler_name,
      anglerEmail:       parsed.data.angler_email,
      anglerCountry:     parsed.data.angler_country?.toUpperCase() ?? null,
      requestedDates,
      partySize,
      message,
      selectedOption:    parsed.data.selected_option ?? null,
      anglerPhone:         parsed.data.angler_phone ?? null,
      anglerPhoneCountry:  parsed.data.angler_phone_country?.toUpperCase() ?? null,
      tripLength,
      brief,
      pageVersion,
      gclid:             parsed.data.gclid ?? null,
      utm:               parsed.data.utm ?? null,
      source:            'web_form',
      actor:             { kind: 'system' },
    })
  } catch (dbError) {
    console.error('[inquiries/POST] DB insert error:', dbError)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Suspicious (trap filled / filled too fast) wins over repeat: one event, no repeat lookup.
  const suspicion = suspicionReason(parsed.data.trip_notes_extra, parsed.data.form_elapsed_ms)
  const isSuspicious = suspicion != null

  // Repeat from the same e-mail within the window? The address in the form may belong to
  // someone else, so a repeat costs no AI call and no e-mail to the customer. A failed
  // lookup means "treat as new" — the behaviour from before this guard.
  let isRepeat = false
  if (!isSuspicious) {
    try {
      isRepeat = await hasRecentInquiryFromEmail(svc, {
        email:            parsed.data.angler_email,
        excludeInquiryId: inquiry.id,
        since:            new Date(Date.now() - REPEAT_WINDOW_MS),
      })
    } catch (err) {
      console.error(`[inquiries/POST] Repeat lookup failed for ${inquiry.id}, treating as new:`, err)
    }
  }

  const skipReason = suspicion ?? (isRepeat ? REPEAT_SKIP_REASON : null)
  if (skipReason != null) {
    try {
      await emitAutoSendDecision(svc, inquiry.id, null, false, null, [skipReason])
    } catch (err) {
      // The inquiry is saved and the skip still applies; losing the event is logged, not a 500.
      console.error(`[inquiries/POST] Skip event failed for ${inquiry.id}:`, err)
    }
  }

  // Await both emails before responding — on Vercel serverless, unawaited promises
  // are silently dropped once the response is returned and the function freezes.
  const baseUrl      = env.NEXT_PUBLIC_APP_URL
  const dashboardUrl = `${baseUrl}/admin/inquiries/${inquiry.id}`

  try {
    await Promise.all([
      isSuspicious
        ? Promise.resolve()
        : sendInquiryReceivedFaEmail({
            to:             env.FA_EMAIL ?? 'contact@fjordanglers.com',
            anglerName:     parsed.data.angler_name,
            anglerEmail:    parsed.data.angler_email,
            tripTitle,
            requestedDates,
            partySize,
            message,
            selectedOption: parsed.data.selected_option ?? null,
            inquiryId:      inquiry.id,
            dashboardUrl,
          }),
      isSuspicious || isRepeat
        ? Promise.resolve()
        : sendInquiryReceivedAnglerEmail({
            to:             parsed.data.angler_email,
            anglerName:     parsed.data.angler_name,
            tripTitle,
            requestedDates,
            partySize,
            inquiryId:      inquiry.id,
            replyByDate:    formatBusinessDay(addBusinessDays(new Date(), 2, 'Europe/Warsaw')),
          }),
    ])
  } catch (err) {
    // Log but don't fail the request — inquiry is already saved
    console.error('[inquiries/POST] Email error:', err)
  }

  console.log(`[inquiries/POST] Created inquiry ${inquiry.id} (${parsed.data.trip_id ? `trip ${parsed.data.trip_id}` : `page ${parsed.data.experience_page_id}`})`)

  if (env.AI_AUTO_REPLY_ENABLED && !isRepeat && !isSuspicious) {
    try {
      await classifyInquiry({
        inquiryId:      inquiry.id,
        anglerName:     parsed.data.angler_name,
        tripTitle,
        message,
        requestedDates,
        partySize,
      })
    } catch (err) {
      console.error('[inquiries/POST] Agent error:', err)
      // never block the 201 response
    }

    try {
      await autoSendReply({ inquiryId: inquiry.id, counterpart: 'angler', channel: 'email' })
    } catch (err) {
      console.error('[inquiries/POST] Auto-send error:', err)
    }
  }

  return NextResponse.json({ id: inquiry.id, status: inquiry.status }, { status: 201 })
}
