/**
 * Guide contact details — the only reader of `guide_contacts`.
 *
 * The table is service_role only (migration 20261004000000): a guide's private WhatsApp
 * number must never sit on `guides`, which the anon key can read in full. Because these
 * helpers use the service client, the caller is responsible for having authenticated
 * (admin session, or a verified webhook) before it gets here.
 */

import { createServiceClient } from '@/lib/supabase/server'

/** The guide's WhatsApp number in E.164, or null when none is on file. */
export async function getGuidePhone(guideId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('guide_contacts')
    .select('phone_e164')
    .eq('guide_id', guideId)
    .maybeSingle()
  return data?.phone_e164 ?? null
}

/** Ids of every guide registered with this E.164 number (shared phones are valid). */
export async function findGuideIdsByPhone(phoneE164: string): Promise<string[]> {
  const { data } = await createServiceClient()
    .from('guide_contacts')
    .select('guide_id')
    .eq('phone_e164', phoneE164)
  return (data ?? []).map(row => row.guide_id)
}
