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
import type { JudgeResult } from '@/lib/ai/judge-reply'

const HOUR_MS = 60 * 60 * 1000

/** An inquiry from the same e-mail within this window of an earlier one is a repeat (O-28 b). */
export const REPEAT_WINDOW_MS = 24 * HOUR_MS

/** Auto-sends are counted over this rolling window against the daily cap (O-30). */
export const AUTO_SEND_CAP_WINDOW_MS = 24 * HOUR_MS

/** Used when AI_AUTO_SEND_DAILY_CAP is not set (O-30: 5 per day to start; 20 since FA-1.72, decision tj 2026-10-26). */
const DEFAULT_AUTO_SEND_DAILY_CAP = 20

/** The browser reports how long the form was on screen (O-27 a); under this is treated as automated. */
const MIN_FILL_MS = 2000

export const REPEAT_SKIP_REASON  = 'repeat submission from same e-mail within 24 h'
const TRAP_SKIP_REASON    = 'trap field filled'
const FAST_SKIP_REASON    = 'form submitted less than 2 s after it was shown'
export const CAP_REACHED_REASON  = 'daily auto-send cap reached'
export const CAP_UNCHECKED_REASON = 'daily auto-send cap could not be checked'
export const HUMAN_TAKEOVER_REASON = 'human has taken over the thread'
export const TAKEOVER_UNCHECKED_REASON = 'could not check whether a human has taken over the thread'
const JUDGE_NO_EVIDENCE_REASON = 'judge blocked without evidence'

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

// ─── The judge's verdict → send or hold (FA-1.72) ─────────────────────────────

export interface VerdictDecision {
  send:    boolean
  /** What goes to the event and the result. A hold names its cause first. */
  reasons: string[]
  /** The judge said send=false for group 4/5 but its evidence did not stand up against the draft. */
  blockedWithoutEvidence: boolean
}

/** Whitespace collapsed: a JSON string cannot carry the draft's line breaks, but the words must match. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** True when there is at least one entry and every quote is literally a part of the draft. */
function evidenceStandsUp(evidence: JudgeResult['evidence'], draftText: string): boolean {
  if (evidence.length === 0) return false
  const draft = collapse(draftText)
  return evidence.every(e => {
    const quote = collapse(e.draft_quote)
    return quote !== '' && draft.includes(quote)
  })
}

/**
 * The whole send decision, apart from the daily cap. One place, so autoSendReply and the real-model
 * proof script apply the same rule.
 *
 *   1. Any client flag (complaint / competitor / guide_contact) → hold, whatever `send` says and
 *      however good the draft is. No evidence is asked for: the flag is about the angler.
 *   2. `send=true` → send.
 *   3. `send=false` (groups 4/5) → hold; if the judge cannot show a quote that is literally in the
 *      draft, the hold is recorded as "judge blocked without evidence". It is never turned into a
 *      send — the gate only shows in the data how often the judge blocks without grounds.
 */
export function decideFromVerdict(judged: JudgeResult, draftText: string): VerdictDecision {
  const raised = (Object.keys(judged.client_flags) as (keyof JudgeResult['client_flags'])[])
    .filter(flag => judged.client_flags[flag])
  if (raised.length > 0) {
    return { send: false, reasons: [...raised.map(flag => `client flag: ${flag}`), ...judged.reasons], blockedWithoutEvidence: false }
  }
  if (judged.send) return { send: true, reasons: judged.reasons, blockedWithoutEvidence: false }
  if (!evidenceStandsUp(judged.evidence, draftText)) {
    return { send: false, reasons: [JUDGE_NO_EVIDENCE_REASON, ...judged.reasons], blockedWithoutEvidence: true }
  }
  return { send: false, reasons: judged.reasons, blockedWithoutEvidence: false }
}
