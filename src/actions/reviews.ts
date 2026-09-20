'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { requireAdmin, requireToken } from '@/lib/auth/guards'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'

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
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * FA generates a one-time review link for a completed inquiry.
 * Safe to call multiple times — returns the existing token if one already exists.
 */
export async function generateReviewLink(
  inquiryId: string,
): Promise<{ url: string; token: string }> {
  await requireAdmin()
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

  const token = crypto.randomUUID().replace(/-/g, '')

  const { error } = await svc.from('reviews').insert({
    inquiry_id: inquiryId,
    token,
  })

  if (error) throw new Error(`Failed to create review link: ${error.message}`)

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

  const svc = createServiceClient()

  const { data: review } = await svc
    .from('reviews')
    .select('id, submitted_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (review == null) return { ok: false, error: 'Review link not found.' }
  if (review.submitted_at != null) return { ok: false, error: 'Review already submitted.' }

  const { error } = await svc
    .from('reviews')
    .update({
      overall_rating:   input.overallRating,
      would_recommend:  input.wouldRecommend ?? null,
      trip_description: input.tripDescription ?? null,
      comment:          input.comment ?? null,
      media_urls:       input.mediaUrls ?? [],
      submitted_at:     new Date().toISOString(),
    })
    .eq('id', reviewId)

  if (error) return { ok: false, error: error.message }

  return { ok: true }
}
