/**
 * Cost and spam guards around auto-reply. FA-1.42.
 *
 * One place for the window, the daily cap, the reasons written to events, and the
 * single way a "decided not to send" fact reaches `inquiry_events`. Both callers use it:
 *   - api/inquiries/route.ts  — a repeat submission from the same e-mail is skipped
 *   - ai/auto-send.ts         — the daily cap holds the draft; every pipeline outcome
 *
 * FA-1.43 adds a third skip: a hidden trap field that was filled, or a form submitted
 * faster than a person can fill it. Both signals are supplied by the browser and are
 * trivially forgeable — they filter out simple bots, nothing more.
 *
 * A skip is recorded as `agent.auto_send_decided` with sent=false and the reason
 * (decision tj, 2026-10-03): the event catalog stays unchanged.
 *
 * SERVER-ONLY.
 */

import { env } from '@/lib/env'
import { emitEvent, type EventClient } from '@/lib/events/emit'

const HOUR_MS = 60 * 60 * 1000

/** An inquiry from the same e-mail within this window of an earlier one is a repeat (O-28 b). */
export const REPEAT_WINDOW_MS = 24 * HOUR_MS

/** Auto-sends are counted over this rolling window against the daily cap (O-30). */
export const AUTO_SEND_CAP_WINDOW_MS = 24 * HOUR_MS

/** Used when AI_AUTO_SEND_DAILY_CAP is not set (O-30: 5 per day to start). */
const DEFAULT_AUTO_SEND_DAILY_CAP = 5

/** The browser reports how long the form was on screen (O-27 a); under this is treated as automated. */
const MIN_FILL_MS = 2000

export const REPEAT_SKIP_REASON  = 'repeat submission from same e-mail within 24 h'
const TRAP_SKIP_REASON    = 'trap field filled'
const FAST_SKIP_REASON    = 'form submitted less than 2 s after it was shown'
export const CAP_REACHED_REASON  = 'daily auto-send cap reached'
export const CAP_UNCHECKED_REASON = 'daily auto-send cap could not be checked'

/**
 * Why this submission looks automated, or null when it does not.
 *
 * Both inputs are client-supplied and untrusted. The trap counts only as a non-blank
 * string. The duration (decision tj 2026-10-03: a duration, not a clock timestamp, so
 * client clock drift cannot flag a real person) counts only as a finite number >= 0;
 * anything else — missing, negative, text, NaN, an object — is "no information" and
 * never suspicious. A large value is likewise just a normal request.
 */
export function suspicionReason(trap: unknown, elapsedMs: unknown): string | null {
  if (typeof trap === 'string' && trap.trim() !== '') return TRAP_SKIP_REASON
  if (typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < MIN_FILL_MS) {
    return FAST_SKIP_REASON
  }
  return null
}

export function dailyAutoSendCap(): number {
  return env.AI_AUTO_SEND_DAILY_CAP ?? DEFAULT_AUTO_SEND_DAILY_CAP
}

/**
 * Writes one `agent.auto_send_decided` event.
 *
 * Reasons never carry the angler's address — the event is tied to the inquiry id.
 */
export async function emitAutoSendDecision(
  client:         EventClient,
  inquiryId:      string,
  draftMessageId: string | null,
  sent:           boolean,
  score:          number | null,
  reasons:        string[],
): Promise<void> {
  await emitEvent(client, {
    inquiryId,
    type:    'agent.auto_send_decided',
    actor:   { kind: 'agent' },
    source:  'app',
    channel: 'email',
    payload: { sent, score, reasons, draft_message_id: draftMessageId },
  })
}
