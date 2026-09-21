// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
//
// The eight numbers of /admin/weekly (FA-1.10 D3), one pure function each.
// Rows in, numbers out — no database access in this directory. All numbers are
// computed from columns, never from inquiry_events (D4).
// Ratios return null on a zero denominator, never NaN/Infinity.

import type { Database } from '@/lib/supabase/database.types'
import { commissionPln, type CommissionRow, type FxRates } from './commission'
import {
  isoWeekKey,
  isoWeekKeyOfDate,
  monthKey,
  previousMonthKey,
  warsawDateString,
  type WeekRange,
} from './weeks'

type InquiryRow = Database['public']['Tables']['inquiries']['Row']

export const COMMISSION_TARGET_PLN = 80_000
const DAY_MS = 86_400_000

export type WeeklyInquiryRow = CommissionRow &
  Pick<
    InquiryRow,
    'created_at' | 'deposit_paid_at' | 'status' | 'gclid' | 'utm' | 'lost_reason_code' | 'updated_at'
  > & {
    /** Text column; anything other than 'yes' / 'no' is treated as unknown. */
    qualified: string | null
  }

export type WeeklyAdRow = { date: string; spend: number }

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

// ─── 1. Commission to date (M1) ──────────────────────────────────────────────

export type CommissionToDate = { pln: number; deals: number; targetPln: number }

export function commissionToDate(
  rows: readonly (CommissionRow & Pick<WeeklyInquiryRow, 'deposit_paid_at'>)[],
  rates: FxRates,
  since: string,
): CommissionToDate {
  const paid = rows.filter(
    r => r.deposit_paid_at !== null && warsawDateString(r.deposit_paid_at) >= since,
  )
  return { pln: commissionPln(paid, rates), deals: paid.length, targetPln: COMMISSION_TARGET_PLN }
}

// ─── 2. Bookings in month (M2) ───────────────────────────────────────────────

export type BookingsInMonth = {
  current: number
  previous: number
  currentKey: string
  previousKey: string
}

export function bookingsInMonth(
  rows: readonly Pick<WeeklyInquiryRow, 'deposit_paid_at'>[],
  now: Date,
): BookingsInMonth {
  const currentKey = monthKey(now)
  const previousKey = previousMonthKey(currentKey)
  let current = 0
  let previous = 0
  for (const r of rows) {
    if (r.deposit_paid_at === null) continue
    const key = monthKey(r.deposit_paid_at)
    if (key === currentKey) current++
    else if (key === previousKey) previous++
  }
  return { current, previous, currentKey, previousKey }
}

// ─── 3. Inquiries per week (M5 numerator) ────────────────────────────────────

export type InquiriesPerWeek = WeekRange & { count: number }

export function inquiriesPerWeek(
  rows: readonly Pick<WeeklyInquiryRow, 'created_at'>[],
  weeks: readonly WeekRange[],
): InquiriesPerWeek[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = isoWeekKey(r.created_at)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return weeks.map(w => ({ ...w, count: counts.get(w.key) ?? 0 }))
}

// ─── 4. Qualified per week (M5) ──────────────────────────────────────────────

export type QualifiedPerWeek = WeekRange & {
  yes: number
  no: number
  unknown: number
  total: number
}

export function qualifiedPerWeek(
  rows: readonly Pick<WeeklyInquiryRow, 'created_at' | 'qualified'>[],
  weeks: readonly WeekRange[],
): QualifiedPerWeek[] {
  const buckets = new Map<string, { yes: number; no: number; unknown: number }>()
  for (const r of rows) {
    const key = isoWeekKey(r.created_at)
    const bucket = buckets.get(key) ?? { yes: 0, no: 0, unknown: 0 }
    if (r.qualified === 'yes') bucket.yes++
    else if (r.qualified === 'no') bucket.no++
    else bucket.unknown++
    buckets.set(key, bucket)
  }
  return weeks.map(w => {
    const b = buckets.get(w.key) ?? { yes: 0, no: 0, unknown: 0 }
    return { ...w, ...b, total: b.yes + b.no + b.unknown }
  })
}

// ─── 5. Ad spend per week (M6 numerator) ─────────────────────────────────────

export type AdSpendPerWeek = WeekRange & { spendPln: number }

export function adSpendPerWeek(
  adRows: readonly WeeklyAdRow[],
  weeks: readonly WeekRange[],
): AdSpendPerWeek[] {
  const sums = new Map<string, number>()
  for (const r of adRows) {
    const spend = Number(r.spend)
    if (!Number.isFinite(spend)) continue
    // ad_campaigns.date is a plain date column — bucket it without timezone shifting.
    const key = isoWeekKeyOfDate(r.date)
    sums.set(key, (sums.get(key) ?? 0) + spend)
  }
  // Decision T1: ad_campaigns.spend IS PLN (Google Ads account currency).
  // Value is taken straight from the column — NO currency conversion here.
  return weeks.map(w => ({ ...w, spendPln: sums.get(w.key) ?? 0 }))
}

