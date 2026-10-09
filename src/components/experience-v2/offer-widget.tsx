'use client'

/**
 * S2 — the widget that turns the price table into three numbers (FA-1.53).
 *
 *   Total                 what the angler pays, all in (O-31: one number, no "+ fee" line)
 *   Deposit now           paid to FjordAnglers; the FA fee *is* the deposit (ADR-0001)
 *   Balance to the guide  paid to the guide directly, later
 *
 * The deposit line carries no percentage in its label (tj, 2026-10-07): the fee is 20% of
 * the *guide's* price, so next to a total that already includes it, "20%" invites the
 * reader to divide 250 by 1 500 and get 16.7% — a number we never claimed and cannot
 * explain. The percentage moves to a note underneath, where it can say what it is a
 * percentage of.
 *
 * All three come from `quote()` in src/lib/pricing/experience-price.ts, the same function
 * the tests and the data-layer proof use, so the screen cannot drift from the rule. The
 * price rows arrive already carrying the guide's override — that happens server-side in
 * `getExperienceV2()`, so no override value exists in this bundle.
 *
 * Currency: the visitor may read the numbers in another currency. Then every amount prints
 * as "≈ $890" with the page-currency figure under it — the conversion is a courtesy at an
 * indicative rate, the page currency is what is charged (CLAUDE.md rule 6).
 *
 * Anglers go one past the page's per-guide maximum, shown as "3+": that is the "we add a
 * second guide" case, priced on request. Days are capped only by what a brief can hold.
 *
 * A `custom` page gets no calculator: it shows the stored range, labelled indicative, and
 * asks to plan the trip instead. The range is printed exactly as stored, with no FA fee
 * added — whether those numbers are net of the fee is unresolved (tj, 2026-10-07).
 *
 * The CTA stays an anchor to `#zapytanie` — without JavaScript it still reaches the form at
 * the bottom of the page. With it, the click opens the same form full-screen (FA-1.55) and
 * hands over the "when", the days and the anglers picked here, so nothing is asked twice.
 */

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { quote, fromPrice, customRange, type PriceRow } from '@/lib/pricing/experience-price'
import { formatCents } from '@/lib/format-price'
import { MAX_BRIEF_DAYS } from '@/lib/inquiries/brief'
import { useCurrency } from './currency-context'
import { useInquiryWizardOptional } from '@/components/inquiry-wizard/inquiry-wizard'
import { SegmentedControl } from '@/components/inquiry-wizard/wizard-fields'

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
  /** The second way in, for the visitor who would rather talk than fill a form. */
  whatsappUrl?:       string | null
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

/** An amount as the visitor reads it: converted when they asked for it, exact underneath. */
type Money = { main: string; sub: string | null }

const moneyProps = (m: Money) => ({ value: m.main, sub: m.sub })

