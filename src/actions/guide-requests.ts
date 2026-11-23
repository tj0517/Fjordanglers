'use server'

/**
 * Admin actions for guide requests and guide WhatsApp numbers (FA-M.05).
 *
 *   sendGuideRequest        create a request (channel whatsapp) and return the wa.me link — once
 *   withdrawGuideRequestAction  withdraw a request (its link stops working)
 *   saveGuideWhatsAppNumber store / clear the guide's number in guide_contacts
 *
 * Every action runs requireAdmin() before any service-role read or write. The request token is in
 * the return value of sendGuideRequest only — it is never logged, stored or put in a URL here.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { parseGuidePhone, setGuidePhone } from '@/lib/guide-contacts'
import { sendGuideRequestByWhatsApp } from '@/lib/guide-requests/send'
import { withdrawGuideRequest } from '@/lib/guide-requests/requests'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SendGuideRequestActionResult =
  | { success: true; waUrl: string; link: string }
  | { success: false; error: string }

const SEND_ERRORS = {
  no_whatsapp_number: 'This guide has no WhatsApp number. Add it on the guide’s edit page first.',
  guide_not_found:    'Guide not found.',
  inquiry_not_found:  'Inquiry not found.',
} as const

export async function sendGuideRequest(inquiryId: string, guideId: string): Promise<SendGuideRequestActionResult> {
  const { userId } = await requireAdmin()
  if (!UUID.test(inquiryId) || !UUID.test(guideId)) return { success: false, error: 'Invalid id.' }

  const result = await sendGuideRequestByWhatsApp(createServiceClient(), {
    inquiryId, guideId, adminId: userId, appUrl: await getAppUrl(),
  })
  if (!result.ok) return { success: false, error: SEND_ERRORS[result.reason] }

  revalidatePath(`/admin/inquiries/${inquiryId}`)
  revalidatePath('/admin/inquiries')
  return { success: true, waUrl: result.waUrl, link: result.link }
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
