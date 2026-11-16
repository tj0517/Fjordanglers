/**
 * Guide requests (FA-M.03) — the data layer for one assignment sent to one guide.
 *
 *   createGuideRequest              admin creates a request; returns the plain token exactly once
 *   findGuideRequestByToken         read by token, no side effects (the link page, FA-M.04)
 *   recordGuideRequestOpened        first opening of the link (only the first is recorded)
 *   answerGuideRequest              the guide answers through the link (once; same answer again = no-op)
 *   answerGuideRequestFromDashboard the signed-in dashboard (respondToAssignment, D2 b)
 *   withdrawGuideRequest            admin withdraws a request (FA-M.05 calls it)
 *
 * Every write is one database function (supabase/migrations/20261117000000_add_guide_requests.sql)
 * that changes the request, keeps the `inquiries` summary in sync and writes its `inquiry_events`
 * row in the same transaction (tj D3 a). Callers check who is calling first: requireAdmin() for
 * create / withdraw, requireGuide() + ownership for the dashboard; for the link the token is the
 * credential. All functions take the service client.
 *
 * Refusal precedence (fixed, tested): not_found > guide_removed > withdrawn > expired > already_answered.
 * The visitor of a link should see one generic message; the reason is for the admin.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { tripTimezone } from '@/lib/countries'
import { generateGuideRequestToken, hashGuideRequestToken, isGuideRequestToken } from './token'
import { GUIDE_ANSWERS, GuideRequestAnswerSchema, type GuideAnswer } from './schema'

type Client = SupabaseClient<Database>

export const GUIDE_REQUEST_CHANNELS = ['whatsapp', 'email'] as const
export type GuideRequestChannel = typeof GUIDE_REQUEST_CHANNELS[number]

export const GUIDE_REQUEST_REFUSALS = ['not_found', 'guide_removed', 'withdrawn', 'expired'] as const
export type GuideRequestRefusal = typeof GUIDE_REQUEST_REFUSALS[number]

function isRefusal(value: string): value is GuideRequestRefusal {
  return (GUIDE_REQUEST_REFUSALS as readonly string[]).includes(value)
}

function isAnswer(value: string | null): value is GuideAnswer {
  return value != null && (GUIDE_ANSWERS as readonly string[]).includes(value)
}

export class GuideRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuideRequestError'
  }
}

// ─── create ───────────────────────────────────────────────────────────────────

export interface CreatedGuideRequest {
  requestId: string
  /** The plain link token — returned here once, never stored or logged. */
  token:     string
  sentAt:    string
  expiresAt: string
}

/** Call after requireAdmin(); `adminId` is the caller's uid. Emits guide.request_sent. */
export async function createGuideRequest(
  client: Client,
  params: { inquiryId: string; guideId: string; channel: GuideRequestChannel; adminId: string },
): Promise<CreatedGuideRequest> {
  const { token, tokenHash } = generateGuideRequestToken()
  const { data, error } = await client.rpc('create_guide_request', {
    p_inquiry_id: params.inquiryId,
    p_guide_id:   params.guideId,
    p_channel:    params.channel,
    p_token_hash: tokenHash,
    p_admin_id:   params.adminId,
  })
  const row = data?.[0]
  if (error != null || row == null) {
    throw new GuideRequestError(`createGuideRequest failed: ${error?.message ?? 'no row returned'}`)
  }
  return { requestId: row.request_id, token, sentAt: row.sent_at, expiresAt: row.token_expires_at }
}

// ─── find ─────────────────────────────────────────────────────────────────────

export interface GuideRequestView {
  requestId:     string
  inquiryId:     string
  guideId:       string
  sentAt:        string
  expiresAt:     string
  firstOpenedAt: string | null
  answeredAt:    string | null
  answer:        GuideAnswer | null
  altDates:      string[]
  note:          string | null
}

export type FindResult = { ok: true; request: GuideRequestView } | { ok: false; reason: GuideRequestRefusal }

export async function findGuideRequestByToken(client: Client, token: string): Promise<FindResult> {
  if (!isGuideRequestToken(token)) return { ok: false, reason: 'not_found' }
  const { data, error } = await client.rpc('find_guide_request', { p_token_hash: hashGuideRequestToken(token) })
  const row = data?.[0]
  if (error != null || row == null) {
    throw new GuideRequestError(`findGuideRequestByToken failed: ${error?.message ?? 'no row returned'}`)
  }
  if (row.outcome !== 'ok') {
    if (!isRefusal(row.outcome)) throw new GuideRequestError(`unknown outcome ${row.outcome}`)
    return { ok: false, reason: row.outcome }
  }
  const answer: string | null = row.answer
  return {
    ok: true,
    request: {
      requestId:     row.request_id,
      inquiryId:     row.inquiry_id,
      guideId:       row.guide_id,
      sentAt:        row.sent_at,
      expiresAt:     row.token_expires_at,
      firstOpenedAt: row.first_opened_at,
      answeredAt:    row.answered_at,
      answer:        isAnswer(answer) ? answer : null,
      altDates:      row.alt_dates ?? [],
      note:          row.note,
    },
  }
}

// ─── open ─────────────────────────────────────────────────────────────────────

export type OpenResult = { ok: true; firstOpen: boolean } | { ok: false; reason: GuideRequestRefusal }

/** Records the first opening only (emits guide.request_opened then); later calls change nothing. */
export async function recordGuideRequestOpened(client: Client, token: string): Promise<OpenResult> {
  if (!isGuideRequestToken(token)) return { ok: false, reason: 'not_found' }
  const { data, error } = await client.rpc('open_guide_request', { p_token_hash: hashGuideRequestToken(token) })
  const row = data?.[0]
  if (error != null || row == null) {
    throw new GuideRequestError(`recordGuideRequestOpened failed: ${error?.message ?? 'no row returned'}`)
  }
  if (row.outcome === 'ok') return { ok: true, firstOpen: row.first_open }
  if (!isRefusal(row.outcome)) throw new GuideRequestError(`unknown outcome ${row.outcome}`)
  return { ok: false, reason: row.outcome }
}

