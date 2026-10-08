'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { requireAdmin, requireToken } from '@/lib/auth/guards'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { emitEvent } from '@/lib/events/emit'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewPageData {
  id: string
  inquiryId: string
  token: string
  tokenExpiresAt: string
  overallRating: number | null
  wouldRecommend: boolean | null
  comment: string | null
  submittedAt: string | null
  anglerName: string
  tripTitle: string | null
}

export interface ReviewSubmitInput {
  overallRating: number
  wouldRecommend?: boolean
  tripDescription?: string
  comment?: string
  mediaUrls?: string[]
  /** Required. The form sends false when the box is unticked; nothing defaults it here. */
  publishConsent: boolean
}

// External input: validated on the server before anything is written (FA-1.59).
const reviewSubmitSchema = z.object({
  overallRating:   z.number().int().min(1).max(5),
  wouldRecommend:  z.boolean().optional(),
  tripDescription: z.string().max(5000).optional(),
  comment:         z.string().max(5000).optional(),
  mediaUrls:       z.array(z.url({ protocol: /^https?$/ }).max(2048)).max(50).optional(),
  publishConsent:  z.boolean(),
})

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * FA generates a one-time review link for a completed inquiry.
 * Safe to call multiple times — returns the existing token if one already exists.
 * A new review is pinned to the experience page of its inquiry (NULL if it has none).
 */
export async function generateReviewLink(
  inquiryId: string,
): Promise<{ url: string; token: string }> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  // Return existing token if already generated
  const { data: existing } = await svc
    .from('reviews')
    .select('token')
    .eq('inquiry_id', inquiryId)
    .maybeSingle()

  if (existing != null) {
    const token = existing.token as string
    const url = `${await getAppUrl()}/reviews/${token}`
    return { url, token }
  }

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('experience_page_id')
    .eq('id', inquiryId)
    .maybeSingle()
  const experienceId = inquiry?.experience_page_id ?? null

  const token = crypto.randomUUID().replace(/-/g, '')

  const { error } = await svc.from('reviews').insert({
    inquiry_id:    inquiryId,
    token,
    experience_id: experienceId,
  })

  if (error) throw new Error(`Failed to create review link: ${error.message}`)

  await emitEvent(svc, {
    inquiryId,
    type:    'review.requested',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { experience_id: experienceId },
  })

  const url = `${await getAppUrl()}/reviews/${token}`
  return { url, token }
}

/**
 * Public — fetches review data by token (for the angler-facing review page).
 */
export async function getReviewByToken(token: string): Promise<ReviewPageData | null> {
  const svc = createServiceClient()

  const { data: review } = await svc
    .from('reviews')
    .select('id, inquiry_id, token, token_expires_at, overall_rating, would_recommend, comment, submitted_at')
    .eq('token', token)
    .maybeSingle()

  if (review == null) return null

  // Fetch inquiry for angler name
  const typedSvc = createServiceClient()
  const { data: inquiry } = await typedSvc
    .from('inquiries')
    .select('angler_name, trip_id, experience_page_id')
    .eq('id', review.inquiry_id)
    .single()

  const exp = inquiry
    ? await getInquiryExperience({
        experience_page_id: inquiry.experience_page_id,
        trip_id:            inquiry.trip_id,
      })
    : null
  const tripTitle: string | null = exp?.name ?? null

  return {
    id: review.id,
    inquiryId: review.inquiry_id,
    token: review.token,
    tokenExpiresAt: review.token_expires_at,
    overallRating: review.overall_rating ?? null,
    wouldRecommend: review.would_recommend ?? null,
    comment: review.comment ?? null,
    submittedAt: review.submitted_at ?? null,
    anglerName: inquiry?.angler_name ?? 'Angler',
    tripTitle,
  }
}

/**
 * Public — angler submits their review via the magic-link page.
 */
export async function submitReview(
  token: string,
  input: ReviewSubmitInput,
): Promise<{ ok: boolean; error?: string }> {
  const { id: reviewId } = await requireToken('review', token)

  const parsed = reviewSubmitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check your review and try again.' }
  const data = parsed.data

  const svc = createServiceClient()

  const { data: review } = await svc
    .from('reviews')
    .select('id, inquiry_id, submitted_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (review == null) return { ok: false, error: 'Review link not found.' }
  if (review.submitted_at != null) return { ok: false, error: 'Review already submitted.' }

  const submittedAt = new Date().toISOString()

  const { error } = await svc
    .from('reviews')
    .update({
      overall_rating:    data.overallRating,
      would_recommend:   data.wouldRecommend ?? null,
      trip_description:  data.tripDescription ?? null,
      comment:           data.comment ?? null,
      media_urls:        data.mediaUrls ?? [],
      publish_consent:   data.publishConsent,
      publish_consent_at: data.publishConsent ? submittedAt : null,
      submitted_at:      submittedAt,
    })
    .eq('id', reviewId)

  if (error) return { ok: false, error: error.message }

  await emitEvent(svc, {
    inquiryId: review.inquiry_id,
    type:      'review.submitted',
    actor:     { kind: 'angler' },
    source:    'app',
    channel:   'app',
    payload:   { publish_consent: data.publishConsent },
  })

  return { ok: true }
}
