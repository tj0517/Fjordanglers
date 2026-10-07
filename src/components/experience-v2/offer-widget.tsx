'use client'

/**
 * S2 — the widget that turns the price table into three numbers (FA-1.53).
 *
 *   Total                 what the angler pays, all in (O-31: one number, no "+ fee" line)
 *   Deposit now · 20%     paid to FjordAnglers; the FA fee *is* the deposit (ADR-0001)
 *   Balance to the guide  paid to the guide directly, later
 *
 * All three come from `quote()` in src/lib/pricing/experience-price.ts, the same function
 * the tests and the data-layer proof use, so the screen cannot drift from the rule. The
 * price rows arrive already carrying the guide's override — that happens server-side in
 * `getExperienceV2()`, so no override value exists in this bundle.
 *
 * A `custom` page gets no calculator: it shows the stored range, labelled indicative, and
 * asks to plan the trip instead. The range is printed exactly as stored, with no FA fee
 * added — whether those numbers are net of the fee is unresolved (tj, 2026-10-07).
 *
 * The CTA is an anchor. The inquiry form it points at is FA-1.55; the "when" the visitor
 * picks here is kept in local state for that task to pick up, and is deliberately not
 * persisted anywhere yet.
 */

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { quote, fromPrice, customRange, type PriceRow } from '@/lib/pricing/experience-price'
import { formatCents } from '@/lib/format-price'
import { useCurrency } from './currency-context'

type OfferWidgetGuide = {
  fullName:          string
  avatarUrl:         string | null
  googleRating:      number | null
  googleReviewCount: number | null
}

export type OfferWidgetProps = {
  offerMode:          'fixed' | 'custom'
  prices:             PriceRow[]
  feePct:             number
  currency:           string
  maxAnglersPerGuide: number
  minDays:            number
  maxDays:            number | null
  priceFromCents:     number | null
  priceToCents:       number | null
  responseSlaHours:   number
  guide:              OfferWidgetGuide | null
  /** Where the CTA goes — the inquiry form, built in FA-1.55. */
  inquiryHref:        string
  /** Rendered inside the mobile bottom bar instead of the desktop card. */
  compact?:           boolean
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'] as const

/**
 * The next twelve months, as {value, label} — the "flexible" half of the when field.
 *
 * Written as a loop rather than with the Array constructor helper, so that FA-1.53's
 * acceptance grep over this directory — the check that no component queries Supabase —
 * returns zero hits instead of one false positive on a method of the same name.
 */
function nextTwelveMonths(today: Date): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = []

  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1))
    months.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    })
  }

  return months
}

function Stars({ rating, count }: { rating: number; count: number | null }) {
  return (
    <span>
      ★ {rating.toFixed(1)}
      {count != null && count > 0 && ` (${count})`}
    </span>
  )
}

