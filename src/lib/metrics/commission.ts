// PERMANENT shared helper (not deleted with the weekly review): /admin/finances and
// /admin/weekly must show the same commission number, so both call this.
//
// The FORMULA is legacy. Stage 4 replaces it with `deals.commission_cents` at an FX
// rate frozen at the moment of the event (CLAUDE.md rule 6). Until then this helper
// reproduces today's /admin/finances number exactly:
//   amt    = offer_deposit_eur ?? deposit_amount ?? internal_commission_eur ?? 0
//   amtEur = deal_currency === 'USD' ? amt * usd_eur_rate : amt
//   PLN    = sum(amtEur) * eur_pln_rate
//
// Rule 6 (integer cents) is deliberately NOT applied here: the source columns are
// legacy NUMERIC EUR, and converting to cents would change the last bits of the
// number /admin/finances displays today. `??` (not `||`) is intentional — an explicit
// 0 in offer_deposit_eur wins over later fields.

export type FxRates = { eurPln: number; usdEur: number }

export const DEFAULT_FX_RATES: FxRates = { eurPln: 4.25, usdEur: 0.92 }

export type CommissionRow = {
  offer_deposit_eur: number | null
  deposit_amount: number | null
  internal_commission_eur: number | null
  deal_currency: string | null
  // FA-1.28: new fields — null on rows created before the migration
  deposit_amount_cents: number | null
  deposit_currency: string | null
  deposit_eur_rate: number | null
}

function parseRate(settings: { key: string; value: string }[], key: string, fallback: number): number {
  const raw = settings.find(s => s.key === key)?.value
  if (raw === undefined) return fallback
  const parsed = parseFloat(raw)
  return Number.isNaN(parsed) ? fallback : parsed
}

/** Reads `eur_pln_rate` / `usd_eur_rate` from finance_settings rows; defaults 4.25 / 0.92. */
export function parseFxRates(settings: { key: string; value: string }[]): FxRates {
  return {
    eurPln: parseRate(settings, 'eur_pln_rate', DEFAULT_FX_RATES.eurPln),
    usdEur: parseRate(settings, 'usd_eur_rate', DEFAULT_FX_RATES.usdEur),
  }
}

/** Commission of one row in EUR. New rows use the frozen deposit_eur_rate; legacy rows use usdEur. */
export function rowCommissionEur(row: CommissionRow, usdEur: number): number {
  if (row.deposit_amount_cents != null && row.deposit_eur_rate != null) {
    return row.deposit_amount_cents / row.deposit_eur_rate / 100
  }
  const amt = Number(row.offer_deposit_eur ?? row.deposit_amount ?? row.internal_commission_eur ?? 0)
  return row.deal_currency === 'USD' ? amt * usdEur : amt
}

/** Plain left-to-right sum of row commissions in EUR. */
export function commissionEur(rows: readonly CommissionRow[], usdEur: number): number {
  let total = 0
  for (const row of rows) total += rowCommissionEur(row, usdEur)
  return total
}

/** Commission in PLN: sum in EUR, then one multiplication by the EUR/PLN rate. */
export function commissionPln(rows: readonly CommissionRow[], rates: FxRates): number {
  return commissionEur(rows, rates.usdEur) * rates.eurPln
}
