import { rowCommissionEur, type CommissionRow } from '@/lib/metrics/commission'
import { bookedMonthWarsaw, type BookingRow } from '@/lib/metrics/facts'

export type RevenueRow = CommissionRow & BookingRow

export type MonthRevenue = { eur: number; deals: number }

/**
 * Revenue by month, keyed 'YYYY-MM' in Europe/Warsaw. A row's month comes only from
 * `deposit_paid_at` (CLAUDE.md rule 7) — a row without it is not a booking and does
 * not appear. Same month definition as /admin/weekly (bookedMonthWarsaw).
 */
export function revenueByMonth(
  rows: readonly RevenueRow[],
  usdEurRate: number,
): Record<string, MonthRevenue> {
  const byMonth: Record<string, MonthRevenue> = {}
  for (const row of rows) {
    const month = bookedMonthWarsaw(row)
    if (month == null) continue
    const amtEur = rowCommissionEur(row, usdEurRate)
    byMonth[month] = {
      eur:   (byMonth[month]?.eur   ?? 0) + amtEur,
      deals: (byMonth[month]?.deals ?? 0) + 1,
    }
  }
  return byMonth
}
