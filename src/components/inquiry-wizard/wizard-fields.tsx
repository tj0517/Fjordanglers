'use client'

/**
 * The controls the three steps are built from (FA-1.55), straight off the wireframe
 * (`docs/brand/wireframes/Form.dc.html`): the question label, the radio row, the pill row,
 * the ± counter and the error line.
 *
 * They are kept here rather than inside the steps so the three steps look like one form, and
 * so the 44 px minimum touch target is decided once. Every control is a real `<input>` or
 * `<button>` — the wireframe's `<span class="pill">` would be invisible to a keyboard.
 */

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const NAVY     = 'var(--fa-navy)'
export const BORDER   = 'rgba(10,46,77,0.28)'
export const SELECTED = 'rgba(10,46,77,0.06)'
export const MUTED    = { color: 'rgba(10,46,77,0.62)' }

export function Question({
  label,
  hint,
  error,
  children,
}: {
  label:    string
  hint?:    string
  error?:   string
  children: ReactNode
}) {
  return (
    <fieldset className="mb-6 border-0 p-0">
      <legend className="mb-2.5 text-[17px] font-semibold">{label}</legend>
      {children}
      {hint != null && <p className="mt-2 text-[12px]" style={MUTED}>{hint}</p>}
      {error != null && (
        <p role="alert" className="mt-2 text-[13px] font-medium" style={{ color: '#B23A1C' }}>
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** A full-width radio row — the wireframe's `.opt`. */
export function ChoiceRow({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name:     string
  checked:  boolean
  onChange: () => void
  title:    string
  description?: string
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-[15px]"
      style={{
        minHeight:   48,
        borderColor: checked ? NAVY : BORDER,
        borderWidth: checked ? 2 : 1,
        background:  checked ? SELECTED : '#fff',
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-5 w-5 flex-none"
      />
      <span>
        <span className="font-medium">{title}</span>
        {description != null && <span className="block text-[13px]" style={MUTED}>{description}</span>}
      </span>
    </label>
  )
}

/**
 * A two-way (or three-way) switch in one track — the control for "exact dates / flexible".
 * Reads as a switch at a glance, which two separate pills did not. Radios under the paint,
 * so the keyboard and screen readers get a real group.
 */
export function SegmentedControl({
  name,
  options,
  value,
  onChange,
  compact = false,
}: {
  name:     string
  options:  readonly { value: string; label: string }[]
  value:    string
  onChange: (value: string) => void
  /** The widget's 36 px version; the form uses the 48 px touch target. */
  compact?: boolean
}) {
  return (
    <div
      role="radiogroup"
      className="flex rounded-xl p-1"
      style={{ background: 'rgba(10,46,77,0.06)' }}
    >
      {options.map(option => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg text-center font-semibold transition-[background,color,box-shadow] duration-150 ${compact ? 'text-[13px]' : 'text-[15px]'}`}
            style={{
              minHeight:  compact ? 30 : 42,
              background: checked ? NAVY : 'transparent',
              color:      checked ? '#fff' : NAVY,
              boxShadow:  checked ? '0 1px 2px rgba(10,46,77,0.2)' : 'none',
            }}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

/** A row of short choices — the wireframe's `.pill`. Radios under the paint. */
export function PillRow({
  name,
  options,
  value,
  onChange,
}: {
  name:     string
  options:  readonly { value: string; label: string }[]
  value:    string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-[16px] font-medium"
            style={{
              minHeight:   48,
              minWidth:    64,
              borderColor: checked ? NAVY : BORDER,
              borderWidth: checked ? 2 : 1,
              background:  checked ? SELECTED : '#fff',
              color:       NAVY,
            }}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

/**
 * The ± counter — the wireframe's `.cnt`. The number itself is a read-only output. Sized to
 * its content, not the column: a 700 px bar for a number between 1 and 6 makes the
 * buttons look lost.
 */
export function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label:  string
  hint?:  string
  value:  number
  min:    number
  max:    number
  onChange: (value: number) => void
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)))

  return (
    <div
      className="inline-flex items-center justify-between gap-4 rounded-xl border py-1.5 pl-3.5 pr-1.5"
      style={{ minHeight: 48, minWidth: 220, borderColor: BORDER, background: '#fff' }}
    >
      <span className="text-[15px]">
        {label}
        {hint != null && <span className="text-[12px]" style={MUTED}> {hint}</span>}
      </span>
      <span className="flex items-center gap-2.5">
        <CounterButton label={`One fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => step(-1)}>−</CounterButton>
        <output className="w-7 text-center text-[17px] font-semibold">{value}</output>
        <CounterButton label={`One more ${label.toLowerCase()}`} disabled={value >= max} onClick={() => step(1)}>+</CounterButton>
      </span>
    </div>
  )
}

function CounterButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label:    string
  disabled: boolean
  onClick:  () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center rounded-full border text-[18px] transition-colors hover:bg-[rgba(10,46,77,0.06)] disabled:opacity-35 disabled:hover:bg-white"
      style={{ width: 40, height: 40, borderColor: BORDER, background: '#fff' }}
    >
      {children}
    </button>
  )
}

/** A labelled text input, for step 3. */
export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  optional = false,
  autoComplete,
  inputMode,
  rows,
  min,
}: {
  label:    string
  type?:    'text' | 'email' | 'tel' | 'date'
  value:    string
  onChange: (value: string) => void
  error?:   string
  optional?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel'
  /** Set to render a textarea instead of an input. */
  rows?: number
  /** `type="date"` only — the earliest day the picker offers. */
  min?: string
}) {
  const shared = {
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: 'w-full rounded-lg border px-3 py-2.5 text-[16px]',
    style: { minHeight: 48, borderColor: error != null ? '#B23A1C' : BORDER, background: '#fff' },
    'aria-invalid': error != null,
  }

  return (
    <label className="flex flex-col gap-1.5 text-[14px]">
      <span>
        {label}
        {optional && <span style={MUTED}> (optional)</span>}
      </span>
      {rows != null
        ? <textarea {...shared} rows={rows} />
        : <input {...shared} type={type} autoComplete={autoComplete} inputMode={inputMode} min={min} />}
      {error != null && (
        <span role="alert" className="text-[13px] font-medium" style={{ color: '#B23A1C' }}>{error}</span>
      )}
    </label>
  )
}

/** "Step 2 of 3" and the three bars under it. */
export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <p
        className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em]"
        style={{ color: NAVY }}
        data-testid="wizard-progress"
      >
        Step {step} of {total}
      </p>
      <div className="flex gap-1" aria-hidden>
        {/* A spread, so this tree stays free of any Supabase-looking query call. */}
        {[...new Array(total)].map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < step ? NAVY : 'rgba(10,46,77,0.15)' }}
          />
        ))}
      </div>
    </div>
  )
}

