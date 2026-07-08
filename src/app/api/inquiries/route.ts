/**
 * POST /api/inquiries — create a new FA inquiry.
 *
 * Saves to the `inquiries` table with status = 'pending'.
 * Fires two emails:
 *   • FA: new inquiry notification (with dashboard link)
 *   • Angler: inquiry received confirmation
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
import { sendInquiryReceivedFaEmail, sendInquiryReceivedAnglerEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { runAgentRound1 } from '@/lib/ai/inquiry-agent'

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
  angler_phone:    z.string().max(50).optional().nullable(),
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

  if (parsed.data.trip_id != null) {
    // Fetch trip for guide_id + title (also validates trip exists)
    const { data: trip } = await svc
      .from('experiences')
      .select('id, guide_id, title')
      .eq('id', parsed.data.trip_id)
      .eq('published', true)
      .single()

    if (trip == null) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    tripTitle = trip.title
    guideId   = trip.guide_id
  } else {
    // Fetch experience page title
    const { data: expPage } = await svc
      .from('experience_pages')
      .select('id, experience_name')
      .eq('id', parsed.data.experience_page_id!)
      .eq('status', 'active')
      .single()

    if (expPage == null) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 })
    }

    tripTitle = expPage.experience_name
  }

  // Sort dates before storing
  const sortedDates = [...parsed.data.requested_dates].sort()

  // Insert inquiry
  // Cast needed until generated types catch up with the migration that makes
  // trip_id nullable and adds experience_page_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry, error: dbError } = await (svc.from('inquiries') as any)
    .insert({
      trip_id:            parsed.data.trip_id ?? null,
      experience_page_id: parsed.data.experience_page_id ?? null,
      guide_id:           guideId,
      angler_name:        parsed.data.angler_name,
      angler_email:       parsed.data.angler_email,
      requested_dates:    sortedDates,
      party_size:         parsed.data.party_size,
      message:            parsed.data.message ?? null,
      selected_option:    parsed.data.selected_option ?? null,
      angler_phone:       parsed.data.angler_phone ?? null,
      status:             'pending',
    })
    .select('id, status')
    .single()

  if (dbError != null || inquiry == null) {
    console.error('[inquiries/POST] DB insert error:', dbError)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
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
      sendInquiryReceivedAnglerEmail({
        to:             parsed.data.angler_email,
        anglerName:     parsed.data.angler_name,
        tripTitle,
        requestedDates: sortedDates,
        partySize:      parsed.data.party_size,
        inquiryId:      inquiry.id,
      }),
    ])
  } catch (err) {
    // Log but don't fail the request — inquiry is already saved
    console.error('[inquiries/POST] Email error:', err)
  }

  console.log(`[inquiries/POST] Created inquiry ${inquiry.id} (${parsed.data.trip_id ? `trip ${parsed.data.trip_id}` : `page ${parsed.data.experience_page_id}`})`)

  if (env.AI_AUTO_REPLY_ENABLED) {
    try {
      await runAgentRound1({
        inquiryId:      inquiry.id,
        anglerName:     parsed.data.angler_name,
        anglerEmail:    parsed.data.angler_email,
        tripTitle,
        message:        parsed.data.message ?? null,
        requestedDates: sortedDates,
        partySize:      parsed.data.party_size,
      })
    } catch (err) {
      console.error('[inquiries/POST] Agent error:', err)
      // never block the 201 response
    }
  }

  return NextResponse.json({ id: inquiry.id, status: inquiry.status }, { status: 201 })
}
