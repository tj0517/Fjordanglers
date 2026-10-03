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
 * Accepts either:
 *   - trip_id (UUID) — experience linked to a guide via `experiences` table
 *   - experience_page_id (UUID) — editorial page without a linked guide yet
 *
 * No auth required — anglers do not need an account to submit an inquiry.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInquiry } from '@/lib/inquiries/create'
import { sendInquiryReceivedFaEmail, sendInquiryReceivedAnglerEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { classifyInquiry } from '@/lib/ai/inquiry-agent'
import { autoSendReply } from '@/lib/ai/auto-send'
import { REPEAT_SKIP_REASON, REPEAT_WINDOW_MS, emitAutoSendDecision } from '@/lib/ai/auto-send-guards'
import { hasRecentInquiryFromEmail } from '@/lib/supabase/queries'
import { addBusinessDays, formatBusinessDay } from '@/lib/business-days'

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
  trip_length:          z.enum(['1', '2-3', '4-7', '7+']).optional().nullable(),
  gclid:           z.string().max(200).optional().nullable(),
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

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const svc = createServiceClient()

  let tripTitle: string
  let guideId: string | null = null
  // Destination country comes from the experience page, never from the request body.
  let tripCountry: string | null = null

  if (parsed.data.trip_id != null) {
    // trip_id is the expedition UUID stored in experience_pages.trip_id.
    // The legacy `experiences` table no longer exists — look up the experience_page
    // that links to this expedition to get guide_id and title.
    const { data: expPage } = await svc
      .from('experience_pages')
      .select('id, guide_id, experience_name, country')
      .eq('trip_id', parsed.data.trip_id)
      .eq('status', 'active')
      .single()

    if (expPage == null) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    tripTitle   = expPage.experience_name
    guideId     = expPage.guide_id
    tripCountry = expPage.country
  } else {
    // Fetch experience page title
    const { data: expPage } = await svc
      .from('experience_pages')
      .select('id, guide_id, experience_name, country')
      .eq('id', parsed.data.experience_page_id!)
      .eq('status', 'active')
      .single()

    if (expPage == null) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 })
    }

    tripTitle   = expPage.experience_name
    guideId     = expPage.guide_id
    tripCountry = expPage.country
  }

  // Sort dates before storing
  const sortedDates = [...parsed.data.requested_dates].sort()

  let inquiry: { id: string; status: string }
  try {
    inquiry = await createInquiry({
      tripId:            parsed.data.trip_id ?? null,
      experiencePageId:  parsed.data.experience_page_id ?? null,
      guideId,
      tripCountry,
      anglerName:        parsed.data.angler_name,
      anglerEmail:       parsed.data.angler_email,
      requestedDates:    sortedDates,
      partySize:         parsed.data.party_size,
      message:           parsed.data.message ?? null,
      selectedOption:    parsed.data.selected_option ?? null,
      anglerPhone:         parsed.data.angler_phone ?? null,
      anglerPhoneCountry:  parsed.data.angler_phone_country?.toUpperCase() ?? null,
      tripLength:          parsed.data.trip_length ?? null,
      gclid:             parsed.data.gclid ?? null,
      utm:               parsed.data.utm ?? null,
      source:            'web_form',
      actor:             { kind: 'system' },
    })
  } catch (dbError) {
    console.error('[inquiries/POST] DB insert error:', dbError)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Repeat from the same e-mail within the window? The address in the form may belong to
  // someone else, so a repeat costs no AI call and no e-mail to the customer. A failed
  // lookup means "treat as new" — the behaviour from before this guard.
  let isRepeat = false
  try {
    isRepeat = await hasRecentInquiryFromEmail(svc, {
      email:            parsed.data.angler_email,
      excludeInquiryId: inquiry.id,
      since:            new Date(Date.now() - REPEAT_WINDOW_MS),
    })
  } catch (err) {
    console.error(`[inquiries/POST] Repeat lookup failed for ${inquiry.id}, treating as new:`, err)
  }

  if (isRepeat) {
    try {
      await emitAutoSendDecision(svc, inquiry.id, null, false, null, [REPEAT_SKIP_REASON])
    } catch (err) {
      // The inquiry is saved and the skip still applies; losing the event is logged, not a 500.
      console.error(`[inquiries/POST] Repeat skip event failed for ${inquiry.id}:`, err)
    }
  }

  // Await both emails before responding — on Vercel serverless, unawaited promises
  // are silently dropped once the response is returned and the function freezes.
  const baseUrl      = env.NEXT_PUBLIC_APP_URL
  const dashboardUrl = `${baseUrl}/admin/inquiries/${inquiry.id}`

  try {
    await Promise.all([
      sendInquiryReceivedFaEmail({
        to:             env.FA_EMAIL ?? 'contact@fjordanglers.com',
        anglerName:     parsed.data.angler_name,
        anglerEmail:    parsed.data.angler_email,
        tripTitle,
        requestedDates: sortedDates,
        partySize:      parsed.data.party_size,
        message:        parsed.data.message ?? null,
        selectedOption: parsed.data.selected_option ?? null,
        inquiryId:      inquiry.id,
        dashboardUrl,
      }),
      isRepeat
        ? Promise.resolve()
        : sendInquiryReceivedAnglerEmail({
            to:             parsed.data.angler_email,
            anglerName:     parsed.data.angler_name,
            tripTitle,
            requestedDates: sortedDates,
            partySize:      parsed.data.party_size,
            inquiryId:      inquiry.id,
            replyByDate:    formatBusinessDay(addBusinessDays(new Date(), 2, 'Europe/Warsaw')),
          }),
    ])
  } catch (err) {
    // Log but don't fail the request — inquiry is already saved
    console.error('[inquiries/POST] Email error:', err)
  }

  console.log(`[inquiries/POST] Created inquiry ${inquiry.id} (${parsed.data.trip_id ? `trip ${parsed.data.trip_id}` : `page ${parsed.data.experience_page_id}`})`)

  if (env.AI_AUTO_REPLY_ENABLED && !isRepeat) {
    try {
      await classifyInquiry({
        inquiryId:      inquiry.id,
        anglerName:     parsed.data.angler_name,
        tripTitle,
        message:        parsed.data.message ?? null,
        requestedDates: sortedDates,
        partySize:      parsed.data.party_size,
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
