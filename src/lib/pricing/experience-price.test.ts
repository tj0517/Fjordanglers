import { describe, it, expect } from 'vitest'
import {
  quote,
  fromPrice,
  money,
  effectivePrices,
  customRange,
  type PriceRow,
} from './experience-price'

/**
 * The NZ seed page (`seed-backcountry-day-nz`), verbatim from supabase/seed.sql — the
 * numbers the Playwright screenshots show, so a failure here names a real screen.
 * fee_pct = 0.20.
 */
const NZ: PriceRow[] = [
  { days: 1, anglers: 1, guidePriceCents:  90000, currency: 'NZD' },
  { days: 1, anglers: 2, guidePriceCents: 125000, currency: 'NZD' },
  { days: 2, anglers: 2, guidePriceCents: 240000, currency: 'NZD' },
]
const FEE = 0.2
const MAX_ANGLERS = 2

describe('quote — (a) the total is the price table × 1.20', () => {
  it('1 day × 2 anglers → guide 1 250.00, deposit 250.00, total 1 500.00 NZD', () => {
    const q = quote({ days: 1, anglers: 2, prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(true)
    if (!q.priced) return
    expect(q.guideCents).toBe(125_000)
    expect(q.feeCents).toBe(25_000)
    expect(q.totalCents).toBe(150_000)
    expect(q.currency).toBe('NZD')
    expect(q.onRequest).toBe(false)
  })

  it('2 days × 2 anglers → total 2 880.00 NZD, the deposit is exactly the fee', () => {
    const q = quote({ days: 2, anglers: 2, prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(true)
    if (!q.priced) return
    expect(q.totalCents).toBe(288_000)
    expect(q.feeCents).toBe(48_000)
    expect(q.guideCents).toBe(240_000)
  })
})

describe('quote — (b) the row lookup never quotes below the real price', () => {
  // tj, 2026-10-07: same `days`, then the nearest anglers count EQUAL OR HIGHER.
  const SPARSE: PriceRow[] = [
    { days: 1, anglers: 1, guidePriceCents:  90000, currency: 'NZD' },
    { days: 1, anglers: 3, guidePriceCents: 180000, currency: 'NZD' },
  ]

  it('(b1) asks for 2, rows are 1 and 3 → the 3-anglers row, flagged on request', () => {
    const q = quote({ days: 1, anglers: 2, prices: SPARSE, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(true)
    if (!q.priced) return
    expect(q.pricedAnglers).toBe(3)
    expect(q.guideCents).toBe(180_000)
    expect(q.totalCents).toBe(216_000)
    expect(q.onRequest).toBe(true)
  })

  it('(b1) is not the cheaper neighbour — the 1-angler row is never the answer for 2', () => {
    const q = quote({ days: 1, anglers: 2, prices: SPARSE, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(true)
    if (!q.priced) return
    expect(q.guideCents).not.toBe(90_000)
  })

  it('(b2) asks for 3, rows are 1 and 2 → no number at all, on request', () => {
    const q = quote({ days: 1, anglers: 3, prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(false)
    expect(q.onRequest).toBe(true)
    if (q.priced) return
    expect(q.reason).toBe('no-anglers-row')
  })

  it('no row for the requested days → no number, and no falling back to another length', () => {
    const q = quote({ days: 5, anglers: 2, prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(false)
    if (q.priced) return
    expect(q.reason).toBe('no-days-row')
  })

  it('an empty price table → no number (the custom page, and a fixed page nobody priced)', () => {
    const q = quote({ days: 1, anglers: 2, prices: [], feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(false)
    if (q.priced) return
    expect(q.reason).toBe('no-prices')
  })

  it('rows that disagree about the currency → no number, not a guess', () => {
    const mixed: PriceRow[] = [
      { days: 1, anglers: 2, guidePriceCents: 125_000, currency: 'NZD' },
      { days: 2, anglers: 2, guidePriceCents: 240_000, currency: 'EUR' },
    ]
    const q = quote({ days: 1, anglers: 2, prices: mixed, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(q.priced).toBe(false)
    if (q.priced) return
    expect(q.reason).toBe('mixed-currency')
  })
})

describe('quote — (c) the override replaces the base row and nothing else', () => {
  // The base row is (days 1, anglers = max_anglers_per_guide = 2): 125 000.
  // 110% of it = 137 500, inside the 115% the database allows (O-32).
  const OVERRIDE = 137_500

  it('the base row is quoted from the override', () => {
    const q = quote({
      days: 1, anglers: 2, prices: NZ, feePct: FEE,
      maxAnglersPerGuide: MAX_ANGLERS, overrideCents: OVERRIDE,
    })

    expect(q.priced).toBe(true)
    if (!q.priced) return
    expect(q.guideCents).toBe(137_500)
    expect(q.feeCents).toBe(27_500)
    expect(q.totalCents).toBe(165_000)
  })

  it('every other row keeps its price from experience_prices', () => {
    const twoDays = quote({
      days: 2, anglers: 2, prices: NZ, feePct: FEE,
      maxAnglersPerGuide: MAX_ANGLERS, overrideCents: OVERRIDE,
    })
    const oneAngler = quote({
      days: 1, anglers: 1, prices: NZ, feePct: FEE,
      maxAnglersPerGuide: MAX_ANGLERS, overrideCents: OVERRIDE,
    })

    expect(twoDays.priced && twoDays.guideCents).toBe(240_000)
    expect(oneAngler.priced && oneAngler.guideCents).toBe(90_000)
  })

  it('an override with no base row to replace changes nothing', () => {
    const noBase: PriceRow[] = [{ days: 2, anglers: 2, guidePriceCents: 240_000, currency: 'NZD' }]

    expect(effectivePrices(noBase, { maxAnglersPerGuide: 2, overrideCents: OVERRIDE })).toEqual(noBase)
  })

  it('the "from" price follows the override when the override is the cheapest row', () => {
    // Base row overridden DOWN to 50 000 — below the 1-angler row, so "from" has to move.
    const from = fromPrice({ prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS, overrideCents: 50_000 })

    expect(from?.totalCents).toBe(60_000)
  })
})

describe('quote — (d) a custom page shows the stored range, with no FA fee added', () => {
  it('the Iceland seed range comes back exactly as stored', () => {
    // seed: price_from_cents = 45 050, price_to_cents = 320 000, EUR.
    const range = customRange(45_050, 320_000, 'EUR')

    expect(range).toEqual({ fromCents: 45_050, toCents: 320_000, currency: 'EUR' })
  })

  it('no 20% is added anywhere — 45 050 does not become 54 060', () => {
    const range = customRange(45_050, 320_000, 'EUR')

    expect(range?.fromCents).toBe(45_050)
    expect(range?.fromCents).not.toBe(54_060)
    expect(range?.toCents).not.toBe(384_000)
  })

  it('an upper bound that is not above the lower one is dropped, not shown as a range', () => {
    expect(customRange(45_050, 45_050, 'EUR')?.toCents).toBeNull()
    expect(customRange(45_050, null, 'EUR')?.toCents).toBeNull()
  })

  it('no lower bound → nothing to show', () => {
    expect(customRange(null, 320_000, 'EUR')).toBeNull()
  })
})

describe('fromPrice — the "from" number above the fold', () => {
  it('is the lowest total any current row produces, not the lowest guide price blindly', () => {
    const from = fromPrice({ prices: NZ, feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })

    expect(from?.totalCents).toBe(108_000) // 1 day × 1 angler: 90 000 + 18 000
    expect(from?.currency).toBe('NZD')
  })

  it('is null when there is nothing to price', () => {
    expect(fromPrice({ prices: [], feePct: FEE, maxAnglersPerGuide: MAX_ANGLERS })).toBeNull()
  })
})

/**
 * Red proof of the invariant the widget depends on: the three lines it prints
 * (Total / Deposit now / Balance to the guide) must add up to the cent, because the
 * reader adds them up.
 *
 * Deterministic pseudo-random amounts (a seeded LCG, so a failure is reproducible),
 * covering non-round cents — the seed's own amounts are all round and would hide a
 * rounding bug. Shown failing against a rounding implementation in the PR description.
 */
describe('fee + guide = total, to the cent, at fee_pct = 0.20', () => {
  function lcg(seed: number): () => number {
    let s = seed
    return () => {
      s = (s * 1_103_515_245 + 12_345) % 2_147_483_648
      return s / 2_147_483_648
    }
  }

  const rand = lcg(20_261_007)
  const amounts = Array.from({ length: 20 }, () => 1 + Math.floor(rand() * 10_000_000))

  it.each(amounts)('guide %i cents', guideCents => {
    const m = money(guideCents, 0.2, 'NZD')

    expect(m.feeCents + m.guideCents).toBe(m.totalCents)
    // and the fee really is 20%, not a number that merely sums correctly
    expect(m.feeCents).toBe(Math.round(guideCents * 0.2))
  })

  it('holds for the seeded rows through quote(), not just money()', () => {
    for (const row of NZ) {
      const q = quote({
        days: row.days, anglers: row.anglers, prices: NZ,
        feePct: 0.2, maxAnglersPerGuide: MAX_ANGLERS,
      })
      expect(q.priced).toBe(true)
      if (!q.priced) continue
      expect(q.feeCents + q.guideCents).toBe(q.totalCents)
    }
  })
})
