/**
 * Backfilled history — FA-1.37.
 *
 * `recordPastPayment` is the one way to tell the app about a deposit that was already
 * paid, with its real date, instead of every status click stamping "now". It bypasses
 * `transition()` and `ALLOWED_TRANSITIONS` on purpose: O-25 (tj, 2026-09-27) allows the
 * historical jump straight to `paid`/`completed` for every inquiry, marked `backfill`,
 * because a past booking did not travel through the app's own state machine.
 *
 * Order matches `transition()`: compare-and-set write → events → rollback on event
 * failure. `deposit_paid_at IS NULL` is the idempotency gate, same as the Stripe
 * webhook (src/app/api/webhooks/stripe-deposit/route.ts) — correcting an existing
 * payment is out of scope (separate task, docs/deferred-tasks.md).
 */

import { emitEvent, type EventActor, type EventClient } from '@/lib/events/emit'
import { fetchEurRateOn } from '@/lib/fx'
import { isDepositCurrency } from '@/lib/inquiries/deposit'
import { stageReachedFor } from '@/lib/inquiries/state'

type PastPaymentFinalStatus = 'paid' | 'completed'

export interface RecordPastPaymentInput {
  /** Warsaw calendar date the payment actually landed, 'YYYY-MM-DD'. Never in the future. */
  paidOn:      string
  amountCents: number
  currency:    string
  finalStatus: PastPaymentFinalStatus
  note?:       string | null
  actor:       EventActor
}

export interface RecordPastPaymentResult {
  from: string
  to:   PastPaymentFinalStatus
}

export class HistoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HistoryError'
  }
}

// ─── Date helpers ───────────────────────────────────────────────────────────────

/** Today's calendar date in Europe/Warsaw, 'YYYY-MM-DD'. */
function warsawToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

/** Strict 'YYYY-MM-DD' parse — rejects both malformed strings and non-existent dates (e.g. Feb 30). */
function parseIsoDateStrict(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m == null) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}

/** UTC noon on the given calendar date — always lands on the same Warsaw calendar day (offset ≤ +2). */
function instantOf(paidOn: string): string {
  return new Date(`${paidOn}T12:00:00.000Z`).toISOString()
}

// ─── recordPastPayment ────────────────────────────────────────────────────────

export async function recordPastPayment(
  client: EventClient,
  inquiryId: string,
  input: RecordPastPaymentInput,
): Promise<RecordPastPaymentResult> {
  const { paidOn, amountCents, finalStatus, actor } = input
  const note = input.note?.trim() ?? ''

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HistoryError('Amount must be a positive integer (minor units)')
  }
  if (finalStatus !== 'paid' && finalStatus !== 'completed') {
    throw new HistoryError(`Unknown final status ${JSON.stringify(finalStatus)} — must be paid or completed`)
  }
  const currency = input.currency.toUpperCase()
  if (!isDepositCurrency(currency)) {
    throw new HistoryError(`Currency ${currency} not supported (allowed: EUR, USD, ISK, NZD)`)
  }
  if (!parseIsoDateStrict(paidOn)) {
    throw new HistoryError(`Invalid date ${JSON.stringify(paidOn)} — expected YYYY-MM-DD`)
  }
  const today = warsawToday()
  if (paidOn > today) {
    throw new HistoryError(`Payment date ${paidOn} is in the future (today is ${today} in Europe/Warsaw)`)
  }

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, status, deposit_paid_at')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new HistoryError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new HistoryError(`Inquiry ${inquiryId} not found`)
  }
  if (current.deposit_paid_at != null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has a deposit recorded (${current.deposit_paid_at}) — correcting an existing payment is out of scope`,
    )
  }

  const fromStatus = current.status

  let eurRate: number
  if (currency === 'EUR') {
    eurRate = 1
  } else {
    const rate = await fetchEurRateOn(paidOn, currency)
    if (rate == null) {
      throw new HistoryError(`Could not fetch the EUR/${currency} rate for ${paidOn} — try again in a moment`)
    }
    eurRate = rate
  }

  const paidOnInstant = instantOf(paidOn)
  const stage = stageReachedFor(finalStatus)

  // Compare-and-set on deposit_paid_at, same idempotency gate as the Stripe webhook.
  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update({
      status:               finalStatus,
      deposit_paid_at:      paidOnInstant,
      deposit_amount_cents: amountCents,
      deposit_currency:     currency,
      deposit_eur_rate:     eurRate,
      deposit_eur_rate_at:  paidOnInstant,
      ...(stage != null ? { stage_reached: stage } : {}),
    })
    .eq('id', inquiryId)
    .is('deposit_paid_at', null)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new HistoryError(`Could not record the payment on ${inquiryId}: ${updateError.message}`)
  }
  if (updated == null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has a deposit recorded — it changed underneath us. Reload and try again.`,
    )
  }

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'status.changed',
      actor,
      source:     'backfill',
      channel:    'app',
      fromStatus,
      toStatus:   finalStatus,
      payload:    { historical: true, ...(note !== '' ? { note } : {}) },
      occurredAt: paidOnInstant,
    })
    await emitEvent(client, {
      inquiryId,
      type:       'payment.received',
      actor,
      source:     'backfill',
      channel:    'app',
      payload:    { amount_cents: amountCents, currency, historical: true },
      occurredAt: paidOnInstant,
    })
  } catch (eventError) {
    // Put everything back; an unlogged payment would quietly corrupt every commission
    // and booking metric (CLAUDE.md rule 5).
    await client
      .from('inquiries')
      .update({
        status:               fromStatus,
        deposit_paid_at:      null,
        deposit_amount_cents: null,
        deposit_currency:     null,
        deposit_eur_rate:     null,
        deposit_eur_rate_at:  null,
      })
      .eq('id', inquiryId)
      .eq('status', finalStatus)
    throw new HistoryError(
      `Could not record the payment events, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  return { from: fromStatus, to: finalStatus }
}
