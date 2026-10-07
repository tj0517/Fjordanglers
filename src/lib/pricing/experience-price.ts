/**
 * Pricing of a v2 offer page — pure, no I/O, no React (FA-1.53).
 *
 * The angler sees ONE number: the total (O-31, resolved 2026-10-05). The database stores
 * the guide's price and the FA fee percentage separately and never the total
 * (`experience_prices.guide_price_cents`, `experience_pages.fee_pct`), so the total is
 * computed here, in one place, for the widget, the "from" price and anything later.
 *
 * The three lines of the widget are, in the words the page uses:
 *   Total                 = guideCents + feeCents
 *   Deposit now (20%)     = feeCents   — the FA fee *is* the deposit (ADR-0001)
 *   Balance to the guide  = guideCents
 *
 * Which is why `feeCents + guideCents === totalCents` has to hold to the cent, always:
 * the three numbers are shown together and a reader adds them up. It holds by
 * construction — the total is the sum, never a second rounding of the same product.
 *
 * Money is integer minor units plus a currency, never a float (CLAUDE.md rule 6).
 */

/** One current row of a fixed-mode page's price table: the guide's price, FA fee excluded. */
export interface PriceRow {
  days:            number
  anglers:         number
  guidePriceCents: number
  currency:        string
}

export interface Money {
  /** What the guide is paid — the "balance to the guide" line. */
  guideCents: number
  /** The FA fee, which is also the deposit taken now. */
  feeCents:   number
  /** What the angler pays in total. Always exactly guideCents + feeCents. */
  totalCents: number
  currency:   string
}

/** Why a page or a (days, anglers) combination shows no number at all. */
export type UnpricedReason =
  /** The page has no current price rows (a `custom` page, or a `fixed` one nobody priced yet). */
  | 'no-prices'
  /** Rows exist, but none for the requested number of days. */
  | 'no-days-row'
  /** Rows exist for those days, but none for this many anglers or more. */
  | 'no-anglers-row'
  /** Rows disagree about the currency — a data error we refuse to guess around. */
  | 'mixed-currency'

export type Quote =
  | (Money & {
      priced: true
      /**
       * true when the row used is not the row asked for — the price covers more anglers
       * than requested, so it is an upper bound, labelled "on request" in the UI.
       */
      onRequest:     boolean
      /** The anglers count of the row actually used. */
      pricedAnglers: number
    })
  | { priced: false; onRequest: true; reason: UnpricedReason }

export interface QuoteParams {
  days:    number
  anglers: number
  /** Current rows only — validity by `valid_from`/`valid_to` is filtered in the data layer. */
  prices:  readonly PriceRow[]
  /** `experience_pages.fee_pct`, e.g. 0.2 for 20%. numeric(5,4), so four decimals. */
  feePct:  number
  /** `experience_pages.max_anglers_per_guide` — identifies the base row for an override. */
  maxAnglersPerGuide: number
  /**
   * `experience_guides.guide_price_override_cents` of the guide being shown. Replaces ONLY
   * the base row (days = 1, anglers = max_anglers_per_guide); every other row keeps its
   * price from `experience_prices` (tj, 2026-10-07). The database caps it at 115% of that
   * base row (O-32) and rejects it when the base row is missing, so this code does not
   * re-check the cap — it would be checking the same rule in a second, weaker place.
   */
  overrideCents?: number | null
}

/**
 * `fee_pct` is `numeric(5,4)`, so it carries at most four decimals. Going through basis
 * points keeps the multiplication in integers and out of reach of binary-float drift
 * (0.2 is not representable in IEEE-754; 2000 bp is).
 */
function feeCentsFor(guideCents: number, feePct: number): number {
  const feeBp = Math.round(feePct * 10_000)
  return Math.round((guideCents * feeBp) / 10_000)
}

/**
 * The three numbers of one quote. The total is the SUM, deliberately — rounding the
 * product a second time is how `fee + guide ≠ total` gets into a price widget.
 */
export function money(guideCents: number, feePct: number, currency: string): Money {
  const feeCents = feeCentsFor(guideCents, feePct)
  return { guideCents, feeCents, totalCents: guideCents + feeCents, currency }
}

