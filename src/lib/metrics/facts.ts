// PERMANENT shared facts — the one definition of "is it a booking" for every screen
// (CLAUDE.md rule 7: booking = deposit_paid_at is set, never a status).
//
// FA-1.35: before this file, /admin/weekly, /admin/finances and /admin/pipeline each
// answered "booking?" differently — one from the payment date, one from statuses
// dropped in FA-1.03, one from status/stage_reached. Every screen now calls isBooked /
// bookedAt here, and reuses rowCommissionEur from ./commission for the money side —
// no screen computes either fact on its own.

import { STATUSES, type InquiryStatus } from '@/lib/inquiries/state'

export type BookingRow = { deposit_paid_at: string | null }

/** Booking = a paid deposit. Independent of `status` — a row can carry any status. */
export function isBooked(row: BookingRow): boolean {
  return row.deposit_paid_at !== null
}

/** The booking's date, or null when it is not booked. */
export function bookedAt(row: BookingRow): string | null {
  return row.deposit_paid_at
}

const WARSAW = 'Europe/Warsaw'

/**
 * The booking's calendar month in Europe/Warsaw, 'YYYY-MM' — or null when unbooked.
 * `deposit_paid_at` is an instant (UTC ISO string); slicing it directly gives the UTC
 * month, which disagrees with Warsaw around midnight CET/CEST (e.g. 22:30 UTC on the
 * last day of the month is already the 1st in Warsaw). Every screen bucketing a
 * booking by month must go through this, not a raw `.slice(0, 7)`.
 */
export function bookedMonthWarsaw(row: BookingRow): string | null {
  if (row.deposit_paid_at === null) return null
  return new Date(row.deposit_paid_at).toLocaleDateString('en-CA', { timeZone: WARSAW }).slice(0, 7)
}

// Statuses reached only once money has moved, or the deal is over — never "open".
const CLOSED_OR_TERMINAL: readonly InquiryStatus[] = ['paid', 'handed_over', 'completed', 'lost', 'cancelled']

/** Every status that is neither paid nor terminal — an inquiry still being worked. */
export const OPEN_DEAL_STATUSES: readonly InquiryStatus[] =
  STATUSES.filter(s => !CLOSED_OR_TERMINAL.includes(s))
