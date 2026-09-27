// Read-only data for /admin/data-gaps (FA-1.36). The action reads, src/lib/metrics/gaps.ts
// computes (CLAUDE.md rule 3 — no `.from(` outside src/actions/* and the data layer).
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { parseFxRates } from '@/lib/metrics/commission'
import {
  hasBookingWithoutAmount,
  hasBookingWithoutDate,
  hasLossWithoutReason,
  hasOfferWithoutDate,
  hasQualifiedUnknown,
  hasReceivedDateGap,
} from '@/lib/metrics/gaps'

export type GapCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

interface DataGapRow {
  id:         string
  anglerName: string
  createdAt:  string
  status:     string
  categories: GapCategory[]
}

export interface DataGapsData {
  /** Count per category, A–F. */
  counts: Record<GapCategory, number>
  /** One row per inquiry that has at least one gap, newest first. */
  rows: DataGapRow[]
}

/**
 * @param since 'YYYY-MM-DD' — inquiries created on or after this date. Passed through so
 *   the counters can be scoped the same way /admin/weekly is; omit for "all time".
 */
export async function getDataGapsData(since?: string): Promise<DataGapsData> {
  await requireAdmin()
  const supabase = createServiceClient()

  let inquiryQuery = supabase
    .from('inquiries')
    .select(
      'id, angler_name, created_at, status, stage_reached, external_offer_sent, offer_sent_at, deposit_paid_at, lost_reason_code, qualified, offer_deposit_eur, deposit_amount, internal_commission_eur, deal_currency, deposit_amount_cents, deposit_currency, deposit_eur_rate',
    )
    .order('created_at', { ascending: false })
  if (since != null) inquiryQuery = inquiryQuery.gte('created_at', since)

  const [inquiries, messages, settings] = await Promise.all([
    inquiryQuery,
    supabase
      .from('messages')
      .select('inquiry_id, occurred_at')
      .neq('status', 'draft')
      .order('occurred_at', { ascending: true }),
    supabase.from('finance_settings').select('key, value'),
  ])

  for (const { error } of [inquiries, messages, settings]) {
    if (error != null) throw new Error(`getDataGapsData: ${error.message}`)
  }

  // First (earliest) non-draft message per inquiry — messages arrived ordered ascending,
  // so the first occurrence per inquiry_id wins.
  const firstMessageAt = new Map<string, string>()
  for (const m of messages.data ?? []) {
    if (!firstMessageAt.has(m.inquiry_id)) firstMessageAt.set(m.inquiry_id, m.occurred_at)
  }

  const { usdEur } = parseFxRates(settings.data ?? [])

  const counts: Record<GapCategory, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  const rows: DataGapRow[] = []

  for (const row of inquiries.data ?? []) {
    const categories: GapCategory[] = []

    if (hasBookingWithoutDate(row)) categories.push('A')
    if (hasBookingWithoutAmount(row, usdEur)) categories.push('B')
    if (hasOfferWithoutDate(row)) categories.push('C')
    if (hasLossWithoutReason(row)) categories.push('D')
    if (hasReceivedDateGap({ created_at: row.created_at, firstMessageOccurredAt: firstMessageAt.get(row.id) ?? null })) {
      categories.push('E')
    }
    if (hasQualifiedUnknown(row)) categories.push('F')

    for (const c of categories) counts[c]++

    if (categories.length > 0) {
      rows.push({
        id:         row.id,
        anglerName: row.angler_name,
        createdAt:  row.created_at,
        status:     row.status,
        categories,
      })
    }
  }

  return { counts, rows }
}
