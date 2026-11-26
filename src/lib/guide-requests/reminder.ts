/**
 * FA-M.06 — "guide hasn't opened" for the admin, and the one manual WhatsApp reminder.
 *
 *   reminderState                 pure: what the admin sees for one request at `now`
 *   listReminderStates            the inquiry list / card: state of each inquiry's latest
 *                                 non-withdrawn request, computed at read time (no cron, no stored flag)
 *   recordGuideRequestReminder    record_guide_request_reminder (sets reminded_at + guide.request_reminded)
 *
 * The flag (tj 2026-11-25 / 2026-11-26): latest non-withdrawn request, not answered, never opened,
 * sent more than the threshold ago (12 h in season / 24 h — reminder-threshold.ts), not reminded.
 * Reminded → "reminded X h ago". Link expired (unanswered, not withdrawn) → "link expired — send a
 * new request", no reminder (§2 option B). Reminders only for WhatsApp requests (wrong_channel).
 *
 * Callers run requireAdmin() first; all functions take the service client. Nothing here sends
 * anything — the admin sends the wa.me text by hand.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { reminderThresholdHours } from './reminder-threshold'

type Client = SupabaseClient<Database>

const HOUR_MS = 3_600_000

// ─── state (pure) ─────────────────────────────────────────────────────────────

export interface ReminderInput {
  requestId:     string
  guideId:       string | null
  channel:       string
  sentAt:        string
  expiresAt:     string
  firstOpenedAt: string | null
  answeredAt:    string | null
  withdrawnAt:   string | null
  remindedAt:    string | null
}

export type ReminderState =
  /** Nothing to show: answered, withdrawn, guide removed, opened (and link alive), or still inside the threshold. */
  | { kind: 'none' }
  /** The flag: never opened, past the threshold, not reminded. `canRemind` is false for non-WhatsApp requests. */
  | { kind: 'not_opened'; requestId: string; guideId: string; hoursSinceSent: number; thresholdHours: number; canRemind: boolean }
  /** Reminded earlier, still not opened, link alive. */
  | { kind: 'reminded'; requestId: string; remindedAt: string; hoursAgo: number }
  /** Link expired with no answer (§2 option B): send a new request. `opened` says whether it was ever opened. */
  | { kind: 'expired'; requestId: string; opened: boolean }

export function reminderState(r: ReminderInput, thresholdHours: number, nowMs: number): ReminderState {
  if (r.withdrawnAt != null || r.answeredAt != null || r.guideId == null) return { kind: 'none' }
  if (Date.parse(r.expiresAt) <= nowMs) return { kind: 'expired', requestId: r.requestId, opened: r.firstOpenedAt != null }
  if (r.firstOpenedAt != null) return { kind: 'none' }
  if (r.remindedAt != null) {
    return { kind: 'reminded', requestId: r.requestId, remindedAt: r.remindedAt, hoursAgo: Math.floor((nowMs - Date.parse(r.remindedAt)) / HOUR_MS) }
  }
  const sinceMs = nowMs - Date.parse(r.sentAt)
  if (sinceMs <= thresholdHours * HOUR_MS) return { kind: 'none' }
  return {
    kind: 'not_opened', requestId: r.requestId, guideId: r.guideId,
    hoursSinceSent: Math.floor(sinceMs / HOUR_MS), thresholdHours,
    canRemind: r.channel === 'whatsapp',
  }
}

/** The list filter "Guide hasn't opened": never opened and past the threshold — flagged, reminded, or expired unopened. */
export function isGuideNotOpened(state: ReminderState | undefined): boolean {
  if (state == null) return false
  return state.kind === 'not_opened' || state.kind === 'reminded' || (state.kind === 'expired' && !state.opened)
}

// ─── read ─────────────────────────────────────────────────────────────────────

/**
 * Reminder state of each inquiry's latest non-withdrawn request, keyed by inquiry id. Inquiries
 * without such a request, or whose state is 'none', are absent. Pass `inquiryId` for one card.
 */