// ─── answer ───────────────────────────────────────────────────────────────────

export interface StoredAnswer {
  requestId:  string | null
  answer:     GuideAnswer
  altDates:   string[]
  note:       string | null
  answeredAt: string
}

export type AnswerResult =
  | { status: 'answered'; stored: StoredAnswer; summaryUpdated: boolean }
  /** The same answer again — nothing written, the stored answer returned. */
  | { status: 'unchanged'; stored: StoredAnswer }
  /** A different answer to an answered request — refused, the first answer stands. */
  | { status: 'already_answered'; stored: StoredAnswer }
  | { status: 'date_not_in_future' }
  | { status: 'invalid'; issues: string[] }
  | { status: 'refused'; reason: GuideRequestRefusal | 'not_assigned' }

type AnswerRow = Database['public']['Functions']['answer_guide_request']['Returns'][number]

function toResult(row: AnswerRow | undefined, op: string): AnswerResult {
  if (row == null) throw new GuideRequestError(`${op}: no row returned`)
  const outcome = row.outcome
  if (outcome === 'date_not_in_future') return { status: 'date_not_in_future' }
  if (outcome === 'not_assigned') return { status: 'refused', reason: 'not_assigned' }
  if (isRefusal(outcome)) return { status: 'refused', reason: outcome }

  const answer: string | null = row.answer
  if (!isAnswer(answer)) throw new GuideRequestError(`${op}: outcome ${outcome} without an answer`)
  const stored: StoredAnswer = {
    requestId:  row.request_id,
    answer,
    altDates:   row.alt_dates ?? [],
    note:       row.note,
    answeredAt: row.answered_at,
  }
  if (outcome === 'answered') return { status: 'answered', stored, summaryUpdated: row.summary_updated }
  if (outcome === 'unchanged') return { status: 'unchanged', stored }
  if (outcome === 'already_answered') return { status: 'already_answered', stored }
  throw new GuideRequestError(`${op}: unknown outcome ${outcome}`)
}

/**
 * The guide answers through the link. `input` is untrusted ({ answer, altDates?, note? }) and is
 * validated here; "after today" is checked in the database in the trip country's time zone.
 */
export async function answerGuideRequest(client: Client, token: string, input: unknown): Promise<AnswerResult> {
  if (!isGuideRequestToken(token)) return { status: 'refused', reason: 'not_found' }

  const parsed = GuideRequestAnswerSchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'invalid', issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
  }

  const found = await findGuideRequestByToken(client, token)
  if (!found.ok) return { status: 'refused', reason: found.reason }

  const { data: inquiry, error: inquiryError } = await client
    .from('inquiries')
    .select('trip_country')
    .eq('id', found.request.inquiryId)
    .single()
  if (inquiryError != null) {
    throw new GuideRequestError(`answerGuideRequest: inquiry read failed: ${inquiryError.message}`)
  }

  const { data, error } = await client.rpc('answer_guide_request', {
    p_token_hash: hashGuideRequestToken(token),
    p_answer:     parsed.data.answer,
    p_alt_dates:  parsed.data.altDates,
    p_note:       parsed.data.note ?? '',
    p_timezone:   tripTimezone(inquiry.trip_country),
  })
  if (error != null) throw new GuideRequestError(`answerGuideRequest failed: ${error.message}`)
  return toResult(data?.[0], 'answerGuideRequest')
}

/**
 * Dashboard Accept / Decline (D2 b). Call after requireGuide() and the ownership check. Answers the
 * guide's latest request on the inquiry (not blocked by expiry); an assignment from before FA-M.03
 * has no request — the summary is written as before and the event carries no request_id.
 */
export async function answerGuideRequestFromDashboard(
  client: Client,
  params: { inquiryId: string; guideId: string; answer: 'accepted' | 'declined'; note?: string | null },
): Promise<AnswerResult> {
  const parsed = GuideRequestAnswerSchema.safeParse({ answer: params.answer, note: params.note })
  if (!parsed.success) {
    return { status: 'invalid', issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
  }
  const { data, error } = await client.rpc('answer_guide_request_for_guide', {
    p_inquiry_id: params.inquiryId,
    p_guide_id:   params.guideId,
    p_answer:     parsed.data.answer,
    p_note:       parsed.data.note ?? '',
  })
  if (error != null) throw new GuideRequestError(`answerGuideRequestFromDashboard failed: ${error.message}`)
  return toResult(data?.[0], 'answerGuideRequestFromDashboard')
}

// ─── withdraw ─────────────────────────────────────────────────────────────────

export type WithdrawOutcome = 'withdrawn' | 'not_found' | 'already_withdrawn'

/** Call after requireAdmin(). The link stops working (withdrawn); emits guide.request_withdrawn. */
export async function withdrawGuideRequest(
  client: Client,
  params: { requestId: string; adminId: string },
): Promise<WithdrawOutcome> {
  const { data, error } = await client.rpc('withdraw_guide_request', {
    p_request_id: params.requestId,
    p_admin_id:   params.adminId,
  })
  if (error != null) throw new GuideRequestError(`withdrawGuideRequest failed: ${error.message}`)
  if (data === 'withdrawn' || data === 'not_found' || data === 'already_withdrawn') return data
  throw new GuideRequestError(`withdrawGuideRequest: unknown outcome ${String(data)}`)
}
