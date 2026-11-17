'use client'

/**
 * S2 — the widget that turns the price table into one number (FA-1.53).
 *
 *   Total                 what the angler pays, all in (O-31: one number, no "+ fee" line)
 *
 * The "Deposit now" and "Balance to the guide" lines under it were removed (tj, FA-1.65,
 * 2026-10-23): the widget shows the price only. How the deposit and the balance are paid is
 * told once, in "How booking works" (S8), and in the offer itself.
 *
 * The total comes from `quote()` in src/lib/pricing/experience-price.ts, the same function
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
import { quote, fromPrice, customRange, anglersPerGuideLabel, type PriceRow } from '@/lib/pricing/experience-price'
import { formatCents } from '@/lib/format-price'
import { MAX_BRIEF_DAYS } from '@/lib/inquiries/brief'
import { useCurrency } from './currency-context'
import { useInquiryWizardOptional } from '@/components/inquiry-wizard/inquiry-wizard'
import { DateRangeCalendar, SegmentedControl } from '@/components/inquiry-wizard/wizard-fields'
import { CREAM, LINE, MUTED, ON_DARK_SOFT, SALMON_ON_DARK, primaryButtonStyle } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import { cardShadow } from './offer-box'

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

  // FA-1.60 — a change to any trip field up here is the visitor starting on the inquiry:
  // `form_open` and step 1 in the funnel. The answers themselves stay local until the CTA.
  const touched = () => wizard?.started()

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

    if (compact) {
      return (
        <div data-testid="offer-widget" data-mode="custom" className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight">
              {rangeMoney == null ? 'Price on request' : rangeMoney.to != null ? `${rangeMoney.from.main}–${rangeMoney.to.main}` : `from ${rangeMoney.from.main}`}
            </p>
            <p className="text-xs opacity-90">
              {rangeMoney?.from.sub != null
                ? `${rangeMoney.to?.sub != null ? `${rangeMoney.from.sub}–${rangeMoney.to.sub}` : rangeMoney.from.sub} · indicative rate`
                : 'indicative · the offer is built around your dates'}
            </p>
          </div>
          <a href={inquiryHref} onClick={openWizard} className={compactCtaClass} style={compactCtaStyle}>Plan your trip</a>
        </div>
      )
    }

    return (
      <div data-testid="offer-widget" data-mode="custom" className={cardClass} style={cardStyle}>
        <PriceHeader
          label={rangeMoney != null && rangeMoney.to == null ? 'From' : 'Indicative'}
          amount={rangeMoney == null ? 'Price on request' : rangeMoney.to != null ? `${rangeMoney.from.main}–${rangeMoney.to.main}` : rangeMoney.from.main}
          sub={rangeMoney?.from.sub != null
            ? `${rangeMoney.to?.sub != null ? `${rangeMoney.from.sub}–${rangeMoney.to.sub}` : rangeMoney.from.sub} · indicative rate`
            : 'the offer is built around your dates'}
        />

        <div className={bodyClass}>
          <GuideLine guide={guide} />
          <a href={inquiryHref} onClick={openWizard} className={ctaClass} style={ctaStyle}>Plan your trip</a>
          <Notes responseSlaHours={responseSlaHours} />
          <CurrencyPicker />
          <WhatsAppLine url={whatsappUrl} />
        </div>
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
      <PriceHeader
        label={fromMoney != null ? 'From' : null}
        amount={fromMoney?.main ?? 'Price on request'}
        amountTestId="offer-from-price"
        sub={`${fromMoney?.sub != null ? `${fromMoney.sub} · ` : ''}${anglersPerGuideLabel(maxAnglersPerGuide)}`}
      />

      <div className={bodyClass}>
        <GuideLine guide={guide} />

        {/* ── when / anglers / days ── */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border p-2.5" style={fieldStyle}>
            <p className={`${labelClass} mb-2`} style={mutedStyle}>When</p>
            <SegmentedControl
              name="widget-when"
              compact
              options={[{ value: 'exact', label: 'Exact dates' }, { value: 'flexible', label: 'Flexible' }]}
              value={whenMode}
              onChange={value => { touched(); setWhenMode(value === 'exact' ? 'exact' : 'flexible') }}
            />

            {whenMode === 'exact' ? (
              <div className="mt-2.5">
                <DateRangeCalendar
                  compact
                  dateFrom={exactDate}
                  days={days}
                  minDays={minDays}
                  maxDays={MAX_BRIEF_DAYS}
                  onChange={(from, n) => { touched(); setExactDate(from); setDays(n) }}
                />
              </div>
            ) : (
              <label className="mt-2 block">
                <span className="sr-only">Month</span>
                <select
                  value={flexMonth}
                  onChange={e => { touched(); setFlexMonth(e.target.value) }}
                  className="w-full rounded-lg border bg-white px-2.5 text-sm"
                  style={{ ...fieldStyle, minHeight: 40 }}
                >
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
            )}
          </div>

          <Stepper
            label="Anglers"
            value={anglers}
            display={anglerLabel(anglers)}
            min={1}
            max={anglerCap}
            onChange={n => { touched(); setAnglers(n) }}
          />
          <Stepper
            label="Days"
            value={days}
            display={String(days)}
            min={minDays}
            max={MAX_BRIEF_DAYS}
            onChange={n => { touched(); setDays(n) }}
          />
          {maxDays != null && days > maxDays && (
            <p className="text-xs" style={mutedStyle}>
              Usually {minDays === maxDays ? `${maxDays}` : `${minDays}–${maxDays}`} days — longer trips are priced on request.
            </p>
          )}
        </div>

        {/* ── the price ── */}
        <div data-testid="offer-totals">
          {q.priced ? (
            <>
              <Row label="Total" {...moneyProps(money(q.totalCents, q.currency))} />
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
            <p className="border-t pt-3.5 text-sm" style={{ ...mutedStyle, borderColor: LINE }} data-testid="offer-on-request">
              {q.reason === 'no-prices'
                ? 'On request — we price this trip for your dates.'
                : `On request for ${days} ${days === 1 ? 'day' : 'days'} × ${anglerLabel(anglers)} ${anglers === 1 ? 'angler' : 'anglers'}.`}
            </p>
          )}
        </div>

        <a href={inquiryHref} onClick={openWizard} className={ctaClass} style={ctaStyle}>Check availability</a>
        <Notes responseSlaHours={responseSlaHours} />
        <CurrencyPicker />
        <WhatsAppLine url={whatsappUrl} />
      </div>
    </div>
  )
}