export async function listReminderStates(
  client: Client,
  opts: { inquiryId?: string } = {},
  nowMs: number = Date.now(),
): Promise<Record<string, ReminderState>> {
  let query = client
    .from('guide_requests')
    .select('id, inquiry_id, guide_id, channel, sent_at, token_expires_at, first_opened_at, answered_at, withdrawn_at, reminded_at, inquiries (requested_dates)')
    .is('withdrawn_at', null)
    .order('sent_at', { ascending: false })
    .order('id', { ascending: false })
  if (opts.inquiryId != null) query = query.eq('inquiry_id', opts.inquiryId)
  const { data, error } = await query
  if (error != null) throw new Error(`listReminderStates: request read failed: ${error.message}`)

  // Latest per inquiry (rows are newest first).
  const latest = new Map<string, NonNullable<typeof data>[number]>()
  for (const row of data ?? []) if (!latest.has(row.inquiry_id)) latest.set(row.inquiry_id, row)

  const guideIds = [...new Set([...latest.values()].map(r => r.guide_id).filter((g): g is string => g != null))]
  const seasonByGuide = await seasonMonthsByGuide(client, guideIds)

  const out: Record<string, ReminderState> = {}
  for (const [inquiryId, r] of latest) {
    const threshold = reminderThresholdHours(r.inquiries?.requested_dates ?? [], r.guide_id != null ? seasonByGuide.get(r.guide_id) ?? [] : [])
    const state = reminderState({
      requestId: r.id, guideId: r.guide_id, channel: r.channel, sentAt: r.sent_at, expiresAt: r.token_expires_at,
      firstOpenedAt: r.first_opened_at, answeredAt: r.answered_at, withdrawnAt: r.withdrawn_at, remindedAt: r.reminded_at,
    }, threshold, nowMs)
    if (state.kind !== 'none') out[inquiryId] = state
  }
  return out
}

/** Season months of each guide's pages: active experience_guides links (primary or backup), merged. */
async function seasonMonthsByGuide(client: Client, guideIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  if (guideIds.length === 0) return out
  const { data, error } = await client
    .from('experience_guides')
    .select('guide_id, experience_pages (season_months)')
    .in('guide_id', guideIds)
    .eq('status', 'active')
  if (error != null) throw new Error(`listReminderStates: season read failed: ${error.message}`)
  for (const row of data ?? []) {
    const months = row.experience_pages?.season_months ?? []
    out.set(row.guide_id, [...(out.get(row.guide_id) ?? []), ...months])
  }
  return out
}

// ─── write ────────────────────────────────────────────────────────────────────

const REMINDER_OUTCOMES = [
  'reminded', 'not_found', 'guide_removed', 'withdrawn',
  'already_answered', 'already_opened', 'already_reminded', 'wrong_channel', 'expired',
] as const
export type ReminderOutcome = typeof REMINDER_OUTCOMES[number]

function isReminderOutcome(value: string | undefined): value is ReminderOutcome {
  return value != null && (REMINDER_OUTCOMES as readonly string[]).includes(value)
}

/**
 * Call after requireAdmin(). Sets reminded_at and writes one guide.request_reminded in one
 * transaction; any other outcome wrote nothing.
 */
export async function recordGuideRequestReminder(
  client: Client,
  params: { requestId: string; adminId: string },
): Promise<ReminderOutcome> {
  const { data, error } = await client.rpc('record_guide_request_reminder', {
    p_request_id: params.requestId,
    p_admin_id:   params.adminId,
  })
  if (error != null) throw new Error(`recordGuideRequestReminder failed: ${error.message}`)
  const outcome = data?.[0]?.outcome
  if (isReminderOutcome(outcome)) return outcome
  throw new Error(`recordGuideRequestReminder: unknown outcome ${String(outcome)}`)
}
