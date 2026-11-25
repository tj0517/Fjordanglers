/**
 * Sending a guide request by hand (FA-M.05, variant A — tj 2026-11-23).
 *
 * FA has no WhatsApp Business API: the request record is created here (FA-M.03, emits
 * guide.request_sent), and the admin gets a `https://wa.me/<digits>?text=<message>` link to send the
 * message from tj's own WhatsApp. The message carries the `/r/<token>` link.
 *
 * The plain token exists only in the return value of sendGuideRequestByWhatsApp(): it is never
 * stored (only its sha256 is, by create_guide_request), never logged, never put in an admin URL.
 * Callers return it to the admin once and drop it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getGuidePhone } from '@/lib/guide-contacts'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { createGuideRequest, withdrawOtherOpenRequests } from './requests'
import type { GuideRequestPushJob } from '@/lib/push/guide-request-push'

type Client = SupabaseClient<Database>

// ─── message ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function day(iso: string): string {
  return String(utc(iso).getUTCDate())
}

function dayMonth(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}

/** "14–15 Jan", "30 Jan – 2 Feb", "12 Jun, 14 Jun", "14 Jan"; empty → "flexible dates". */
export function shortDates(dates: readonly string[]): string {
  if (dates.length === 0) return 'flexible dates'
  const sorted = [...new Set(dates)].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (sorted.length === 1) return dayMonth(first)
  const consecutive = sorted.every((d, i) => i === 0 || utc(d).getTime() - utc(sorted[i - 1]).getTime() === DAY_MS)
  if (!consecutive) return sorted.map(dayMonth).join(', ')
  const sameMonth = first.slice(0, 7) === last.slice(0, 7)
  return sameMonth ? `${day(first)}–${dayMonth(last)}` : `${dayMonth(first)} – ${dayMonth(last)}`
}

export interface GuideRequestMessageInput {
  guideFirstName: string | null
  partySize:      number | null
  /** Region of the experience, else the trip country; null when neither is known. */
  area:           string | null
  dates:          readonly string[]
  link:           string
}

/**
 * The WhatsApp text, in the wording of the approved push (docs/design/fa-m-guide-app/Push.dc.html):
 * "New request · Taupō, 14–15 Jan" / "2 anglers … Tap to accept, decline or suggest dates."
 * No client budget, no client name (FA-M.04 decision 2).
 */
export function buildGuideRequestMessage(input: GuideRequestMessageInput): string {
  const greeting = input.guideFirstName != null && input.guideFirstName !== '' ? `Hi ${input.guideFirstName},` : 'Hi,'
  return [
    greeting,
    '',
    requestHeadline(input),
    `${partyLine(input.partySize)}Tap to accept, decline or suggest dates:`,
    input.link,
    '',
    'FjordAnglers',
  ].join('\n')
}

/**
 * The push text (FA-M.12), same wording as the WhatsApp message and Push.dc.html: title
 * "New request · Taupō, 14–15 Jan", body "2 anglers. Tap to accept, decline or suggest dates."
 * No level / method (tj 2026-11-25: as the WhatsApp text), no link — the link is the click target.
 */
function buildGuideRequestPushText(input: Omit<GuideRequestMessageInput, 'guideFirstName' | 'link'>): { title: string; body: string } {
  return { title: requestHeadline(input), body: `${partyLine(input.partySize)}Tap to accept, decline or suggest dates.` }
}

function requestHeadline(input: { area: string | null; dates: readonly string[] }): string {
  const where = input.area != null ? `${input.area}, ` : ''
  return `New request · ${where}${shortDates(input.dates)}`
}

function partyLine(partySize: number | null): string {
  return partySize != null && partySize > 0 ? `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}. ` : ''
}

/** wa.me link for an E.164 number (validated again here — never built from unchecked input). */
export function waMeUrl(phoneE164: string, text: string): string {
  if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) throw new Error('waMeUrl: not an E.164 number')
  return `https://wa.me/${phoneE164.slice(1)}?text=${encodeURIComponent(text)}`
}

