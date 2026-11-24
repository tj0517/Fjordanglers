/**
 * Guide contact details — the only reader of `guide_contacts`.
 *
 * The table is service_role only (migration 20261004000000): a guide's private WhatsApp
 * number must never sit on `guides`, which the anon key can read in full. Because these
 * helpers use the service client, the caller is responsible for having authenticated
 * (admin session, or a verified webhook) before it gets here.
 *
 * A failed query throws (after logging). "No number on file" is `null` / `[]`; a database
 * error must not look like it — the composer would grey out WhatsApp and an inbound
 * message would go to `unmatched`, with no trace of why.
 */

import { createServiceClient } from '@/lib/supabase/server'

/** E.164: `+`, a country code that does not start with 0, 8–15 digits in all (FA-M.05). */
const E164 = /^\+[1-9]\d{7,14}$/

export type ParsedPhone = { ok: true; phoneE164: string | null } | { ok: false }

/**
 * Admin input → E.164 or "clear". Spaces, hyphens, dots and brackets are dropped; everything else
 * must already be E.164 (no guessing a country). Empty input = `null` (clears the number).
 */
export function parseGuidePhone(raw: string): ParsedPhone {
  const compact = raw.trim().replace(/[\s\-.()]/g, '')
  if (compact === '') return { ok: true, phoneE164: null }
  return E164.test(compact) ? { ok: true, phoneE164: compact } : { ok: false }
}

/** The guide's WhatsApp number in E.164, or null when none is on file. Throws on a query error. */
export async function getGuidePhone(guideId: string): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('guide_contacts')
    .select('phone_e164')
    .eq('guide_id', guideId)
    .maybeSingle()
  if (error) {
    console.error('[guide-contacts] getGuidePhone failed:', error)
    throw new Error(`guide_contacts read failed: ${error.message}`)
  }
  return data?.phone_e164 ?? null
}

/**
 * Ids of every guide registered with this E.164 number (shared phones are valid).
 * Throws on a query error: the matcher prefers an exception to a silent "no match".
 */
export async function findGuideIdsByPhone(phoneE164: string): Promise<string[]> {
  const { data, error } = await createServiceClient()
    .from('guide_contacts')
    .select('guide_id')
    .eq('phone_e164', phoneE164)
  if (error) {
    console.error('[guide-contacts] findGuideIdsByPhone failed:', error)
    throw new Error(`guide_contacts lookup failed: ${error.message}`)
  }
  return (data ?? []).map(row => row.guide_id)
}

/**
 * Store (or clear, with `null`) the guide's WhatsApp number. The caller has run requireAdmin() and
 * passes a value from parseGuidePhone(). Throws on a query error.
 */
export async function setGuidePhone(guideId: string, phoneE164: string | null): Promise<void> {
  if (phoneE164 != null && !E164.test(phoneE164)) throw new Error('setGuidePhone: not an E.164 number')
  const { error } = await createServiceClient()
    .from('guide_contacts')
    .upsert({ guide_id: guideId, phone_e164: phoneE164 }, { onConflict: 'guide_id' })
  if (error) {
    console.error('[guide-contacts] setGuidePhone failed:', error.message)
    throw new Error(`guide_contacts write failed: ${error.message}`)
  }
}
