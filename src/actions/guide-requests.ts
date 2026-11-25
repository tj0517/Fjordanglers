'use server'

/**
 * Admin actions for guide requests and guide WhatsApp numbers (FA-M.05).
 *
 *   sendGuideRequest                     create a request (channel whatsapp), withdraw the inquiry's other
 *                                        open requests (D5), return the wa.me link — once; then, after the
 *                                        response, push to the guide's phones (FA-M.12)
 *   withdrawGuideRequestAction           withdraw a request; the latest one also detaches the guide (D2)
 *   acceptGuideRequestOnBehalfAction     record "accepted" for the guide; event actor = admin (D1)
 *   detachGuideWithoutRequestAction    detach a guide attached without an open request (D3)
 *   saveGuideWhatsAppNumber              store / clear the guide's number in guide_contacts
 *
 * Every action runs requireAdmin() before any service-role read or write. The request token is in
 * the return value of sendGuideRequest only — it is never logged, stored or put in a URL here.
 */

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { parseGuidePhone, setGuidePhone } from '@/lib/guide-contacts'
import { sendGuideRequestByWhatsApp } from '@/lib/guide-requests/send'
import { notifyGuideOfNewRequest } from '@/lib/push/guide-request-push'
import {
  withdrawGuideRequest, acceptGuideRequestOnBehalf, detachGuideWithoutRequest,
} from '@/lib/guide-requests/requests'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SendGuideRequestActionResult =
  /** warning: the request was created, but an earlier link could not be withdrawn (D5, tj condition 3). */
  | { success: true; waUrl: string; link: string; warning: string | null }
  | { success: false; error: string }

const PREVIOUS_STILL_ACTIVE = 'Previous link still active — withdraw it manually.'

const SEND_ERRORS = {
  no_whatsapp_number: 'This guide has no WhatsApp number. Add it on the guide’s edit page first.',
  guide_not_found:    'Guide not found.',
  inquiry_not_found:  'Inquiry not found.',
} as const

export async function sendGuideRequest(inquiryId: string, guideId: string): Promise<SendGuideRequestActionResult> {
  const { userId } = await requireAdmin()
  if (!UUID.test(inquiryId) || !UUID.test(guideId)) return { success: false, error: 'Invalid id.' }

  const client = createServiceClient()
  const result = await sendGuideRequestByWhatsApp(client, {
    inquiryId, guideId, adminId: userId, appUrl: await getAppUrl(),
  }, {
    // FA-M.12: the push runs after the response. after() registers the promise with the platform
    // (Vercel: waitUntil), so the function is not frozen before the push goes out; it never throws.
    schedulePush: job => after(() => notifyGuideOfNewRequest(client, job)),
  })
  if (!result.ok) return { success: false, error: SEND_ERRORS[result.reason] }

  revalidatePath(`/admin/inquiries/${inquiryId}`)
  revalidatePath('/admin/inquiries')
  return { success: true, waUrl: result.waUrl, link: result.link, warning: result.previousStillActive ? PREVIOUS_STILL_ACTIVE : null }
}

export type SimpleActionResult = { success: true } | { success: false; error: string }

export async function withdrawGuideRequestAction(inquiryId: string, requestId: string): Promise<SimpleActionResult> {
  const { userId } = await requireAdmin()
  if (!UUID.test(inquiryId) || !UUID.test(requestId)) return { success: false, error: 'Invalid id.' }

  const outcome = await withdrawGuideRequest(createServiceClient(), { requestId, adminId: userId })
  if (outcome === 'not_found') return { success: false, error: 'Request not found.' }

  revalidatePath(`/admin/inquiries/${inquiryId}`)
  revalidatePath('/admin/inquiries')
  return { success: true }
}

const ACCEPT_ERRORS: Record<string, string> = {
  already_answered: 'The guide has already answered this request.',
  not_found:        'Request not found.',
  guide_removed:    'The guide was removed.',
  withdrawn:        'This request was withdrawn.',
  expired:          'This request has expired.',
}

export async function acceptGuideRequestOnBehalfAction(inquiryId: string, requestId: string): Promise<SimpleActionResult> {
  const { userId } = await requireAdmin()
  if (!UUID.test(inquiryId) || !UUID.test(requestId)) return { success: false, error: 'Invalid id.' }

  const outcome = await acceptGuideRequestOnBehalf(createServiceClient(), { requestId, adminId: userId })
  if (outcome !== 'answered' && outcome !== 'unchanged') return { success: false, error: ACCEPT_ERRORS[outcome] }

  revalidatePath(`/admin/inquiries/${inquiryId}`)
  revalidatePath('/admin/inquiries')
  return { success: true }
}

const DETACH_ERRORS: Record<string, string> = {
  not_found:        'Inquiry not found.',
  no_guide:         'No guide is attached.',
  has_open_request: 'This guide has an open request — withdraw the request instead.',
}

export async function detachGuideWithoutRequestAction(inquiryId: string): Promise<SimpleActionResult> {
  const { userId } = await requireAdmin()
  if (!UUID.test(inquiryId)) return { success: false, error: 'Invalid id.' }

  const outcome = await detachGuideWithoutRequest(createServiceClient(), { inquiryId, adminId: userId })
  if (outcome !== 'unassigned') return { success: false, error: DETACH_ERRORS[outcome] }

  revalidatePath(`/admin/inquiries/${inquiryId}`)
  revalidatePath('/admin/inquiries')
  return { success: true }
}

export type SaveNumberResult = { success: true; phoneE164: string | null } | { success: false; error: string }

export async function saveGuideWhatsAppNumber(guideId: string, raw: string): Promise<SaveNumberResult> {
  await requireAdmin()
  if (!UUID.test(guideId)) return { success: false, error: 'Invalid id.' }

  const parsed = parseGuidePhone(raw)
  if (!parsed.ok) {
    return { success: false, error: 'Use the international format: + and 8–15 digits, e.g. +64 21 123 4567.' }
  }
  await setGuidePhone(guideId, parsed.phoneE164)

  revalidatePath(`/admin/guides/${guideId}`)
  revalidatePath(`/admin/guides/${guideId}/edit`)
  return { success: true, phoneE164: parsed.phoneE164 }
}