// ─── send ─────────────────────────────────────────────────────────────────────

export type SendGuideRequestResult =
  /** previousStillActive: an earlier open request could not be withdrawn (D5) — its link still works. */
  | { ok: true; requestId: string; waUrl: string; link: string; previousStillActive: boolean }
  | { ok: false; reason: 'no_whatsapp_number' | 'guide_not_found' | 'inquiry_not_found' }

export interface SendGuideRequestHooks {
  /**
   * FA-M.12: hands the push job to whoever runs it after the response (the action: Next `after()`).
   * Called once, after the request is committed. Whatever it does — throw included — never changes
   * the send's result: the request, its event and the wa.me link stand.
   */
  schedulePush?: (job: GuideRequestPushJob) => void
}

/**
 * Call after requireAdmin(); `adminId` is the caller's uid, `appUrl` the site origin. Checks the
 * guide's number first — no number, no request. Then creates the request (one row + one
 * guide.request_sent event, channel whatsapp, in one transaction) and returns the wa.me link.
 * Then (D5 a) withdraws the inquiry's other open requests; a failure there is reported, not hidden.
 * Last, the push to the guide's phones is scheduled (FA-M.12) — it runs after the response.
 */
export async function sendGuideRequestByWhatsApp(
  client: Client,
  params: { inquiryId: string; guideId: string; adminId: string; appUrl: string },
  hooks: SendGuideRequestHooks = {},
): Promise<SendGuideRequestResult> {
  const phone = await getGuidePhone(params.guideId)
  if (phone == null) return { ok: false, reason: 'no_whatsapp_number' }

  const { data: guide, error: guideError } = await client
    .from('guides')
    .select('full_name, country')
    .eq('id', params.guideId)
    .maybeSingle()
  if (guideError != null) throw new Error(`sendGuideRequestByWhatsApp: guide read failed: ${guideError.message}`)
  if (guide == null) return { ok: false, reason: 'guide_not_found' }

  const { data: inquiry, error: inquiryError } = await client
    .from('inquiries')
    .select('party_size, requested_dates, trip_country, experience_page_id, trip_id')
    .eq('id', params.inquiryId)
    .maybeSingle()
  if (inquiryError != null) throw new Error(`sendGuideRequestByWhatsApp: inquiry read failed: ${inquiryError.message}`)
  if (inquiry == null) return { ok: false, reason: 'inquiry_not_found' }

  const experience = await getInquiryExperience({
    experience_page_id: inquiry.experience_page_id,
    trip_id:            inquiry.trip_id,
  })
  const region = experience?.region.trim() ?? ''
  // An inquiry without a country takes the guide's in create_guide_request (D4) — say the same here.
  const country = inquiry.trip_country?.trim() || guide.country?.trim() || ''

  const created = await createGuideRequest(client, {
    inquiryId: params.inquiryId,
    guideId:   params.guideId,
    channel:   'whatsapp',
    adminId:   params.adminId,
  })

  const previous = await withdrawOtherOpenRequests(client, {
    inquiryId: params.inquiryId, keepRequestId: created.requestId, adminId: params.adminId,
  })

  const path = `/r/${created.token}`
  const link = `${params.appUrl.replace(/\/+$/, '')}${path}`
  const facts = {
    partySize: inquiry.party_size,
    area:      region !== '' ? region : country !== '' ? country : null,
    dates:     inquiry.requested_dates ?? [],
  }
  const text = buildGuideRequestMessage({ ...facts, guideFirstName: guide.full_name.trim().split(/\s+/)[0] ?? null, link })

  if (hooks.schedulePush != null) {
    try {
      hooks.schedulePush({
        inquiryId: params.inquiryId, requestId: created.requestId, guideId: params.guideId,
        ...buildGuideRequestPushText(facts), path,
      })
    } catch {
      console.error(`[push] request ${created.requestId}: could not schedule the push; the request itself was sent`)
    }
  }
  return { ok: true, requestId: created.requestId, waUrl: waMeUrl(phone, text), link, previousStillActive: previous.failed > 0 }
}