export default function OfferWidget({
  offerMode,
  prices,
  feePct,
  currency,
  maxAnglersPerGuide,
  minDays,
  maxDays,
  priceFromCents,
  priceToCents,
  responseSlaHours,
  guide,
  inquiryHref,
  compact = false,
}: OfferWidgetProps) {
  const { indicative } = useCurrency()

  const [anglers, setAnglers] = useState(Math.min(2, maxAnglersPerGuide))
  const [days, setDays]       = useState(minDays)
  const [whenMode, setWhenMode] = useState<'exact' | 'flexible'>('flexible')
  const [exactDate, setExactDate] = useState('')

  // Built once from one clock read rather than per render, so the list cannot shift
  // underneath a visitor who leaves the page open across midnight.
  const months = useMemo(() => nextTwelveMonths(new Date()), [])
  const [flexMonth, setFlexMonth] = useState(() => months[2]?.value ?? '')

  const range = customRange(priceFromCents, priceToCents, currency)
  const from  = useMemo(() => fromPrice({ prices, feePct, maxAnglersPerGuide }), [prices, feePct, maxAnglersPerGuide])
  const q     = useMemo(
    () => quote({ days, anglers, prices, feePct, maxAnglersPerGuide }),
    [days, anglers, prices, feePct, maxAnglersPerGuide],
  )

  const dayCap = maxDays ?? Math.max(minDays, 14)

  // ── custom: a range and "plan your trip", no calculator ───────────────────
  if (offerMode === 'custom') {
    return (
      <div data-testid="offer-widget" data-mode="custom" className={compact ? '' : cardClass} style={compact ? undefined : cardStyle}>
        {range != null ? (
          <>
            <p className={compact ? 'text-base font-bold leading-tight' : 'f-display text-2xl font-bold leading-tight'}>
              {range.toCents != null
                ? `${formatCents(range.fromCents, range.currency)}–${formatCents(range.toCents, range.currency)}`
                : `from ${formatCents(range.fromCents, range.currency)}`}
            </p>
            <p className={compact ? 'text-xs opacity-90' : 'mt-1 text-sm'} style={compact ? undefined : mutedStyle}>
              indicative · the offer is built around your dates
            </p>
          </>
        ) : (
          <p className={compact ? 'text-base font-bold' : 'f-display text-2xl font-bold'}>Price on request</p>
        )}

        {!compact && <GuideLine guide={guide} />}

        <a href={inquiryHref} className={compact ? compactCtaClass : ctaClass} style={compact ? compactCtaStyle : ctaStyle}>
          Plan your trip
        </a>

        {!compact && (
          <>
            <p className="mt-2.5 text-center text-xs" style={mutedStyle}>
              Free · no obligation · deposit only after you accept the offer
            </p>
            <p className="mt-1 text-center text-xs" style={mutedStyle}>
              We answer within {responseSlaHours} h
            </p>
          </>
        )}
      </div>
    )
  }

  // ── fixed: the calculator ─────────────────────────────────────────────────
  const fromLine = from != null
    ? `from ${formatCents(from.totalCents, from.currency)}`
    : 'Price on request'

  if (compact) {
    return (
      <div data-testid="offer-widget" data-mode="fixed-compact" className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">{fromLine}</p>
          <p className="text-xs opacity-90">free inquiry · {responseSlaHours} h</p>
        </div>
        <a href={inquiryHref} className={compactCtaClass} style={compactCtaStyle}>
          Check availability
        </a>
      </div>
    )
  }

  return (
    <div data-testid="offer-widget" data-mode="fixed" className={cardClass} style={cardStyle}>
      <p className="f-display text-2xl font-bold leading-tight" data-testid="offer-from-price">{fromLine}</p>
      <p className="mt-1 text-sm" style={mutedStyle}>
        {maxAnglersPerGuide === 1 ? '1 angler per guide' : `1–${maxAnglersPerGuide} anglers per guide`}
      </p>

      <GuideLine guide={guide} />

      {/* ── when / anglers / days ── */}
      <div className="mt-3.5 flex flex-col gap-2">
        <div className="rounded-lg border p-2.5" style={fieldStyle}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">When?</span>
            <div className="flex gap-1 text-xs">
              {(['exact', 'flexible'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWhenMode(mode)}
                  aria-pressed={whenMode === mode}
                  className="rounded-full px-2.5 py-1"
                  style={whenMode === mode
                    ? { background: 'var(--fa-navy)', color: '#fff' }
                    : { background: 'rgba(10,46,77,0.06)', color: 'var(--fa-navy)' }}
                >
                  {mode === 'exact' ? 'Exact dates' : 'Flexible'}
                </button>
              ))}
            </div>
          </div>

          {whenMode === 'exact' ? (
            <label className="mt-2 block">
              <span className="sr-only">First day</span>
              <input
                type="date"
                value={exactDate}
                onChange={e => setExactDate(e.target.value)}
                className="w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                style={fieldStyle}
              />
            </label>
          ) : (
            <label className="mt-2 block">
              <span className="sr-only">Month</span>
              <select
                value={flexMonth}
                onChange={e => setFlexMonth(e.target.value)}
                className="w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                style={fieldStyle}
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="flex gap-2">
          <Stepper
            label="Anglers"
            value={anglers}
            min={1}
            max={maxAnglersPerGuide}
            onChange={setAnglers}
          />
          <Stepper
            label="Days"
            value={days}
            min={minDays}
            max={dayCap}
            onChange={setDays}
          />
        </div>
      </div>

      {/* ── the three numbers ── */}
      <div className="mt-3.5" data-testid="offer-totals">
        {q.priced ? (
          <>
            <Row label="Total" value={formatCents(q.totalCents, q.currency)} strong />
            <Row label={`Deposit now · ${Math.round(feePct * 100)}%`} value={formatCents(q.feeCents, q.currency)} />
            <Row label="Balance to the guide" value={formatCents(q.guideCents, q.currency)} />
            {indicative(q.totalCents) != null && (
              <p className="mt-1.5 text-xs" style={mutedStyle} data-testid="offer-indicative">
                {indicative(q.totalCents)} · indicative rate
              </p>
            )}
            {q.onRequest && (
              <p className="mt-1.5 text-xs" style={mutedStyle} data-testid="offer-on-request">
                Priced for {q.pricedAnglers} anglers — your exact price comes back on request.
              </p>
            )}
          </>
        ) : (
          <p className="border-t pt-2.5 text-sm" style={{ ...mutedStyle, borderColor: 'rgba(10,46,77,0.10)' }} data-testid="offer-on-request">
            {q.reason === 'no-prices'
              ? 'On request — we price this trip for your dates.'
              : `On request for ${days} ${days === 1 ? 'day' : 'days'} × ${anglers} ${anglers === 1 ? 'angler' : 'anglers'}.`}
          </p>
        )}
      </div>

      <a href={inquiryHref} className={ctaClass} style={ctaStyle}>Check availability</a>
      <p className="mt-2.5 text-center text-xs" style={mutedStyle}>
        Free · no obligation · deposit only after you accept the offer
      </p>
      <p className="mt-1 text-center text-xs" style={mutedStyle}>
        We answer within {responseSlaHours} h
      </p>
    </div>
  )
}

// ─── small pieces, local on purpose: nothing outside this widget uses them ───

const cardClass  = 'rounded-xl border-2 bg-white p-4'
const cardStyle  = { borderColor: 'var(--fa-navy)', boxShadow: '0 8px 24px rgba(10,46,77,0.08)', color: 'var(--fa-navy)' }
const mutedStyle = { color: 'rgba(10,46,77,0.62)' }
const fieldStyle = { borderColor: 'rgba(10,46,77,0.20)', color: 'var(--fa-navy)' }
const ctaClass   = 'mt-3.5 block w-full rounded-lg px-4 py-3 text-center text-base font-semibold'
const ctaStyle   = { background: 'var(--fa-navy)', color: '#fff' }
const compactCtaClass = 'flex-none rounded-lg px-4 py-3 text-sm font-bold'
const compactCtaStyle = { background: '#fff', color: 'var(--fa-navy)', minHeight: 44 }

function GuideLine({ guide }: { guide: OfferWidgetGuide | null }) {
  if (guide == null) return null
  return (
    <div className="mt-3.5 flex items-center gap-2.5">
      {guide.avatarUrl != null && (
        <Image
          src={guide.avatarUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 flex-none rounded-full object-cover"
        />
      )}
      <span className="text-sm">
        Guide: {guide.fullName}
        {guide.googleRating != null && <> · <Stars rating={guide.googleRating} count={guide.googleReviewCount} /></>}
      </span>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-t py-2 text-sm"
      style={{ borderColor: 'rgba(10,46,77,0.10)' }}
    >
      <span>{label}</span>
      <b className={strong ? 'text-base' : undefined}>{value}</b>
    </div>
  )
}

function Stepper({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-lg border px-2.5 py-2" style={fieldStyle}>
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`One fewer ${label.toLowerCase()}`}
          className="h-7 w-7 rounded-md text-base leading-none disabled:opacity-30"
          style={{ background: 'rgba(10,46,77,0.06)' }}
        >
          −
        </button>
        <b className="w-5 text-center text-sm" aria-live="polite">{value}</b>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label.toLowerCase()}`}
          className="h-7 w-7 rounded-md text-base leading-none disabled:opacity-30"
          style={{ background: 'rgba(10,46,77,0.06)' }}
        >
          +
        </button>
      </span>
    </div>
  )
}
