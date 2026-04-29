/**
 * POST /api/inquiries — create a new FA inquiry.
 *
 * Saves to the `inquiries` table with status = 'pending_fa_review'.
 * Fires two emails:
 *   • FA: new inquiry notification (with dashboard link)
 *   • Angler: inquiry received confirmation
 *
 * No auth required — anglers do not need an account to submit an inquiry.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { sendInquiryReceivedFaEmail, sendInquiryReceivedAnglerEmail } from '@/lib/email'
import { env } from '@/lib/env'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

// ─── Validation schema ────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const InquirySchema = z.object({
  trip_id:         z.string().uuid(),
  angler_name:     z.string().min(1).max(100).transform(s => s.trim()),
  angler_email:    z.string().email(),
  angler_country:  z.string().min(2).max(80).transform(s => s.trim()),
  requested_dates: z
    .array(z.string().regex(dateRegex, 'Each date must be YYYY-MM-DD'))
    .min(1, 'At least one date is required')
    .max(30),
  party_size:      z.number().int().min(1).max(20),
  message:         z.string().max(2000).optional().nullable(),
})

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

  // Sort dates before storing
  const sortedDates = [...parsed.data.requested_dates].sort()

  // Insert inquiry
  const { data: inquiry, error: dbError } = await svc
    .from('inquiries')
    .insert({
      trip_id:         parsed.data.trip_id,
      guide_id:        trip.guide_id,
      angler_name:     parsed.data.angler_name,
      angler_email:    parsed.data.angler_email,
      angler_country:  parsed.data.angler_country,
      requested_dates: sortedDates,
      party_size:      parsed.data.party_size,
      message:         parsed.data.message ?? null,
      status:          'pending_fa_review',
    })
    .select('id, status')
    .single()

  if (dbError != null || inquiry == null) {
    console.error('[inquiries/POST] DB insert error:', dbError)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Fire-and-forget both emails
  const baseUrl      = env.NEXT_PUBLIC_APP_URL
  const dashboardUrl = `${baseUrl}/dashboard/inquiries/${inquiry.id}`

  Promise.all([
    sendInquiryReceivedFaEmail({
      to:             env.FA_EMAIL ?? 'contact@fjordanglers.com',
      anglerName:     parsed.data.angler_name,
      anglerEmail:    parsed.data.angler_email,
      anglerCountry:  parsed.data.angler_country,
      tripTitle:      trip.title,
      requestedDates: sortedDates,
      partySize:      parsed.data.party_size,
      message:        parsed.data.message ?? null,
      inquiryId:      inquiry.id,
      dashboardUrl,
    }),
    sendInquiryReceivedAnglerEmail({
      to:             parsed.data.angler_email,
      anglerName:     parsed.data.angler_name,
      tripTitle:      trip.title,
      requestedDates: sortedDates,
      partySize:      parsed.data.party_size,
      inquiryId:      inquiry.id,
    }),
  ]).catch(err => console.error('[inquiries/POST] Email error:', err))

  console.log(`[inquiries/POST] Created inquiry ${inquiry.id} for trip ${trip.id}`)

  return NextResponse.json({ id: inquiry.id, status: inquiry.status }, { status: 201 })
}
