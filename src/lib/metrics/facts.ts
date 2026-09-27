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

// Statuses reached only once money has moved, or the deal is over — never "open".
const CLOSED_OR_TERMINAL: readonly InquiryStatus[] = ['paid', 'handed_over', 'completed', 'lost', 'cancelled']

/** Every status that is neither paid nor terminal — an inquiry still being worked. */
export const OPEN_DEAL_STATUSES: readonly InquiryStatus[] =
  STATUSES.filter(s => !CLOSED_OR_TERMINAL.includes(s))