/** Latest `date` in the ad rows ('YYYY-MM-DD'), or null when there are none. */
export function lastAdDate(adRows: readonly WeeklyAdRow[]): string | null {
  let max: string | null = null
  for (const r of adRows) {
    if (max === null || r.date > max) max = r.date
  }
  return max
}

// ─── 6. Cost per inquiry / per qualified (M6) ────────────────────────────────

/** Paid attribution: a gclid, or utm_medium 'cpc' / 'paid' (case-insensitive, trimmed). */
export function isPaidAttributed(row: Pick<WeeklyInquiryRow, 'gclid' | 'utm'>): boolean {
  if (typeof row.gclid === 'string' && row.gclid.trim() !== '') return true
  const utm = row.utm
  if (typeof utm !== 'object' || utm === null || Array.isArray(utm)) return false
  const medium = utm['utm_medium']
  if (typeof medium !== 'string') return false
  const normalised = medium.trim().toLowerCase()
  return normalised === 'cpc' || normalised === 'paid'
}

type CostBlock = {
  inquiries: number
  qualified: number
  perInquiry: number | null
  perQualified: number | null
}

export type CostPerWeek = WeekRange & {
  spendPln: number
  attributed: CostBlock
  all: CostBlock
}

export function costPerWeek(
  rows: readonly Pick<WeeklyInquiryRow, 'created_at' | 'qualified' | 'gclid' | 'utm'>[],
  adRows: readonly WeeklyAdRow[],
  weeks: readonly WeekRange[],
): CostPerWeek[] {
  const counts = new Map<string, { attr: [number, number]; all: [number, number] }>()
  for (const r of rows) {
    const key = isoWeekKey(r.created_at)
    const entry = counts.get(key) ?? { attr: [0, 0], all: [0, 0] }
    const isQualified = r.qualified === 'yes' ? 1 : 0
    entry.all[0]++
    entry.all[1] += isQualified
    if (isPaidAttributed(r)) {
      entry.attr[0]++
      entry.attr[1] += isQualified
    }
    counts.set(key, entry)
  }
  const spend = adSpendPerWeek(adRows, weeks)
  return weeks.map((w, i) => {
    const spendPln = spend[i]?.spendPln ?? 0
    const c = counts.get(w.key) ?? { attr: [0, 0], all: [0, 0] }
    const block = ([inquiries, qualified]: [number, number]): CostBlock => ({
      inquiries,
      qualified,
      perInquiry: ratio(spendPln, inquiries),
      perQualified: ratio(spendPln, qualified),
    })
    return { ...w, spendPln, attributed: block(c.attr), all: block(c.all) }
  })
}

// ─── 7. Cumulative conversion (M7 approximation) ─────────────────────────────

export type CumulativeConversion = { inquiries: number; booked: number; rate: number | null }

export function cumulativeConversion(
  rows: readonly Pick<WeeklyInquiryRow, 'created_at' | 'deposit_paid_at'>[],
  since: string,
): CumulativeConversion {
  let inquiries = 0
  let booked = 0
  for (const r of rows) {
    if (warsawDateString(r.created_at) < since) continue
    inquiries++
    if (r.deposit_paid_at !== null) booked++
  }
  return { inquiries, booked, rate: ratio(booked, inquiries) }
}

// ─── 8. Lost reasons ─────────────────────────────────────────────────────────

export type LostReason = { code: string | null; count: number }

export function lostReasons(
  rows: readonly Pick<WeeklyInquiryRow, 'status' | 'lost_reason_code' | 'updated_at'>[],
  now: Date,
  days = 90,
): LostReason[] {
  // Proxy: there is no `lost_at` column, so `updated_at` stands in for "when it was lost".
  // A lost inquiry edited later drifts into the window; stage 5 reads the event log instead.
  const cutoff = now.getTime() - days * DAY_MS
  const counts = new Map<string | null, number>()
  for (const r of rows) {
    if (r.status !== 'lost') continue
    if (!(Date.parse(r.updated_at) >= cutoff)) continue
    counts.set(r.lost_reason_code, (counts.get(r.lost_reason_code) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (a.code === b.code) return 0
      if (a.code === null) return 1
      if (b.code === null) return -1
      return a.code < b.code ? -1 : 1
    })
}