// Salmon with navy text: the one accent moment on the offer page; white on salmon fails AA.
export const primaryButtonStyle = {
  background: 'var(--fa-salmon)',
  color:      NAVY,
  fontWeight: 700,
  minHeight:  52,
}

// ─── Dates, in the site's own calendar ────────────────────────────────────────

const DAY_MS = 86_400_000

function isoOf(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

function utcOf(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

/** `YYYY-MM-DD` for today in UTC — the floor of every picker here. */
function todayIsoUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function fmtDay(iso: string, withYear: boolean): string {
  return new Date(utcOf(iso)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}

/** "Sat 14 Mar – Mon 16 Mar 2027 · 3 days" — what the range the angler picked means. */
export function rangeLabel(dateFrom: string, days: number): string {
  if (dateFrom === '') return ''
  const last = isoOf(utcOf(dateFrom) + (days - 1) * DAY_MS)
  const span = days === 1 ? fmtDay(dateFrom, true) : `${fmtDay(dateFrom, false)} – ${fmtDay(last, true)}`
  return `${span} · ${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * A range on one month grid, the way v1's widget picked days — first click is the first day
 * of fishing, the next click the last. The range is stored as `dateFrom` + `days`, the same
 * two answers the rest of the form already keeps, so nothing else learns a new shape.
 */
export function DateRangeCalendar({
  dateFrom,
  days,
  minDays,
  maxDays,
  onChange,
  compact = false,
}: {
  dateFrom: string
  days:     number
  minDays:  number
  maxDays:  number
  onChange: (dateFrom: string, days: number) => void
  /** The widget's smaller version. */
  compact?: boolean
}) {
  const today = todayIsoUtc()
  const [view, setView] = useState(() => {
    const base = dateFrom !== '' ? new Date(utcOf(dateFrom)) : new Date()
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() }
  })
  const [pickingEnd, setPickingEnd] = useState(false)
  const [hover, setHover] = useState<string | null>(null)

  const from = dateFrom === '' ? null : dateFrom
  const to   = from == null ? null : isoOf(utcOf(from) + (days - 1) * DAY_MS)

  const move = (delta: number) => setView(v => {
    const d = new Date(Date.UTC(v.year, v.month + delta, 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })

  const pick = (iso: string) => {
    if (from == null || !pickingEnd || iso < from) {
      onChange(iso, Math.max(1, minDays))
      setPickingEnd(true)
      return
    }
    const span = Math.round((utcOf(iso) - utcOf(from)) / DAY_MS) + 1
    onChange(from, Math.min(maxDays, Math.max(minDays, span)))
    setPickingEnd(false)
  }

  // While the second click is pending, the days under the pointer preview the range.
  const previewTo = pickingEnd && from != null && hover != null && hover >= from ? hover : to

  const first       = new Date(Date.UTC(view.year, view.month, 1))
  const offset      = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...new Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const canGoBack = view.year > Number(today.slice(0, 4)) || (view.year === Number(today.slice(0, 4)) && view.month > Number(today.slice(5, 7)) - 1)

  return (
    <div className="select-none" data-testid="date-range-calendar" onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={!canGoBack} aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30" style={{ background: 'rgba(10,46,77,0.05)', color: NAVY }}>
          <ChevronLeft size={15} />
        </button>
        <span className={`font-semibold ${compact ? 'text-[13px]' : 'text-[14px]'}`} style={{ color: NAVY }}>{monthName}</span>
        <button type="button" onClick={() => move(1)} aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(10,46,77,0.05)', color: NAVY }}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-0.5 text-center text-[10px] font-bold" style={{ color: 'rgba(10,46,77,0.3)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5" role="group" aria-label="Pick the first and the last day of fishing">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />
          const iso      = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const past     = iso < today
          const isStart  = iso === from
          const isEnd    = previewTo != null && iso === previewTo && from != null
          const inRange  = from != null && previewTo != null && iso > from && iso < previewTo
          const edge     = isStart || isEnd
          return (
            <div
              key={iso}
              className="flex justify-center"
              style={{
                background: inRange || (edge && from !== previewTo)
                  ? 'rgba(10,46,77,0.09)' : 'transparent',
                borderRadius: isStart && from !== previewTo ? '999px 0 0 999px' : isEnd && from !== previewTo ? '0 999px 999px 0' : 0,
              }}
            >
              <button
                type="button"
                disabled={past}
                onClick={() => pick(iso)}
                onMouseEnter={() => setHover(iso)}
                aria-label={`${fmtDay(iso, true)}${isStart ? ' — first day' : isEnd ? ' — last day' : ''}`}
                aria-pressed={isStart || (isEnd && !pickingEnd)}
                className={`flex items-center justify-center rounded-full transition-colors ${compact ? 'h-8 w-8 text-[12px]' : 'h-10 w-10 text-[14px]'}`}
                style={{
                  background: edge ? NAVY : 'transparent',
                  color:      past ? 'rgba(10,46,77,0.2)' : edge ? '#fff' : NAVY,
                  fontWeight: edge ? 700 : iso === today ? 700 : 400,
                  cursor:     past ? 'not-allowed' : 'pointer',
                  boxShadow:  iso === today && !edge ? `inset 0 0 0 1px ${BORDER}` : 'none',
                }}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>

      <p className={`mt-2.5 ${compact ? 'text-[12px]' : 'text-[13px]'} font-medium`} style={from == null ? MUTED : { color: NAVY }} aria-live="polite" data-testid="date-range-label">
        {from == null
          ? 'Tap the first day of fishing, then the last.'
          : pickingEnd ? `From ${fmtDay(from, true)} — now tap the last day.` : rangeLabel(from, days)}
      </p>
    </div>
  )
}

/** The twelve months from this one as tiles — the "flexible" half, in the same style as the calendar. */
export function MonthGrid({
  name,
  options,
  value,
  onChange,
}: {
  name:     string
  options:  readonly { value: string; label: string }[]
  value:    string
  onChange: (value: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Month" className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="month-grid">
      {options.map(option => {
        const checked = option.value === value
        const [month, year] = option.label.split(' ')
        return (
          <label
            key={option.value}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border py-2 text-center transition-colors"
            style={{
              minHeight:   52,
              borderColor: checked ? NAVY : BORDER,
              background:  checked ? NAVY : '#fff',
              color:       checked ? '#fff' : NAVY,
            }}
          >
            <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)} className="sr-only" />
            <span className="text-[14px] font-semibold leading-tight">{month}</span>
            <span className="text-[11px]" style={{ color: checked ? 'rgba(255,255,255,0.7)' : 'rgba(10,46,77,0.5)' }}>{year}</span>
          </label>
        )
      })}
    </div>
  )
}
