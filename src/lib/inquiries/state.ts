/**
 * The inquiry state machine — docs/01-architecture.md §4.
 *
 * Statuses describe **who we are waiting for**, not a step in a linear pipeline,
 * because the angler and the guide conversations run in parallel and loop.
 *
 *   new ─▶ qualifying ◀─▶ waiting_guide ◀─▶ offer_presented ─▶ awaiting_payment ─▶ paid
 *    └────────────────────▶ (complete brief)
 *                                                                                   │
 *                                                                      handed_over ◀┘ ─▶ completed
 *   any non-terminal ─▶ lost | cancelled
 *
 * `inquiries.status` is changed by `transition()` and by nothing else. Webhooks, the
 * agent, the admin StatusChanger and any cron all call this one function, so every
 * change leaves a `status.changed` row in `inquiry_events` (CLAUDE.md rule 5).
 */

import { emitEvent, type EventActor, type EventClient } from '@/lib/events/emit'
import type { EventChannel, EventSource } from '@/lib/events/types'

// ─── Statuses ─────────────────────────────────────────────────────────────────

export const STATUSES = [
  'new',
  'qualifying',
  'waiting_guide',
  'offer_presented',
  'awaiting_payment',
  'paid',
  'handed_over',
  'completed',
  'lost',
  'cancelled',
] as const

export type InquiryStatus = typeof STATUSES[number]

const STATUS_SET: ReadonlySet<string> = new Set<string>(STATUSES)

export function isInquiryStatus(value: string): value is InquiryStatus {
  return STATUS_SET.has(value)
}

/** What the pill says in the admin panel. */
export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new:              'New',
  qualifying:       'Qualifying',
  waiting_guide:    'Waiting guide',
  offer_presented:  'Offer presented',
  awaiting_payment: 'Awaiting payment',
  paid:             'Paid',
  handed_over:      'Handed over',
  completed:        'Completed',
  lost:             'Lost',
  cancelled:        'Cancelled',
}

/** Who we are waiting for — the one line that explains the status to a human. */
export const STATUS_MEANINGS: Record<InquiryStatus, string> = {
  new:              'Landed, nobody replied yet',
  qualifying:       'We asked the angler something',
  waiting_guide:    'We asked a guide for availability or price',
  offer_presented:  'The angler has a concrete offer',
  awaiting_payment: 'Payment link sent',
  paid:             'Deposit received',
  handed_over:      'Guide notified, contacts exchanged',
  completed:        'Trip happened',
  lost:             'Terminal — we did not win it',
  cancelled:        'Terminal — called off',
}

export const TERMINAL_STATUSES: readonly InquiryStatus[] = ['completed', 'lost', 'cancelled']

export function isTerminal(status: InquiryStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

// ─── Allowed transitions ──────────────────────────────────────────────────────

/**
 * Two rules shape this table:
 *
 *   • The middle of the process loops. `qualifying`, `waiting_guide` and
 *     `offer_presented` reach each other in both directions — the angler changes the
 *     dates after seeing an offer and we are back at the guide.
 *   • The money path is strict. `awaiting_payment` is reachable only from
 *     `offer_presented`, and `paid` only from `awaiting_payment`. Nothing else can
 *     make an inquiry look booked.
 *
 * Leaving `awaiting_payment` backwards into the loop is allowed (a deal reopens before
 * it is paid); that does not weaken the rule above, because `paid` still has exactly
 * one way in.
 *
 * Every non-terminal status can go to `lost` or `cancelled`.
 */
const LOOP: readonly InquiryStatus[] = ['qualifying', 'waiting_guide', 'offer_presented']
const OUT:  readonly InquiryStatus[] = ['lost', 'cancelled']

export const ALLOWED_TRANSITIONS: Record<InquiryStatus, readonly InquiryStatus[]> = {
  // A lead that arrives with a complete brief goes straight to a guide — there is
  // nothing left to ask the angler first (tj, 16 IX).
  new:              ['qualifying', 'waiting_guide', ...OUT],
  qualifying:       [...LOOP.filter(s => s !== 'qualifying'), ...OUT],
  waiting_guide:    [...LOOP.filter(s => s !== 'waiting_guide'), ...OUT],
  offer_presented:  [...LOOP.filter(s => s !== 'offer_presented'), 'awaiting_payment', ...OUT],
  awaiting_payment: ['paid', ...LOOP, ...OUT],
  paid:             ['handed_over', ...OUT],
  handed_over:      ['completed', ...OUT],
  completed:        [],
  lost:             [],
  cancelled:        [],
}

export function nextStatuses(from: string): readonly InquiryStatus[] {
  return isInquiryStatus(from) ? ALLOWED_TRANSITIONS[from] : []
}

export function canTransition(from: string, to: string): boolean {
  return isInquiryStatus(to) && nextStatuses(from).includes(to)
}

// ─── stage_reached ────────────────────────────────────────────────────────────

/**
 * `stage_reached` is the legacy four-step funnel column kept by a trigger that only
 * ever lets it advance (`inquiries_stage_must_advance`). It stays a cache computed
 * from the status until stage 4 drops it; `lost` and `cancelled` leave it where it is,
 * because how far an inquiry got is exactly what we want to count after losing it.
 */
const STAGE_BY_STATUS: Record<InquiryStatus, string | null> = {
  new:              'inquiry',
  qualifying:       'inquiry',
  waiting_guide:    'inquiry',
  offer_presented:  'offer_sent',
  awaiting_payment: 'offer_sent',
  paid:             'deposit_paid',
  handed_over:      'deposit_paid',
  completed:        'completed',
  lost:             null,
  cancelled:        null,
}

export function stageReachedFor(status: InquiryStatus): string | null {
  return STAGE_BY_STATUS[status]
}

// ─── transition ───────────────────────────────────────────────────────────────

export class TransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransitionError'
  }
}