/**
 * The rows as this guide prices them: the base row (days = 1, anglers = max per guide)
 * replaced by the override, everything else untouched.
 *
 * An override with no base row to replace is returned unchanged rather than applied
 * anywhere else — the trigger `experience_guides_check_override` rejects that write, so
 * reaching here means the data moved under us, and inventing a row is worse than ignoring it.
 */
export function effectivePrices(
  prices: readonly PriceRow[],
  { maxAnglersPerGuide, overrideCents }: Pick<QuoteParams, 'maxAnglersPerGuide' | 'overrideCents'>,
): PriceRow[] {
  if (overrideCents == null) return [...prices]

  return prices.map(row =>
    row.days === 1 && row.anglers === maxAnglersPerGuide
      ? { ...row, guidePriceCents: overrideCents }
      : row,
  )
}

function singleCurrency(prices: readonly PriceRow[]): string | null {
  const first = prices[0]
  if (first == null) return null
  return prices.every(r => r.currency === first.currency) ? first.currency : null
}

/**
 * The quote for one (days, anglers) request.
 *
 * Row lookup (tj, 2026-10-07): the requested `days` exactly — no falling back to a
 * different trip length — and for anglers the nearest row that covers **equal or more**
 * anglers than asked. A quote must never come out below the real price, so we never fall
 * back to a row for fewer anglers; when no row covers the group, the page shows no number
 * at all. A row for more anglers than asked is shown as an upper bound (`onRequest`).
 */
export function quote({
  days,
  anglers,
  prices,
  feePct,
  maxAnglersPerGuide,
  overrideCents,
}: QuoteParams): Quote {
  if (prices.length === 0) return { priced: false, onRequest: true, reason: 'no-prices' }

  const currency = singleCurrency(prices)
  if (currency == null) return { priced: false, onRequest: true, reason: 'mixed-currency' }

  const rows = effectivePrices(prices, { maxAnglersPerGuide, overrideCents })

  const sameDays = rows.filter(r => r.days === days)
  if (sameDays.length === 0) return { priced: false, onRequest: true, reason: 'no-days-row' }

  const covering = sameDays.filter(r => r.anglers >= anglers)
  if (covering.length === 0) return { priced: false, onRequest: true, reason: 'no-anglers-row' }

  const row = covering.reduce((best, r) => (r.anglers < best.anglers ? r : best))

  return {
    priced:        true,
    onRequest:     row.anglers !== anglers,
    pricedAnglers: row.anglers,
    ...money(row.guidePriceCents, feePct, row.currency),
  }
}

/**
 * The "from" price above the fold: the lowest total any current row produces, with the
 * override applied the same way the calculator applies it. Null when the page has no
 * usable rows — the page then says "on request" instead of showing a number.
 */
export function fromPrice({
  prices,
  feePct,
  maxAnglersPerGuide,
  overrideCents,
}: Omit<QuoteParams, 'days' | 'anglers'>): Money | null {
  if (prices.length === 0) return null
  if (singleCurrency(prices) == null) return null

  const rows = effectivePrices(prices, { maxAnglersPerGuide, overrideCents })

  return rows
    .map(r => money(r.guidePriceCents, feePct, r.currency))
    .reduce<Money | null>((best, m) => (best == null || m.totalCents < best.totalCents ? m : best), null)
}

/** The indicative range of a `custom` page. */
export interface CustomRange {
  fromCents: number
  /** Null when only a lower bound is stored — the page shows "from X" without an upper end. */
  toCents:   number | null
  currency:  string
}

/**
 * The range of a `custom` page, exactly as stored — the FA fee is deliberately NOT added
 * (tj, 2026-10-07): whether `price_from_cents` is net of the fee, and per person or flat,
 * is unresolved (docs/deferred-tasks.md, FA-1.50), so adding 20% would be inventing a
 * number. The page labels it indicative. Null when there is no lower bound to show.
 */
export function customRange(
  priceFromCents: number | null,
  priceToCents: number | null,
  currency: string,
): CustomRange | null {
  if (priceFromCents == null) return null
  const toCents = priceToCents != null && priceToCents > priceFromCents ? priceToCents : null
  return { fromCents: priceFromCents, toCents, currency }
}
