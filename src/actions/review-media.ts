'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * getReviewUploadUrl
 *
 * Generates a Supabase Storage signed upload URL so the browser can upload
 * directly to object storage — no file bytes pass through the Next.js server.
 *
 * Accepts any image or video type. No size limit imposed on our side;
 * the raw file goes straight to Supabase Storage from the angler's browser.
 */

import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'review-media'

export async function getReviewUploadUrl(
  token: string,
  filename: string,
  contentType: string,
): Promise<{ signedUrl: string; publicUrl: string; path: string } | { error: string }> {
  const svc = createServiceClient() as any

  // Validate the review token
  const { data: review } = await svc
    .from('reviews')
    .select('id, token_expires_at')
    .eq('token', token)
    .maybeSingle()

  if (review == null) return { error: 'Invalid review link.' }
  if (new Date(review.token_expires_at) < new Date()) return { error: 'Review link has expired.' }

  // Build a unique path inside the review's own folder
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'bin'
  const path = `${review.id as string}/${crypto.randomUUID()}.${ext}`

  const typedSvc = createServiceClient()
  const { data, error } = await typedSvc.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error != null || data == null) {
    console.error('[getReviewUploadUrl] Storage error:', error)
    return { error: 'Could not prepare upload. Please try again.' }
  }

  const { data: { publicUrl } } = typedSvc.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return {
    signedUrl: data.signedUrl,
    publicUrl,
    path,
  }
}