export interface TransitionOptions {
  actor:            EventActor
  /** Why — free text from the admin, or a short machine reason. Lands in the payload. */
  reason?:          string | null
  channel?:         EventChannel | null
  /** How this reached us. `app` unless a webhook or a cron is calling. */
  source?:          EventSource
  /** Required when `to` is `lost` — the code list lives in the admin UI (FA-0.16). */
  lostReasonCode?:  string | null
  /** Optional free-text note stored next to the code. */
  lostReason?:      string | null
}

export interface TransitionResult {
  from: InquiryStatus | string
  to:   InquiryStatus
}

/**
 * Moves one inquiry to `to` and records it.
 *
 * Order matters: the status update is a compare-and-set on the status we read, so two
 * concurrent callers cannot both think they made the change; only then is the event
 * written. If the event cannot be written the status is put back and the call throws —
 * a state change nobody can see in the log is worse than no state change.
 *
 * Throws `TransitionError`; callers turn that into their own result shape.
 */
export async function transition(
  client: EventClient,
  inquiryId: string,
  to: InquiryStatus,
  opts: TransitionOptions,
): Promise<TransitionResult> {
  if (!isInquiryStatus(to)) {
    throw new TransitionError(`Unknown status ${JSON.stringify(to)}`)
  }
  if (to === 'lost' && (opts.lostReasonCode == null || opts.lostReasonCode === '')) {
    // Wording kept verbatim from FA-0.16 — the admin knows this sentence.
    throw new TransitionError('A loss reason is required when marking as lost.')
  }

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, status')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new TransitionError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new TransitionError(`Inquiry ${inquiryId} not found`)
  }

  const from = current.status
  if (from === to) {
    throw new TransitionError(`Inquiry is already ${STATUS_LABELS[to]}`)
  }
  if (!canTransition(from, to)) {
    const allowed = nextStatuses(from)
    throw new TransitionError(
      `${from} → ${to} is not an allowed transition` +
      (allowed.length > 0 ? ` (from ${from} you can go to: ${allowed.join(', ')})` : ''),
    )
  }

  const stage = stageReachedFor(to)
  const patch = {
    status:           to,
    lost_reason_code: to === 'lost' ? opts.lostReasonCode ?? null : null,
    lost_reason:      to === 'lost' ? opts.lostReason?.trim() ?? null : null,
    ...(stage != null ? { stage_reached: stage } : {}),
  }

  // Compare-and-set on the status we just read.
  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update(patch)
    .eq('id', inquiryId)
    .eq('status', from)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new TransitionError(`Could not move inquiry ${inquiryId} to ${to}: ${updateError.message}`)
  }
  if (updated == null) {
    throw new TransitionError(
      `Inquiry ${inquiryId} changed underneath us — it is no longer ${from}. Reload and try again.`,
    )
  }

  const source: EventSource = opts.source ?? 'app'

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'status.changed',
      actor:      opts.actor,
      source,
      channel:    opts.channel ?? 'app',
      fromStatus: from,
      toStatus:   to,
      payload:    opts.reason != null && opts.reason !== '' ? { reason: opts.reason } : {},
    })
  } catch (eventError) {
    // Put the status back; an unlogged change would quietly corrupt every time metric.
    await client
      .from('inquiries')
      .update({ status: from })
      .eq('id', inquiryId)
      .eq('status', to)
    throw new TransitionError(
      `Could not record the status change, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  if (to === 'lost') {
    // Second event, after the first one is safely written. If this throws, the status
    // and status.changed stand — the loss is visible, the reason breakdown is not.
    await emitEvent(client, {
      inquiryId,
      type:    'inquiry.lost',
      actor:   opts.actor,
      source,
      channel: opts.channel ?? 'app',
      payload: {
        lost_reason_code: opts.lostReasonCode,
        ...(opts.lostReason != null && opts.lostReason !== '' ? { note: opts.lostReason } : {}),
      },
    })
  }

  return { from, to }
}
