// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
//
// Read-only data for /admin/weekly (FA-1.10). Rows come out raw; every number is computed
// by the pure functions in src/lib/metrics/. Lives here because pages never call
// `.from()` themselves (CLAUDE.md rule 3).
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { parseFxRates, type FxRates } from '@/lib/metrics/commission'
import type { WeeklyAdRow, WeeklyInquiryRow } from '@/lib/metrics/weekly'

export interface WeeklyReviewData {
  inquiries: WeeklyInquiryRow[]
  /** ad_campaigns rows from `adSince` on (spend is PLN — decision T1). */
  adRows: WeeklyAdRow[]
  /** Newest `ad_campaigns.date` in the whole table, or null when it is empty. */
  lastAdDate: string | null
  rates: FxRates
}

/**
 * @param since   'YYYY-MM-DD' — inquiries created on or after this date (year start).
 * @param adSince 'YYYY-MM-DD' — ad rows on or after this date (start of the oldest shown week).
 *
 * Note: PostgREST returns at most `max_rows` (1000 by default) per query. The inquiries
 * table holds ~100 rows today; revisit this before it gets near that.
 */
export async function getWeeklyReviewData(since: string, adSince: string): Promise<WeeklyReviewData> {
  await requireAdmin()
  const supabase = createServiceClient()

  const [inquiries, ads, lastAd, settings] = await Promise.all([
    supabase
      .from('inquiries')
      .select(
        'created_at, updated_at, deposit_paid_at, status, qualified, gclid, utm, lost_reason_code, offer_deposit_eur, deposit_amount, internal_commission_eur, deal_currency',
      )
      .gte('created_at', since),
    supabase.from('ad_campaigns').select('date, spend').gte('date', adSince),
    supabase.from('ad_campaigns').select('date').order('date', { ascending: false }).limit(1),
    supabase.from('finance_settings').select('key, value'),
  ])

  // A failed read must not look like an empty database.
  for (const { error } of [inquiries, ads, lastAd, settings]) {
    if (error != null) throw new Error(`getWeeklyReviewData: ${error.message}`)
  }

  return {
    inquiries: inquiries.data ?? [],
    adRows: (ads.data ?? []).map(r => ({ date: r.date, spend: Number(r.spend) })),
    lastAdDate: lastAd.data?.[0]?.date ?? null,
    rates: parseFxRates(settings.data ?? []),
  }
}