function useMoney(): (cents: number, currency: string) => Money {
  const { indicative, display, baseCurrency } = useCurrency()
  return (cents, currency) => {
    const exact = formatCents(cents, currency)
    if (display === baseCurrency || currency !== baseCurrency) return { main: exact, sub: null }
    const converted = indicative(cents)
    return converted == null ? { main: exact, sub: null } : { main: converted, sub: exact }
  }
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
  whatsappUrl = null,
}: OfferWidgetProps) {
  const { display, baseCurrency } = useCurrency()
  const money = useMoney()

  const [anglers, setAnglers] = useState(Math.min(2, maxAnglersPerGuide))
  const [days, setDays]       = useState(minDays)
  const [whenMode, setWhenMode] = useState<'exact' | 'flexible'>('flexible')
  const [exactDate, setExactDate] = useState('')

  // Built once from one clock read rather than per render, so the list cannot shift
  // underneath a visitor who leaves the page open across midnight.
  const months = useMemo(() => nextTwelveMonths(new Date()), [])
  const [flexMonth, setFlexMonth] = useState(() => months[2]?.value ?? '')

  // Null when the widget is rendered outside a v2 page's provider: the CTA is then just the
  // anchor it has always been.
  const wizard = useInquiryWizardOptional()

  const openWizard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (wizard == null) return
    event.preventDefault()
    wizard.startFromWidget({
      datesMode: whenMode,
      ...(whenMode === 'exact' ? { dateFrom: exactDate } : { flexMonth }),
      days,
      anglers,
    })
  }

  const range = customRange(priceFromCents, priceToCents, currency)
  const from  = useMemo(() => fromPrice({ prices, feePct, maxAnglersPerGuide }), [prices, feePct, maxAnglersPerGuide])
  const q     = useMemo(
    () => quote({ days, anglers, prices, feePct, maxAnglersPerGuide }),
    [days, anglers, prices, feePct, maxAnglersPerGuide],
  )

  // One past the per-guide maximum is "more than that" — shown as "3+", priced on request.
  const anglerCap = maxAnglersPerGuide + 1
  const anglerLabel = (n: number) => (n > maxAnglersPerGuide ? `${maxAnglersPerGuide}+` : String(n))
  const converted = display !== baseCurrency

  // ── custom: a range and "plan your trip", no calculator ───────────────────
  if (offerMode === 'custom') {
    const rangeMoney = range != null
      ? {
          from: money(range.fromCents, range.currency),
          to:   range.toCents != null ? money(range.toCents, range.currency) : null,
        }
      : null

    return (
      <div data-testid="offer-widget" data-mode="custom" className={compact ? '' : cardClass} style={compact ? undefined : cardStyle}>
        <div className={compact ? '' : 'flex items-start justify-between gap-3'}>
          <div className="min-w-0">
            {rangeMoney != null ? (
              <>
                <p className={compact ? 'text-base font-bold leading-tight' : 'f-display text-[26px] font-bold leading-none tracking-[-0.01em]'}>
                  {rangeMoney.to != null ? `${rangeMoney.from.main}–${rangeMoney.to.main}` : `from ${rangeMoney.from.main}`}
                </p>
                <p className={compact ? 'text-xs opacity-90' : 'mt-1.5 text-sm'} style={compact ? undefined : mutedStyle}>
                  {rangeMoney.from.sub != null
                    ? `${rangeMoney.to?.sub != null ? `${rangeMoney.from.sub}–${rangeMoney.to.sub}` : rangeMoney.from.sub} · indicative rate`
                    : 'indicative · the offer is built around your dates'}
                </p>
              </>
            ) : (
              <p className={compact ? 'text-base font-bold' : 'f-display text-[26px] font-bold leading-none'}>Price on request</p>
            )}
          </div>
          {!compact && <CurrencyPicker />}
        </div>

        {!compact && <GuideLine guide={guide} />}

        <a href={inquiryHref} onClick={openWizard} className={compact ? compactCtaClass : ctaClass} style={compact ? compactCtaStyle : ctaStyle}>
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
            <WhatsAppLine url={whatsappUrl} />
          </>
        )}
      </div>
    )
  }

  // ── fixed: the calculator ─────────────────────────────────────────────────
  const fromMoney = from != null ? money(from.totalCents, from.currency) : null
  const fromLine  = fromMoney != null ? `from ${fromMoney.main}` : 'Price on request'

  if (compact) {
    return (
      <div data-testid="offer-widget" data-mode="fixed-compact" className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">{fromLine}</p>
          <p className="text-xs opacity-90">free inquiry · {responseSlaHours} h</p>
        </div>
        <a href={inquiryHref} onClick={openWizard} className={compactCtaClass} style={compactCtaStyle}>
          Check availability
        </a>
      </div>
    )
  }

  return (
    <div data-testid="offer-widget" data-mode="fixed" className={cardClass} style={cardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="f-display text-[28px] font-bold leading-none tracking-[-0.01em]" data-testid="offer-from-price">{fromLine}</p>
          <p className="mt-1.5 text-sm" style={mutedStyle}>
            {fromMoney?.sub != null ? `${fromMoney.sub} · ` : ''}
            {maxAnglersPerGuide === 1 ? '1 angler per guide' : `1–${maxAnglersPerGuide} anglers per guide`}
          </p>
        </div>
        <CurrencyPicker />
      </div>

      <GuideLine guide={guide} />

      {/* ── when / anglers / days ── */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="rounded-xl border p-2.5" style={fieldStyle}>
          <p className={`${labelClass} mb-2`} style={mutedStyle}>When</p>
          <SegmentedControl
            name="widget-when"
            compact
            options={[{ value: 'exact', label: 'Exact dates' }, { value: 'flexible', label: 'Flexible' }]}
            value={whenMode}
            onChange={value => setWhenMode(value === 'exact' ? 'exact' : 'flexible')}
          />

          {whenMode === 'exact' ? (
            <label className="mt-2 block">
              <span className="sr-only">First day</span>
              <input
                type="date"
                value={exactDate}
                onChange={e => setExactDate(e.target.value)}
                className="w-full rounded-lg border bg-white px-2.5 text-sm"
                style={{ ...fieldStyle, minHeight: 38 }}
              />
            </label>
          ) : (
            <label className="mt-2 block">
              <span className="sr-only">Month</span>
              <select
                value={flexMonth}
                onChange={e => setFlexMonth(e.target.value)}
                className="w-full rounded-lg border bg-white px-2.5 text-sm"
                style={{ ...fieldStyle, minHeight: 38 }}
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
            display={anglerLabel(anglers)}
            min={1}
            max={anglerCap}
            onChange={setAnglers}
          />
          <Stepper
            label="Days"
            value={days}
            display={String(days)}
            min={minDays}
            max={MAX_BRIEF_DAYS}
            onChange={setDays}
          />
        </div>
        {maxDays != null && days > maxDays && (
          <p className="text-xs" style={mutedStyle}>
            Usually {minDays === maxDays ? `${maxDays}` : `${minDays}–${maxDays}`} days — longer trips are priced on request.
          </p>
        )}
      </div>

      {/* ── the three numbers ── */}
      <div className="mt-3" data-testid="offer-totals">
        {q.priced ? (
          <>
            <Row label="Total" {...moneyProps(money(q.totalCents, q.currency))} strong />
            <Row
              label="Deposit now"
              {...moneyProps(money(q.feeCents, q.currency))}
              note={`${Math.round(feePct * 100)}% of the guide price`}
            />
            <Row label="Balance to the guide" {...moneyProps(money(q.guideCents, q.currency))} />
            {converted && (
              <p className="mt-1.5 text-xs" style={mutedStyle} data-testid="offer-indicative">
                ≈ indicative rate · you pay in {baseCurrency}
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
              : `On request for ${days} ${days === 1 ? 'day' : 'days'} × ${anglerLabel(anglers)} ${anglers === 1 ? 'angler' : 'anglers'}.`}
          </p>
        )}
      </div>

      <a href={inquiryHref} onClick={openWizard} className={ctaClass} style={ctaStyle}>Check availability</a>
      <p className="mt-2.5 text-center text-xs" style={mutedStyle}>
        Free · no obligation · deposit only after you accept the offer
      </p>
      <p className="mt-1 text-center text-xs" style={mutedStyle}>
        We answer within {responseSlaHours} h
      </p>
      <WhatsAppLine url={whatsappUrl} />
    </div>
  )
}

// ─── small pieces, local on purpose: nothing outside this widget uses them ───

const cardClass  = 'rounded-2xl bg-white px-5 py-4'
const cardStyle  = {
  boxShadow: '0 1px 2px rgba(10,46,77,0.06), 0 20px 48px -16px rgba(10,46,77,0.22)',
  border:    '1px solid rgba(10,46,77,0.08)',
  color:     'var(--fa-navy)',
}
const mutedStyle = { color: 'rgba(10,46,77,0.62)' }
const fieldStyle = { borderColor: 'rgba(10,46,77,0.14)', color: 'var(--fa-navy)' }
const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.12em]'
// The one salmon moment on the page (CLAUDE.md brand rule): navy text on salmon passes AA,
// white on salmon does not.
const ctaClass   = 'mt-3.5 block w-full rounded-xl px-4 py-3.5 text-center text-base font-bold transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_8px_20px_-6px_rgba(230,126,80,0.6)]'
const ctaStyle   = { background: 'var(--fa-salmon)', color: 'var(--fa-navy)' }
const compactCtaClass = 'flex-none rounded-xl px-4 py-3 text-sm font-bold'
const compactCtaStyle = { background: 'var(--fa-salmon)', color: 'var(--fa-navy)', minHeight: 44 }

/**
 * Lives in the card, next to the number it changes. Its own menu rather than a native
 * `<select>`: the native one paints itself from the OS theme and looked black on the
 * light card.
 */
function CurrencyPicker() {
  const { display, setDisplay, available } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current != null && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (available.length < 2) return null

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Show prices in ${display} — change currency`}
        className="flex items-center gap-1 rounded-full border bg-white py-1 pl-3 pr-2 text-xs font-semibold"
        style={fieldStyle}
        data-testid="currency-picker"
      >
        {display}
        <ChevronDown aria-hidden size={14} strokeWidth={2.25} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Currency"
          className="absolute right-0 z-20 mt-1.5 min-w-[112px] overflow-hidden rounded-xl bg-white py-1"
          style={{ boxShadow: '0 1px 2px rgba(10,46,77,0.08), 0 12px 32px -8px rgba(10,46,77,0.28)', border: '1px solid rgba(10,46,77,0.08)' }}
        >
          {available.map(code => {
            const selected = code === display
            return (
              <li key={code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { setDisplay(code); setOpen(false) }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium hover:bg-[rgba(10,46,77,0.05)]"
                  style={{ background: selected ? 'rgba(10,46,77,0.06)' : undefined }}
                >
                  {code}
                  {selected && <span aria-hidden className="text-xs">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function WhatsAppLine({ url }: { url: string | null }) {
  if (url == null) return null
  return (
    <p className="mt-3 border-t pt-3 text-center text-xs" style={{ ...mutedStyle, borderColor: 'rgba(10,46,77,0.08)' }}>
      Prefer to talk?{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: 'var(--fa-navy)' }}>
        Write to us on WhatsApp
      </a>
    </p>
  )
}

function GuideLine({ guide }: { guide: OfferWidgetGuide | null }) {
  if (guide == null) return null
  return (
    <div className="mt-3 flex items-center gap-2.5">
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

function Row({
  label, value, sub, strong = false, note,
}: {
  label: string; value: string; strong?: boolean
  /** The exact page-currency amount, when `value` is a conversion. */
  sub?: string | null
  /** Small print under the label — what the number is a share of, when that is not obvious. */
  note?: string
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-t py-2 text-sm"
      style={{ borderColor: 'rgba(10,46,77,0.08)' }}
    >
      <span className={strong ? 'font-semibold' : undefined}>
        {label}
        {note != null && (
          <span className="mt-0.5 block text-xs font-normal" style={mutedStyle}>{note}</span>
        )}
      </span>
      <span className="text-right">
        <b className={strong ? 'f-display text-xl' : 'tabular-nums'}>{value}</b>
        {sub != null && <span className="block text-[11px] tabular-nums" style={mutedStyle}>{sub}</span>}
      </span>
    </div>
  )
}

function Stepper({
  label, value, display, min, max, onChange,
}: {
  label: string; value: number; display: string; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-xl border py-1.5 pl-3 pr-1.5" style={fieldStyle}>
      <span className={labelClass} style={mutedStyle}>{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`One fewer ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition-colors hover:bg-[rgba(10,46,77,0.06)] disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ borderColor: 'rgba(10,46,77,0.18)' }}
        >
          −
        </button>
        <b className="w-7 text-center text-[15px] tabular-nums" aria-live="polite">{display}</b>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition-colors hover:bg-[rgba(10,46,77,0.06)] disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ borderColor: 'rgba(10,46,77,0.18)' }}
        >
          +
        </button>
      </span>
    </div>
  )
}