// ─── small pieces, local on purpose: nothing outside this widget uses them ───

// The 2026-11 mockup's card: cream, a sand hairline, a soft lift; the price sits on a grain header.
const cardClass  = 'rounded-[20px]'
const cardStyle  = {
  background: CREAM,
  border:     `1px solid ${LINE}`,
  boxShadow:  cardShadow,
  color:      'var(--fa-navy)',
}
const bodyClass  = 'flex flex-col gap-4 px-6 pb-6 pt-5'
const mutedStyle = { color: MUTED }
const fieldStyle = { borderColor: LINE, color: 'var(--fa-navy)' }
const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.12em]'
// The site's main CTA (src/components/site/ui.tsx) as a plain <a>: it opens the form, not a page.
const ctaClass   = 'w-full transition-transform duration-150 hover:-translate-y-px'
const ctaStyle   = { ...primaryButtonStyle, minHeight: 52 }
const compactCtaClass = 'flex-none'
const compactCtaStyle = { ...primaryButtonStyle, minHeight: 44, padding: '0 16px' }

/** The grain header: "From", the amount, and what it covers. */
function PriceHeader({ label, amount, amountTestId, sub }: { label: string | null; amount: string; amountTestId?: string; sub: string }) {
  return (
    <div className={`${grain.blur} ${grain.nz} flex flex-col gap-1 rounded-t-[19px] px-6 py-[22px]`}>
      {label != null && (
        <span className="text-[12.5px] font-bold uppercase tracking-[0.1em]" style={{ color: SALMON_ON_DARK }}>{label}</span>
      )}
      <span className="f-display text-[32px] font-bold leading-none text-white" data-testid={amountTestId}>{amount}</span>
      <span className="mt-1 text-[14px] font-medium" style={{ color: ON_DARK_SOFT }}>{sub}</span>
    </div>
  )
}

function Notes({ responseSlaHours }: { responseSlaHours: number }) {
  return (
    <div className="-mt-1.5 text-center text-[12.5px] leading-relaxed" style={mutedStyle}>
      <p>Free · no obligation · deposit only after you accept the offer</p>
      <p>We answer within {responseSlaHours} h</p>
    </div>
  )
}

/**
 * Under the CTA, as the mockup's "Show prices in NZD · change currency" line. Its own menu
 * rather than a native `<select>`: the native one paints itself from the OS theme and looked
 * black on the light card. The menu opens upwards, over the card.
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
    <div ref={ref} className="relative -mt-1.5 self-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Show prices in ${display} — change currency`}
        className="flex min-h-[32px] items-center gap-1 text-[13.5px] underline underline-offset-[3px]"
        style={{ ...mutedStyle, textDecorationColor: 'var(--fa-salmon)' }}
        data-testid="currency-picker"
      >
        Show prices in {display} · change currency
        <ChevronDown aria-hidden size={14} strokeWidth={2.25} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Currency"
          className="absolute bottom-full left-1/2 z-20 mb-1.5 min-w-[112px] -translate-x-1/2 overflow-hidden rounded-xl py-1"
          style={{ background: CREAM, boxShadow: '0 1px 2px rgba(10,46,77,0.08), 0 12px 32px -8px rgba(10,46,77,0.28)', border: `1px solid ${LINE}` }}
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
    <p className="border-t pt-3 text-center text-[12.5px]" style={{ ...mutedStyle, borderColor: LINE }}>
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
    <div className="flex items-center gap-2.5">
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
  label, value, sub,
}: {
  label: string; value: string
  /** The exact page-currency amount, when `value` is a conversion. */
  sub?: string | null
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t pt-3.5" style={{ borderColor: LINE }}>
      <span className="text-[15px] font-bold">{label}</span>
      <span className="text-right">
        <b className="f-display text-[24px]">{value}</b>
        {sub != null && <span className="block text-[11px] tabular-nums" style={mutedStyle}>{sub}</span>}
      </span>
    </div>
  )
}

/** One full-width row per count: the label on the left, − n + on the right (2026-11 mockup). */
function Stepper({
  label, value, display, min, max, onChange,
}: {
  label: string; value: number; display: string; min: number; max: number; onChange: (n: number) => void
}) {
  const buttonClass = 'flex h-10 w-10 items-center justify-center rounded-[9px] border-[1.5px] text-lg font-bold leading-none transition-colors hover:bg-[rgba(10,46,77,0.06)] disabled:opacity-30 disabled:hover:bg-transparent'
  const buttonStyle = { borderColor: LINE, background: CREAM, color: 'var(--fa-navy)' }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-semibold">{label}</span>
      <span className="inline-flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`One fewer ${label.toLowerCase()}`}
          className={buttonClass}
          style={buttonStyle}
        >
          −
        </button>
        <b className="min-w-[18px] text-center text-[16px] tabular-nums" aria-live="polite">{display}</b>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label.toLowerCase()}`}
          className={buttonClass}
          style={buttonStyle}
        >
          +
        </button>
      </span>
    </div>
  )
}
