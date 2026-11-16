/**
 * The request page `/r/[token]` (FA-M.04) — what a guide sees and does through the link.
 *
 *   getGuideRequestPage      read: request state + the trip essentials, no side effects
 *   openFromRequestPage      the page reports it has rendered in a browser (tj D1 a)
 *   answerFromRequestPage    Accept / Decline / Other dates, mapped to what the page shows
 *
 * The token is the credential: every call goes through the FA-M.03 functions, which check it
 * (hash lookup, expiry, withdrawal, guide removed) inside the same database call that writes.
 * Any refusal comes back as one shape with no reason (`{ ok: false }` / `expired`), so the
 * page cannot tell a link holder whether a request exists, was withdrawn or ran out.
 *
 * Reads only the columns named in its select — no FA notes (tj D3 a; the guide brief block is
 * FA-M.07) — and the brief comes without its budget lines (tj D2 a). Server-only: imports the token module
 * (node:crypto) and is called with the service client from the page and its server actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { tripTimezone } from '@/lib/countries'
import { guideBriefSummaryLines } from '@/lib/inquiries/brief'
import { briefSchema } from '@/lib/inquiries/brief-schema'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { answerGuideRequest, findGuideRequestByToken, recordGuideRequestOpened } from './requests'
import type { GuideAnswer } from './schema'

type Client = SupabaseClient<Database>

export interface GuideRequestAnswerView {
  answer:     GuideAnswer
  altDates:   string[]
  note:       string | null
  answeredAt: string
}

interface GuideRequestPageView {
  country:        string | null
  /** From the trip page the inquiry was made on; null when there is none. */
  region:         string | null
  /** The client's days (YYYY-MM-DD), sorted; empty when the client gave none. */
  requestedDates: string[]
  partySize:      number | null
  /** The brief as lines, without budget; null when the inquiry has no (valid) brief. */
  brief:          string[] | null
  /** The first day the guide may propose: tomorrow in the trip country's time zone. */
  earliestAltDate: string
  /** null until the guide has answered. */
  answered:       GuideRequestAnswerView | null
}

export type GuideRequestPageResult = { ok: true; view: GuideRequestPageView } | { ok: false }

/** YYYY-MM-DD of today + `days` in an IANA time zone. */
export function dateInZone(zone: string, days: number, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function getGuideRequestPage(client: Client, token: string): Promise<GuideRequestPageResult> {
  const found = await findGuideRequestByToken(client, token)
  if (!found.ok) return { ok: false }
  const request = found.request

  const { data: inquiry, error } = await client
    .from('inquiries')
    .select('trip_country, requested_dates, party_size, brief, experience_page_id, trip_id')
    .eq('id', request.inquiryId)
    .single()
  if (error != null) throw new Error(`getGuideRequestPage: inquiry read failed: ${error.message}`)

  const experience = await getInquiryExperience({
    experience_page_id: inquiry.experience_page_id,
    trip_id:            inquiry.trip_id,
  })
  const parsedBrief = inquiry.brief == null ? null : briefSchema.safeParse(inquiry.brief)
  const region = experience?.region.trim() ?? ''

  return {
    ok: true,
    view: {
      country:         inquiry.trip_country,
      region:          region === '' ? null : region,
      requestedDates:  [...(inquiry.requested_dates ?? [])].sort(),
      partySize:       inquiry.party_size,
      brief:           parsedBrief?.success === true ? guideBriefSummaryLines(parsedBrief.data) : null,
      earliestAltDate: dateInZone(tripTimezone(inquiry.trip_country), 1),
      answered:        request.answer == null || request.answeredAt == null ? null : {
        answer:     request.answer,
        altDates:   request.altDates,
        note:       request.note,
        answeredAt: request.answeredAt,
      },
    },
  }
}

/**
 * Called by the page once it has rendered in a browser — never by the server render, so a link
 * preview fetch (WhatsApp, Meta) does not count as an opening (tj D1 a). Only the first call
 * writes (`first_opened_at` + one `guide.request_opened`); a refused token writes nothing.
 */
export async function openFromRequestPage(client: Client, token: string): Promise<void> {
  await recordGuideRequestOpened(client, token)
}

export type RequestPageAnswerOutcome =
  /** Saved now, or the same answer again (nothing new written). */
  | { kind: 'saved'; answered: GuideRequestAnswerView }
  /** A different answer was sent earlier — it stands and is shown. */
  | { kind: 'already_answered'; answered: GuideRequestAnswerView }
  | { kind: 'date_not_in_future' }
  | { kind: 'invalid' }
  /** Any refusal of the link — one outcome, no reason. */
  | { kind: 'expired' }

/** `input` is untrusted ({ answer, altDates?, note? }); `answerGuideRequest` validates it. */
export async function answerFromRequestPage(client: Client, token: string, input: unknown): Promise<RequestPageAnswerOutcome> {
  const result = await answerGuideRequest(client, token, input)
  switch (result.status) {
    case 'answered':
    case 'unchanged':
      return { kind: 'saved', answered: answerView(result.stored) }
    case 'already_answered':
      return { kind: 'already_answered', answered: answerView(result.stored) }
    case 'date_not_in_future':
      return { kind: 'date_not_in_future' }
    case 'invalid':
      return { kind: 'invalid' }
    case 'refused':
      return { kind: 'expired' }
  }
}

function answerView(stored: { answer: GuideAnswer; altDates: string[]; note: string | null; answeredAt: string }): GuideRequestAnswerView {
  return { answer: stored.answer, altDates: [...stored.altDates].sort(), note: stored.note, answeredAt: stored.answeredAt }
}
