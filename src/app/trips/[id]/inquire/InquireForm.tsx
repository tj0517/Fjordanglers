'use client'

import { useState, useTransition } from 'react'
import { Calendar, Users, SlidersHorizontal, FileText, Check, CheckCircle } from 'lucide-react'
import { submitInquiry } from '@/actions/inquiries'
import { type InquiryFormConfig, SPECIES_OPTIONS, resolveFormConfig } from '@/lib/inquiry-form-config'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import { MultiPeriodPicker, type Period, type BlockedRange } from '@/components/trips/multi-period-picker'
import { HelpWidget } from '@/components/ui/help-widget'
import { FieldTooltip } from '@/components/ui/field-tooltip'
import type { DurationOptionPayload } from '@/actions/experiences'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayState =
  | 'available'
  | 'unavailable'
  | 'blocked'
  | 'selected_single'
  | 'selected_start'
  | 'selected_end'
  | 'in_range'
  | 'pending_start'
  | 'pending_range'

type DurationType        = 'half_day' | 'full_day' | 'multi_day'
type GearOption          = 'own' | 'need_some' | 'need_all'
type AccommodationOption = 'needed' | 'not_needed' | 'flexible'
type TransportOption     = 'need_pickup' | 'self_drive' | 'flexible'
type TabKey              = 'trip' | 'group' | 'needs' | 'extras'

type Props = {
  experienceId:        string
  guideId:             string | null
  prefilledDates:      string[]
  /** Pre-filled date ranges from the trip page period picker (?periods= param). */
  prefilledPeriods?:   Period[]
  prefilledGroup:      number
  anglerName:          string | null
  anglerEmail:         string | null
  formConfig?:         Partial<InquiryFormConfig> | null
  availabilityConfig?: AvailConfigRow | null
  blockedDates?:       BlockedRange[]
  fishTypes?:          string[]
  /** When true (direct booking ?mode=direct), show guide's real packages instead of generic duration picker. */
  isDirectMode?:       boolean
  /** Guide's configured duration/pricing options — shown as package cards in direct mode. */
  durationOptions?:    DurationOptionPayload[]
}

// ─── Tabs metadata ────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; next: TabKey | null }[] = [
  { key: 'trip',   label: 'Trip',   next: 'group'  },
  { key: 'group',  label: 'Group',  next: 'needs'  },
  { key: 'needs',  label: 'Needs',  next: 'extras' },
  { key: 'extras', label: 'Extras', next: null      },
]

// ─── Constants ────────────────────────────────────────────────────────────────


const DURATION_OPTIONS: { value: DurationType; label: string; sub: string }[] = [
  { value: 'half_day',  label: 'Half day',  sub: '~4 hours'  },
  { value: 'full_day',  label: 'Full day',  sub: '~8 hours'  },
  { value: 'multi_day', label: 'Multi-day', sub: '2+ days'   },
]

const GEAR_OPTIONS: { value: GearOption; label: string; sub: string }[] = [
  { value: 'own',       label: 'I have my own',     sub: 'Fully equipped'      },
  { value: 'need_some', label: 'Need some gear',    sub: 'Partially equipped'  },
  { value: 'need_all',  label: 'Provide everything', sub: 'Full hire please'   },
]

const ACCOMMODATION_OPTIONS: { value: AccommodationOption; label: string; sub: string }[] = [
  { value: 'needed',     label: 'Yes, include it', sub: 'Lodge or cabin'           },
  { value: 'not_needed', label: 'Just guiding',    sub: "I've got accommodation"   },
  { value: 'flexible',   label: 'Flexible',        sub: 'Depends on the offer'    },
]

const TRANSPORT_OPTIONS: { value: TransportOption; label: string; sub: string }[] = [
  { value: 'need_pickup', label: 'Need pickup', sub: 'From hotel / meeting point' },
  { value: 'self_drive',  label: "I'll drive",  sub: 'I have a vehicle'           },
  { value: 'flexible',    label: 'Flexible',    sub: 'Depends on location'        },
]

// ─── (MultiPeriodPicker moved to @/components/trips/multi-period-picker) ───────

function _placeholder_remove_({
  periods,
  onChange,
  availabilityConfig,
  blockedDates = [],
  disabled = false,
}: {
  periods:             Period[]
  onChange:            (p: Period[]) => void
  availabilityConfig?: AvailConfigRow | null
  blockedDates?:       BlockedRange[]
  disabled?:           boolean
}) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const advHours = availabilityConfig?.advance_notice_hours ?? 0
  const minDate  = new Date(now.getTime() + advHours * 3_600_000)
  const minISO   = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`

  const maxDays  = availabilityConfig?.max_advance_days ?? 365
  const maxDate  = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const maxISO   = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`

  const [pickMode,    setPickMode]    = useState<'single' | 'range'>('range')
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [hovered,     setHovered]     = useState<string | null>(null)
  const [viewY,       setViewY]       = useState(now.getFullYear())
  const [viewM,       setViewM]       = useState(now.getMonth())

  function switchMode(mode: 'single' | 'range') {
    setPickMode(mode)
    setPendingFrom(null)
    setHovered(null)
  }

  function getDayState(iso: string): DayState {
    // Already selected?
    for (const p of periods) {
      if (p.from === iso && p.to === iso) return 'selected_single'
      if (p.from === iso)                 return 'selected_start'
      if (p.to   === iso)                 return 'selected_end'
      if (iso > p.from && iso < p.to)     return 'in_range'
    }

    // Pending range preview
    if (pendingFrom != null) {
      if (iso === pendingFrom) return 'pending_start'
      if (hovered != null) {
        const lo = pendingFrom <= hovered ? pendingFrom : hovered
        const hi = pendingFrom <= hovered ? hovered : pendingFrom
        if (iso > lo && iso < hi) return 'pending_range'
      }
    }

    // Past or out of window
    if (iso < minISO || iso > maxISO) return 'unavailable'

    // Guide-blocked ranges — VISIBLE but NOT clickable
    for (const r of blockedDates) {
      if (iso >= r.date_start && iso <= r.date_end) return 'blocked'
    }

    // Config-based gates (seasons, weekdays)
    if (availabilityConfig) {
      const [, mStr] = iso.split('-')
      const month1   = parseInt(mStr, 10)
      if (availabilityConfig.available_months.length > 0 &&
          !availabilityConfig.available_months.includes(month1))
        return 'unavailable'
      const wd = new Date(iso + 'T00:00:00').getDay()
      if (availabilityConfig.available_weekdays.length > 0 &&
          !availabilityConfig.available_weekdays.includes(wd))
        return 'unavailable'
    }

    return 'available'
  }

  function handleDayClick(iso: string) {
    if (disabled) return
    const state = getDayState(iso)

    // Non-interactive states
    if (state === 'unavailable' || state === 'blocked') return

    // Cancel pending selection on re-click of pending start
    if (state === 'pending_start') {
      setPendingFrom(null); setHovered(null); return
    }

    // Remove period if clicking a selected day
    if (
      state === 'selected_single' ||
      state === 'selected_start'  ||
      state === 'selected_end'    ||
      state === 'in_range'
    ) {
      onChange(periods.filter(p => !(iso >= p.from && iso <= p.to)))
      return
    }

    if (pickMode === 'single') {
      // Toggle single day
      const already = periods.findIndex(p => p.from === iso && p.to === iso)
      if (already >= 0) {
        onChange(periods.filter((_, i) => i !== already))
      } else {
        onChange([...periods, { from: iso, to: iso }].sort((a, b) => a.from.localeCompare(b.from)))
      }
      return
    }

    // Range mode
    if (pendingFrom == null) {
      setPendingFrom(iso)
    } else {
      const from = pendingFrom <= iso ? pendingFrom : iso
      const to   = pendingFrom <= iso ? iso : pendingFrom
      onChange([...periods, { from, to }].sort((a, b) => a.from.localeCompare(b.from)))
      setPendingFrom(null); setHovered(null)
    }
  }

  // Calendar geometry
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7
  const monthLabel  = new Date(viewY, viewM, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) } else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) } else setViewM(m => m + 1)
  }

  const canPrev = viewY > now.getFullYear() || (viewY === now.getFullYear() && viewM > now.getMonth())
  const canNext = (() => {
    const ny = viewM === 11 ? viewY + 1 : viewY
    const nm = viewM === 11 ? 0 : viewM + 1
    return `${ny}-${String(nm + 1).padStart(2, '0')}-01` <= maxISO
  })()

  function fmtPeriod(p: Period) {
    const fmt = (d: string) =>
      new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`
  }

  // Total days across all periods
  const totalDays = periods.reduce((sum, p) => {
    const msPerDay = 86_400_000
    return sum + Math.round((new Date(p.to + 'T00:00:00').getTime() - new Date(p.from + 'T00:00:00').getTime()) / msPerDay) + 1
  }, 0)

  return (
    <div>
      {/* ── Mode toggle ────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-3">
        {([
          { mode: 'single' as const, label: 'Individual days' },
          { mode: 'range'  as const, label: 'Date range'      },
        ]).map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => switchMode(mode)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
            style={
              pickMode === mode
                ? { background: '#0A2E4D', color: 'white',              border: '1.5px solid #0A2E4D' }
                : { background: 'transparent', color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.15)' }
            }
          >
            {mode === 'single'
              ? <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" /><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" /></svg>
              : <svg width="14" height="9"  viewBox="0 0 14 9"  fill="none"><rect x="1" y="1" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="8" y="1" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><line x1="6" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            }
            {label}
          </button>
        ))}
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(10,46,77,0.025)', borderRadius: '16px', padding: '14px 16px 16px', border: '1px solid rgba(10,46,77,0.07)' }}>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button" onClick={goPrev} disabled={!canPrev || disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: (!canPrev || disabled) ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canPrev ? 1 : 0.3 }}
          >‹</button>

          <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{monthLabel}</span>

          <button
            type="button" onClick={goNext} disabled={!canNext || disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: (!canNext || disabled) ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNext ? 1 : 0.3 }}
          >›</button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
            <div key={d} className="text-center py-1"
              style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(10,46,77,0.28)', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)', letterSpacing: '0.04em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d      = i + 1
            const iso    = `${viewY}-${String(viewM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const state  = getDayState(iso)
            const isToday = iso === todayISO

            const clickable = state !== 'unavailable' && state !== 'blocked'

            let bg       = 'transparent'
            let color    = '#0A2E4D'
            let fw       = isToday ? 700 : 400
            let border   = isToday ? '1.5px solid rgba(10,46,77,0.2)' : 'none'
            let opacity  = 1
            let textDeco = 'none'
            let titleTxt = ''

            switch (state) {
              case 'selected_single':
                bg = '#E67E50'; color = 'white'; fw = 700; border = 'none'; break
              case 'selected_start':
                bg = '#E67E50'; color = 'white'; fw = 700; border = 'none'; break
              case 'selected_end':
                bg = '#E67E50'; color = 'white'; fw = 700; border = 'none'; break
              case 'in_range':
                bg = 'rgba(230,126,80,0.15)'; color = '#8B3800'; fw = 500; border = 'none'; break
              case 'pending_start':
                bg = '#0A2E4D'; color = 'white'; fw = 700; border = 'none'; break
              case 'pending_range':
                bg = 'rgba(10,46,77,0.09)'; color = '#0A2E4D'; fw = 500; border = 'none'; break
              case 'blocked':
                bg = 'rgba(239,68,68,0.06)'; color = 'rgba(239,68,68,0.5)'; opacity = 0.85
                textDeco = 'line-through'; border = 'none'
                titleTxt = 'Guide is unavailable on this date'
                break
              case 'unavailable':
                color = 'rgba(10,46,77,0.2)'; opacity = 0.4; border = 'none'; break
            }

            return (
              <button
                key={iso}
                type="button"
                disabled={disabled || !clickable}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => { if (!disabled && pendingFrom != null) setHovered(iso) }}
                onMouseLeave={() => setHovered(null)}
                title={titleTxt || undefined}
                aria-label={iso}
                style={{
                  background:     bg,
                  color,
                  fontWeight:     fw,
                  borderRadius:   '7px',
                  border,
                  cursor:         (!clickable || disabled) ? 'default' : 'pointer',
                  fontSize:       '13px',
                  fontFamily:     'var(--font-dm-sans, DM Sans, sans-serif)',
                  padding:        '7px 0',
                  width:          '100%',
                  textAlign:      'center',
                  lineHeight:     1,
                  transition:     'background 0.1s',
                  opacity,
                  textDecoration: textDeco,
                }}
              >
                {d}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {(([
            { bg: '#E67E50',                      label: 'Selected'     },
            { bg: 'rgba(230,126,80,0.2)',          label: 'In range'     },
            { bg: 'rgba(239,68,68,0.15)',          label: 'Closed',        strike: true },
            { bg: 'rgba(10,46,77,0.15)',           label: 'Not available'              },
          ]) as { bg: string; label: string; strike?: true }[]).map(({ bg, label, strike }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: bg }} />
              <span
                className={`text-[10px] f-body ${strike ? 'line-through' : ''}`}
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contextual hint ─────────────────────────────────────────── */}
      {pendingFrom != null ? (
        <p className="text-[11px] f-body mt-2 font-medium" style={{ color: '#E67E50' }}>
          {new Date(pendingFrom + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} selected — now click your end date
        </p>
      ) : (
        <p className="text-[11px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {pickMode === 'single'
            ? 'Click any open day. Click again to remove. Add as many separate days as you like.'
            : periods.length > 0
              ? 'Click to add another range, or remove periods below.'
              : 'Click your start date, then click your end date.'
          }
        </p>
      )}

      {/* ── Selected periods chips ──────────────────────────────────── */}
      {periods.length > 0 && (
        <div className="mt-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest f-body mb-2"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            {periods.length} period{periods.length === 1 ? '' : 's'} · {totalDays} day{totalDays === 1 ? '' : 's'} total
          </p>
          <div className="flex flex-wrap gap-1.5">
            {periods.map((p, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1.5 rounded-full"
                style={{
                  background: 'rgba(10,46,77,0.06)',
                  color:      '#0A2E4D',
                  border:     '1px solid rgba(10,46,77,0.12)',
                }}
              >
                {fmtPeriod(p)}
                <button
                  type="button"
                  onClick={() => onChange(periods.filter((_, i) => i !== idx))}
                  disabled={disabled}
                  aria-label={`Remove ${fmtPeriod(p)}`}
                  style={{
                    lineHeight: 1, fontSize: '14px',
                    color: 'rgba(10,46,77,0.4)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  ×
                </button>
              </span>
            ))}

            {/* Clear all */}
            <button
              type="button"
              onClick={() => { onChange([]); setPendingFrom(null); setHovered(null) }}
              disabled={disabled}
              className="text-[11px] f-body px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-70"
              style={{
                background: 'transparent',
                color:      'rgba(10,46,77,0.35)',
                border:     '1px solid rgba(10,46,77,0.1)',
                cursor:     disabled ? 'not-allowed' : 'pointer',
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCss: React.CSSProperties = {
  width: '100%', background: 'white',
  border: '1px solid rgba(10,46,77,0.14)', borderRadius: '12px',
  padding: '12px 14px', color: '#0A2E4D', fontSize: '14px',
  outline: 'none', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
}

const labelCss: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(10,46,77,0.4)', marginBottom: '8px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCalendar({ size = 15 }: { size?: number }) {
  return <Calendar size={size} strokeWidth={1.5} />
}

function IconPeople({ size = 15 }: { size?: number }) {
  return <Users size={size} strokeWidth={1.5} />
}

function IconSliders({ size = 15 }: { size?: number }) {
  return <SlidersHorizontal size={size} strokeWidth={1.5} />
}

function IconNotes({ size = 15 }: { size?: number }) {
  return <FileText size={size} strokeWidth={1.5} />
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Generic 3-column card selector
function CardSelect<T extends string>({
  options, value, onChange, disabled, cols = 3,
}: {
  options:  { value: T; label: string; sub: string }[]
  value:    T | ''
  onChange: (v: T) => void
  disabled?: boolean
  cols?:    2 | 3
}) {
  return (
    <div className={cols === 2 ? 'grid grid-cols-2 gap-2 items-start' : 'grid grid-cols-3 gap-2 items-start'}>
      {options.map(opt => {
        const on = value === opt.value
        return (
          <button
            key={opt.value} type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className="flex flex-col items-start px-3 py-2.5 rounded-xl transition-all text-left"
            style={{
              background: on ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.03)',
              border: on ? '1.5px solid rgba(10,46,77,0.25)' : '1px solid rgba(10,46,77,0.08)',
              cursor: disabled === true ? 'not-allowed' : 'pointer',
            }}
          >
            <span className="text-[12px] font-bold f-body leading-snug"
              style={{ color: on ? '#0A2E4D' : 'rgba(10,46,77,0.5)' }}>
              {opt.label}
            </span>
            <span className="text-[10px] f-body mt-0.5 leading-tight"
              style={{ color: 'rgba(10,46,77,0.35)' }}>
              {opt.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Numeric stepper
function Stepper({
  value, onChange, min = 1, max = 50, disabled, suffix,
}: {
  value: number; onChange: (v: number) => void
  min?: number; max?: number; disabled?: boolean; suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled === true || value <= min}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
        style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D', border: 'none',
          cursor: disabled === true || value <= min ? 'not-allowed' : 'pointer',
          opacity: value <= min ? 0.35 : 1 }}>
        &minus;
      </button>
      <span className="text-xl font-bold f-display w-10 text-center" style={{ color: '#0A2E4D' }}>
        {value}
      </span>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled === true || value >= max}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
        style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D', border: 'none',
          cursor: disabled === true || value >= max ? 'not-allowed' : 'pointer',
          opacity: value >= max ? 0.35 : 1 }}>
        +
      </button>
      {suffix != null && (
        <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{suffix}</span>
      )}
    </div>
  )
}

// Tab bar
function TabBar({
  activeTab, onSelect, errorTabs, filledTabs, disabled,
}: {
  activeTab:  TabKey
  onSelect:   (t: TabKey) => void
  errorTabs:  Partial<Record<TabKey, boolean>>
  filledTabs: Partial<Record<TabKey, boolean>>
  disabled:   boolean
}) {
  const icons: Record<TabKey, React.ReactNode> = {
    trip:   <IconCalendar />,
    group:  <IconPeople  />,
    needs:  <IconSliders />,
    extras: <IconNotes   />,
  }
  return (
    <div
      className="rounded-2xl p-1 grid grid-cols-4 gap-1"
      style={{ background: 'rgba(10,46,77,0.055)' }}
    >
      {TABS.map(tab => {
        const active  = activeTab === tab.key
        const hasErr  = errorTabs[tab.key]  === true
        const hasFill = filledTabs[tab.key] === true
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => !disabled && onSelect(tab.key)}
            style={{
              background:   active ? 'white' : 'transparent',
              border:       'none',
              borderRadius: '14px',
              padding:      '9px 4px',
              cursor:       disabled ? 'not-allowed' : 'pointer',
              boxShadow:    active ? '0 1px 6px rgba(10,46,77,0.1)' : 'none',
              transition:   'all 0.15s',
              position:     'relative',
            }}
          >
            {/* Error dot */}
            {hasErr && (
              <span style={{
                position: 'absolute', top: 6, right: 8,
                width: 6, height: 6, borderRadius: '50%',
                background: '#EF4444',
                display: 'block',
              }} />
            )}
            {/* Filled dot */}
            {!hasErr && hasFill && (
              <span style={{
                position: 'absolute', top: 6, right: 8,
                width: 6, height: 6, borderRadius: '50%',
                background: '#059669',
                display: 'block',
              }} />
            )}
            <div className="flex flex-col items-center gap-1">
              <span style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.38)', lineHeight: 0 }}>
                {icons[tab.key]}
              </span>
              <span
                className="f-body"
                style={{
                  fontSize:   '11px',
                  fontWeight: active ? 700 : 500,
                  color:      active ? '#0A2E4D' : 'rgba(10,46,77,0.4)',
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Tab section title
function TabHeading({ title, subtitle, help }: { title: string; subtitle?: string; help?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
          {title}
        </h3>
        {help}
      </div>
      {subtitle != null && (
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Direct-mode package helpers ─────────────────────────────────────────────

function fmtPkgPrice(opt: DurationOptionPayload): string {
  if (opt.pricing_type === 'per_boat') return `€${opt.price_eur} flat`
  if (opt.pricing_type === 'per_group') {
    const prices = opt.group_prices
      ? Object.values(opt.group_prices).filter((v): v is number => typeof v === 'number')
      : [opt.price_eur]
    return `from €${Math.min(...prices)}/group`
  }
  return `€${opt.price_eur}/pp`
}

function fmtPkgDuration(opt: DurationOptionPayload): string {
  if (opt.days != null && opt.days >= 1) return `${opt.days} day${opt.days > 1 ? 's' : ''}`
  if (opt.hours != null) return `~${opt.hours}h`
  return ''
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InquireForm({
  experienceId,
  guideId,
  prefilledDates,
  prefilledPeriods,
  prefilledGroup,
  anglerName,
  anglerEmail,
  formConfig: rawConfig,
  availabilityConfig,
  blockedDates = [],
  fishTypes,
  isDirectMode = false,
  durationOptions = [],
}: Props) {
  const cfg = resolveFormConfig(rawConfig)

  const availableSpecies =
    (fishTypes?.length ?? 0) > 0 ? fishTypes! : SPECIES_OPTIONS

  const isRequired = (key: keyof InquiryFormConfig) => cfg[key] === 'required'
  const isVisible  = (key: keyof InquiryFormConfig) => cfg[key] !== 'hidden'

  const [isPending, startTransition] = useTransition()
  const [done,      setDone]         = useState(false)
  const [error,     setError]        = useState<string | null>(null)

  // Tab state
  const [activeTab,  setActiveTab]  = useState<TabKey>('trip')
  const [errorTabs,  setErrorTabs]  = useState<Partial<Record<TabKey, boolean>>>({})

  const isLoggedIn = anglerName != null && anglerEmail != null

  // ── Identity
  const [name,  setName]  = useState(anglerName  ?? '')
  const [email, setEmail] = useState(anglerEmail ?? '')

  // ── Trip type & duration
  const [durationType,        setDurationType]        = useState<DurationType>('full_day')
  const [numDays,             setNumDays]             = useState(3)
  // Direct-mode: selected guide package label (null = nothing picked yet)
  const [selectedPackageLabel, setSelectedPackageLabel] = useState<string | null>(null)

  // When a guide package is selected, derive durationType + numDays automatically
  function handlePackageSelect(opt: DurationOptionPayload) {
    setSelectedPackageLabel(opt.label)
    if (opt.days != null && opt.days >= 2) {
      setDurationType('multi_day')
      setNumDays(opt.days)
    } else if (opt.hours != null && opt.hours <= 5) {
      setDurationType('half_day')
    } else {
      setDurationType('full_day')
    }
  }

  // ── Multi-period date selection (replaces single from/to range)
  // prefilledPeriods (from ?periods= param) takes priority over prefilledDates
  const [periods, setPeriods] = useState<Period[]>(() => {
    if (prefilledPeriods && prefilledPeriods.length > 0) return prefilledPeriods
    const valid = prefilledDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    return valid.map(d => ({ from: d, to: d }))
  })

  // ── Group
  const [group,        setGroup]        = useState(prefilledGroup)
  const [hasBeginners, setHasBeginners] = useState(false)
  const [hasChildren,  setHasChildren]  = useState(false)

  // ── Species
  const [species, setSpecies] = useState<string[]>([])

  // ── Pricing fields
  const [level,         setLevel]         = useState<'beginner' | 'intermediate' | 'expert'>('intermediate')
  const [gearNeeded,    setGearNeeded]    = useState<GearOption | ''>('')
  const [accommodation, setAccommodation] = useState<AccommodationOption | ''>('')
  const [transport,     setTransport]     = useState<TransportOption | ''>('')
  const [boatPref,      setBoatPref]      = useState('')
  const [dietary,       setDietary]       = useState('')

  // ── Extras
  const [stayingAt,          setStayingAt]          = useState('')
  const [photographyPackage, setPhotographyPackage] = useState<boolean | null>(null)
  const [regionExperience,   setRegionExperience]   = useState('')
  const [budgetMin,          setBudgetMin]          = useState('')
  const [budgetMax,          setBudgetMax]          = useState('')
  const [notes,              setNotes]              = useState('')

  // ── Computed: which tabs have any data entered
  const filledTabs: Partial<Record<TabKey, boolean>> = {
    trip:   periods.length > 0,
    group:  species.length > 0,
    needs:  !!(gearNeeded || accommodation || transport || boatPref || dietary),
    extras: !!(photographyPackage !== null || stayingAt || notes || budgetMin || budgetMax),
  }

  // ── Toggle helpers
  function toggleSpecies(s: string) {
    setSpecies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }


  // ── Per-tab validation (called by Continue button)
  function validateCurrentTab(): string | null {
    switch (activeTab) {
      case 'trip':
        if (periods.length === 0) return 'Please select at least one date or date range.'
        return null
      case 'group':
        if (species.length === 0) return 'Please select at least one target species.'
        return null
      case 'needs':
        if (isRequired('gear')           && !gearNeeded)       return 'Please select your gear situation.'
        if (isRequired('accommodation')  && !accommodation)    return 'Please select your accommodation needs.'
        if (isRequired('transport')      && !transport)        return 'Please select your transport preference.'
        if (isRequired('boatPreference') && !boatPref.trim())  return 'Please describe your boat preference.'
        if (isRequired('dietary')        && !dietary.trim())   return 'Please enter any dietary requirements.'
        return null
      case 'extras':
        return null
    }
  }

  // ── Continue (advances to next tab after per-tab validation)
  function handleContinue() {
    setError(null)
    const msg = validateCurrentTab()
    if (msg != null) {
      setError(msg)
      setErrorTabs(prev => ({ ...prev, [activeTab]: true }))
      return
    }
    setErrorTabs(prev => ({ ...prev, [activeTab]: false }))
    const next = TABS.find(t => t.key === activeTab)?.next
    if (next != null) setActiveTab(next)
  }

  // ── Submit
  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    if (!isLoggedIn && (!name.trim() || !email.trim())) {
      setError('Please enter your name and email.')
      return
    }

    // Validate dates + compute envelope range from all selected periods
    let datesFrom = ''
    let datesTo   = ''
    const nextErrorTabs: Partial<Record<TabKey, boolean>> = {}

    if (periods.length === 0) {
      nextErrorTabs.trip = true
    } else {
      // datesFrom = earliest start, datesTo = latest end across all periods
      const allFrom = periods.map(p => p.from).sort()
      const allTo   = periods.map(p => p.to).sort()
      datesFrom = allFrom[0]
      datesTo   = allTo[allTo.length - 1]
    }

    if (species.length === 0)                                              nextErrorTabs.group  = true
    if (isRequired('gear')          && !gearNeeded)                       nextErrorTabs.needs  = true
    if (isRequired('accommodation') && !accommodation)                    nextErrorTabs.needs  = true
    if (isRequired('transport')     && !transport)                        nextErrorTabs.needs  = true
    if (isRequired('boatPreference') && !boatPref.trim())                 nextErrorTabs.needs  = true
    if (isRequired('dietary')       && !dietary.trim())                   nextErrorTabs.needs  = true
    if (isRequired('stayingAt')     && !stayingAt.trim())                 nextErrorTabs.extras = true

    if (isRequired('photography')   && photographyPackage === null)       nextErrorTabs.extras = true
    if (isRequired('regionExperience') && !regionExperience.trim())       nextErrorTabs.extras = true
    if (isRequired('budget')        && !budgetMin && !budgetMax)          nextErrorTabs.extras = true
    if (isRequired('notes')         && !notes.trim())                     nextErrorTabs.extras = true

    if (Object.keys(nextErrorTabs).length > 0) {
      setErrorTabs(nextErrorTabs)
      // Navigate to the first errored tab
      const firstErr = TABS.find(t => nextErrorTabs[t.key])
      if (firstErr) setActiveTab(firstErr.key)
      setError('Please fill in all required fields.')
      return
    }

    setErrorTabs({})

    startTransition(async () => {
      const result = await submitInquiry({
        anglerName:      name.trim(),
        anglerEmail:     email.trim(),
        datesFrom,
        datesTo,
        targetSpecies:   species,
        experienceLevel: level,
        groupSize:       group,
        preferences: {
          durationType,
          numDays:             durationType === 'multi_day' ? numDays : undefined,
          hasBeginners:        hasBeginners  || undefined,
          hasChildren:         hasChildren   || undefined,
          gearNeeded:          gearNeeded    || undefined,
          accommodation:       accommodation || undefined,
          transport:           transport     || undefined,
          boatPreference:      boatPref.trim()           || undefined,
          dietaryRestrictions: dietary.trim()            || undefined,
          stayingAt:           stayingAt.trim()          || undefined,
          photographyPackage:  photographyPackage ?? undefined,
          regionExperience:    regionExperience.trim()   || undefined,
          budgetMin:           budgetMin ? Number(budgetMin) : undefined,
          budgetMax:           budgetMax ? Number(budgetMax) : undefined,
          notes:               notes.trim()              || undefined,
          // Full period selection preserved — used by server to expand into
          // individual requested_dates (prevents envelope problem).
          allDatePeriods:      periods.length > 0 ? periods : undefined,
          // Direct-mode: which of the guide's packages the angler selected
          selectedPackageLabel: selectedPackageLabel ?? undefined,
        },
        guideId:      guideId      ?? undefined,
        // Pin inquiry to the trip it was started from — scopes calendar blocking
        // to the right calendar and shows trip details on the angler's booking page.
        experienceId: experienceId ?? undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }
      setDone(true)
    })
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div
        className="rounded-2xl p-8 text-center flex flex-col items-center gap-4"
        style={{ background: 'white', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(5,150,105,0.1)' }}>
          <Check size={24} strokeWidth={2} style={{ color: '#059669' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
            Request sent!
          </h2>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            The guide will review your request and get back to you within 24 hours.
          </p>
        </div>
        <a href={isLoggedIn ? '/account/trips' : '/'}
          className="text-sm font-semibold f-body mt-2" style={{ color: '#E67E50' }}>
          {isLoggedIn ? 'View my requests \u2192' : 'Back to home \u2192'}
        </a>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  const nextTab = TABS.find(t => t.key === activeTab)?.next ?? null
  const prevTab = [...TABS].reverse().find(t => t.next === activeTab)?.key ?? null

  return (
    <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-4">

      {/* ── Identity ─────────────────────────────────────────────────── */}
      {isLoggedIn ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold f-body flex-shrink-0"
            style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>{name}</p>
            <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>{email}</p>
          </div>
          <a href="/login" className="text-[11px] font-semibold f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.4)' }}>Not you?</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelCss} className="f-body flex items-center gap-1">
              Your name *
              <FieldTooltip text="Sent to the guide with your inquiry so they know who to reply to." />
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="John Smith" required disabled={isPending}
              style={inputCss} className="f-body" />
          </div>
          <div>
            <label style={labelCss} className="f-body flex items-center gap-1">
              Email *
              <FieldTooltip text="The guide's reply and any updates are sent to this address." />
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required disabled={isPending}
              style={inputCss} className="f-body" />
          </div>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <TabBar
        activeTab={activeTab}
        onSelect={t => { setActiveTab(t); setError(null) }}
        errorTabs={errorTabs}
        filledTabs={filledTabs}
        disabled={isPending}
      />

      {/* ── Tab content card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background:  'white',
          border:      errorTabs[activeTab] === true
            ? '1.5px solid rgba(239,68,68,0.25)'
            : '1px solid rgba(10,46,77,0.07)',
          minHeight:   '300px',
        }}
      >

        {/* ───── TAB: Trip ─────────────────────────────────────────── */}
        {activeTab === 'trip' && (
          <>
            <TabHeading
              title="When do you want to fish?"
              subtitle="Tell us the timing &mdash; we'll handle the rest."
              help={
                <HelpWidget
                  title="Trip tab — timing"
                  description="Tell the guide when you'd like to come. You can select multiple periods if your dates are flexible."
                  items={[
                    { icon: '🕐', title: 'Trip type', text: 'Half day (~4h), full day (~8h), or multi-day. Guides price these differently.' },
                    { icon: '📅', title: 'Preferred dates', text: 'Select specific days or ranges. You can add multiple separate periods — the guide picks the best fit.' },
                    { icon: '🔄', title: 'Flexible dates', text: 'If you can come any time in a month, just select the whole month as a range. The guide will confirm exact dates.' },
                  ]}
                />
              }
            />

            {/* ── Trip / Package picker ────────────────────────────────────── */}
            {isDirectMode && durationOptions.length > 0 ? (
              /* Direct mode — show the guide's real packages */
              <div>
                <label style={labelCss} className="f-body">
                  Which package interests you?
                  <span style={{ color: 'rgba(10,46,77,0.35)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
                    (optional — ask anything even without picking)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 items-start">
                  {durationOptions.map((opt, i) => {
                    const on  = selectedPackageLabel === opt.label
                    const dur = fmtPkgDuration(opt)
                    const prc = fmtPkgPrice(opt)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => on ? setSelectedPackageLabel(null) : handlePackageSelect(opt)}
                        disabled={isPending}
                        className="flex flex-col items-start px-3.5 py-3 rounded-xl transition-all text-left"
                        style={{
                          background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                          border:     on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                          cursor:     isPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span className="text-[13px] font-bold f-body leading-snug"
                          style={{ color: on ? 'white' : '#0A2E4D' }}>
                          {opt.label || `Option ${i + 1}`}
                        </span>
                        {dur !== '' && (
                          <span className="text-[10px] f-body mt-0.5"
                            style={{ color: on ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.4)' }}>
                            {dur}
                          </span>
                        )}
                        <span className="text-[12px] font-semibold f-body mt-1"
                          style={{ color: on ? 'rgba(255,255,255,0.85)' : '#E67E50' }}>
                          {prc}
                        </span>
                        {opt.includes_lodging && (
                          <span className="text-[9px] font-bold uppercase tracking-wider f-body mt-1.5 px-1.5 py-0.5 rounded-md"
                            style={{ background: on ? 'rgba(255,255,255,0.12)' : 'rgba(5,150,105,0.1)', color: on ? 'rgba(255,255,255,0.7)' : '#059669' }}>
                            incl. lodging
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : isVisible('tripType') ? (
              /* Standard mode — generic half / full / multi-day picker */
              <div>
                <label style={labelCss} className="f-body">
                  Trip type{isRequired('tripType') && ' *'}
                </label>
                <div className="grid grid-cols-3 gap-2 items-start">
                  {DURATION_OPTIONS.map(opt => {
                    const on = durationType === opt.value
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setDurationType(opt.value)}
                        disabled={isPending}
                        className="flex flex-col items-start px-3 py-3 rounded-xl transition-all"
                        style={{
                          background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                          border: on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                          cursor: isPending ? 'not-allowed' : 'pointer',
                        }}>
                        <span className="text-[13px] font-bold f-body"
                          style={{ color: on ? 'white' : '#0A2E4D' }}>
                          {opt.label}
                        </span>
                        <span className="text-[10px] f-body mt-0.5"
                          style={{ color: on ? 'rgba(255,255,255,0.55)' : 'rgba(10,46,77,0.4)' }}>
                          {opt.sub}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Days stepper — only in standard mode, shown as a highlighted callout */}
            {!isDirectMode && isVisible('numDays') && durationType === 'multi_day' && (
              <div
                className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
                style={{
                  background: 'rgba(230,126,80,0.07)',
                  border:     '1.5px solid rgba(230,126,80,0.22)',
                }}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] font-bold f-body mb-3"
                     style={{ color: 'rgba(230,126,80,0.7)' }}>
                    How many fishing days?{isRequired('numDays') && ' *'}
                  </p>
                  <Stepper value={numDays} onChange={setNumDays} min={2} max={21}
                    disabled={isPending} suffix={numDays === 1 ? 'day' : 'days'} />
                </div>
                <span style={{ fontSize: 36, lineHeight: 1, opacity: 0.45, flexShrink: 0 }}>🎣</span>
              </div>
            )}

            {/* Preferred dates — multi-period picker */}
            <div>
              <label style={labelCss} className="f-body">
                Preferred dates *
                <span style={{ color: 'rgba(10,46,77,0.35)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
                  (pick single days, ranges, or multiple periods)
                </span>
              </label>
              <MultiPeriodPicker
                periods={periods}
                onChange={setPeriods}
                availabilityConfig={availabilityConfig}
                blockedDates={blockedDates}
                disabled={isPending}
              />
            </div>
          </>
        )}

        {/* ───── TAB: Group ────────────────────────────────────────── */}
        {activeTab === 'group' && (
          <>
            <TabHeading
              title="Who's coming?"
              subtitle="Group size and what you're targeting."
              help={
                <HelpWidget
                  title="Group tab — who's fishing"
                  description="Tell the guide about your group so they can tailor the trip and price it accurately."
                  items={[
                    { icon: '👥', title: 'Group size', text: 'Count everyone who will hold a rod. Guides price per person (or per boat for some packages).' },
                    { icon: '🐠', title: 'Target species', text: 'What fish are you after? The guide prepares the right gear, techniques, and locations based on your preference.' },
                    { icon: '🎣', title: 'Experience level', text: 'Be honest — guides adapt their coaching and pacing to match your skill. Beginners are always welcome.' },
                    { icon: '👶', title: 'Beginners / children', text: 'Check these if applicable — guides may need to bring lighter gear or adapt safety measures.' },
                  ]}
                />
              }
            />

            {/* Group size */}
            <div>
              <label style={labelCss} className="f-body flex items-center gap-1">
                Group size *
                <FieldTooltip text="Count every person who will be fishing, including children." />
              </label>
              <div className="mb-3">
                <Stepper value={group} onChange={setGroup} min={1} max={50}
                  disabled={isPending} suffix={group === 1 ? 'person' : 'people'} />
              </div>
              {isVisible('groupComposition') && (
                <div className="flex flex-wrap gap-4">
                  {([
                    { value: hasBeginners, set: setHasBeginners, label: 'Includes beginners' },
                    { value: hasChildren,  set: setHasChildren,  label: 'Includes children'  },
                  ] as const).map(({ value, set, label }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={value}
                        onChange={e => set(e.target.checked)}
                        disabled={isPending}
                        style={{ accentColor: '#0A2E4D', width: 16, height: 16, cursor: 'pointer' }} />
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Target species */}
            <div>
              <label style={labelCss} className="f-body">Target species *</label>
              <div className="flex flex-wrap gap-2">
                {availableSpecies.map(s => {
                  const on = species.includes(s)
                  return (
                    <button key={s} type="button"
                      onClick={() => toggleSpecies(s)}
                      disabled={isPending}
                      className="text-xs font-semibold f-body px-3 py-1.5 rounded-full transition-all"
                      style={{
                        background: on ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
                        color:      on ? 'white'   : 'rgba(10,46,77,0.6)',
                        border:     on ? '1px solid transparent' : '1px solid rgba(10,46,77,0.1)',
                        cursor:     isPending ? 'not-allowed' : 'pointer',
                      }}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Experience level */}
            {isVisible('experienceLevel') && (
              <div>
                <label style={labelCss} className="f-body">
                  Fishing experience{isRequired('experienceLevel') && ' *'}
                </label>
                <div className="grid grid-cols-3 gap-2 items-start">
                  {([
                    { value: 'beginner'     as const, label: 'Beginner',     desc: 'New to fishing'  },
                    { value: 'intermediate' as const, label: 'Intermediate', desc: '2–5 years'       },
                    { value: 'expert'       as const, label: 'Expert',       desc: '5+ years'        },
                  ]).map(opt => {
                    const on = level === opt.value
                    return (
                      <button key={opt.value} type="button" onClick={() => setLevel(opt.value)}
                        disabled={isPending}
                        className="flex flex-col items-start px-3 py-2.5 rounded-xl transition-all text-left"
                        style={{
                          background: on ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.03)',
                          border: on ? '1.5px solid rgba(10,46,77,0.25)' : '1px solid rgba(10,46,77,0.08)',
                          cursor: isPending ? 'not-allowed' : 'pointer',
                        }}>
                        <span className="text-[12px] font-bold f-body"
                          style={{ color: on ? '#0A2E4D' : 'rgba(10,46,77,0.5)' }}>
                          {opt.label}
                        </span>
                        <span className="text-[10px] f-body mt-0.5"
                          style={{ color: 'rgba(10,46,77,0.38)' }}>
                          {opt.desc}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ───── TAB: Needs ────────────────────────────────────────── */}
        {activeTab === 'needs' && (
          <>
            <TabHeading
              title="What will you need?"
              subtitle="Helps the guide prepare an accurate offer."
              help={
                <HelpWidget
                  title="Needs tab — logistics"
                  description="These details help the guide price and prepare your offer accurately. All fields marked optional can be skipped."
                  items={[
                    { icon: '🎣', title: 'Gear & tackle', text: 'Do you bring your own rods and lures, or do you need the guide to provide everything?' },
                    { icon: '🏠', title: 'Accommodation', text: 'Some guides offer lodge or cabin packages. Select "Just guiding" if you have your own place to stay.' },
                    { icon: '🚗', title: 'Transport', text: 'Do you need the guide to pick you up, or will you drive yourself to the meeting point?' },
                    { icon: '⛵', title: 'Boat preference', text: 'Open boat, inflatable, motorised — if you have a preference or requirement, mention it here.' },
                    { icon: '🥗', title: 'Dietary needs', text: 'If your guide provides lunch or snacks, let them know about any dietary restrictions or allergies.' },
                  ]}
                />
              }
            />

            {(['gear', 'accommodation', 'transport', 'boatPreference', 'dietary'] as const)
              .every(k => !isVisible(k)) ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
                <CheckCircle size={32} strokeWidth={1.5} style={{ color: '#059669' }} />
                <p className="text-sm font-semibold f-body" style={{ color: '#059669' }}>
                  Nothing to fill here
                </p>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  This guide hasn&apos;t requested logistics info. Continue to Extras.
                </p>
              </div>
            ) : (
              <>
                {isVisible('gear') && (
                  <div>
                    <label style={labelCss} className="f-body">
                      Gear & tackle{isRequired('gear') && ' *'}
                    </label>
                    <CardSelect options={GEAR_OPTIONS} value={gearNeeded}
                      onChange={setGearNeeded} disabled={isPending} />
                  </div>
                )}
                {isVisible('accommodation') && (
                  <div>
                    <label style={labelCss} className="f-body">
                      Accommodation{isRequired('accommodation') && ' *'}
                    </label>
                    <CardSelect options={ACCOMMODATION_OPTIONS} value={accommodation}
                      onChange={setAccommodation} disabled={isPending} />
                  </div>
                )}
                {isVisible('transport') && (
                  <div>
                    <label style={labelCss} className="f-body">
                      Transport{isRequired('transport') && ' *'}
                    </label>
                    <CardSelect options={TRANSPORT_OPTIONS} value={transport}
                      onChange={setTransport} disabled={isPending} />
                  </div>
                )}
                {isVisible('boatPreference') && (
                  <div>
                    <label style={labelCss} className="f-body">
                      Boat preference
                      {isRequired('boatPreference') ? ' *' : (
                        <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                      )}
                    </label>
                    <input value={boatPref} onChange={e => setBoatPref(e.target.value)}
                      placeholder="e.g. open boat, inflatable, no preference…"
                      disabled={isPending} style={inputCss} className="f-body" />
                  </div>
                )}
                {isVisible('dietary') && (
                  <div>
                    <label style={labelCss} className="f-body">
                      Dietary & lunch
                      {isRequired('dietary') ? ' *' : (
                        <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                      )}
                    </label>
                    <input value={dietary} onChange={e => setDietary(e.target.value)}
                      placeholder="e.g. vegetarian, nut allergy, no shellfish…"
                      disabled={isPending} style={inputCss} className="f-body" />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ───── TAB: Extras ───────────────────────────────────────── */}
        {activeTab === 'extras' && (
          <>
            <TabHeading
              title="Anything else to know?"
              subtitle="Optional details that help personalise your experience."
              help={
                <HelpWidget
                  title="Extras tab — personalisation"
                  description="All optional. These details help the guide personalise your experience and prepare a more accurate offer."
                  items={[
                    { icon: '📸', title: 'Photography / video', text: 'If the guide offers a photography add-on, they can arrange a photographer or film your catches.' },
                    { icon: '🏨', title: 'Where are you staying?', text: 'Helps the guide suggest nearby rivers, plan pickup logistics, or tailor local recommendations.' },
                    { icon: '💶', title: 'Budget range', text: 'If you have a specific budget in mind, share it — the guide can customise the package accordingly.' },
                    { icon: '📝', title: 'Notes', text: 'Anything else the guide should know: specific techniques, health considerations, language preference, etc.' },
                  ]}
                />
              }
            />


            {isVisible('photography') && (
              <div>
                <label style={labelCss} className="f-body">
                  Photography / video?{isRequired('photography') && ' *'}
                </label>
                <CardSelect
                  options={[
                    { value: 'yes' as const, label: 'Yes, interested', sub: 'Photos & video of the trip' },
                    { value: 'no'  as const, label: 'No thanks',       sub: 'Not needed'                 },
                  ]}
                  value={photographyPackage === true ? 'yes' : photographyPackage === false ? 'no' : ''}
                  onChange={v => setPhotographyPackage(v === 'yes')}
                  disabled={isPending} cols={2}
                />
              </div>
            )}

            {isVisible('stayingAt') && (
              <div>
                <label style={labelCss} className="f-body">
                  Where are you staying?
                  {isRequired('stayingAt') ? ' *' : (
                    <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                  )}
                </label>
                <input value={stayingAt} onChange={e => setStayingAt(e.target.value)}
                  placeholder="Hotel name, town or area…"
                  disabled={isPending} style={inputCss} className="f-body" />
              </div>
            )}

            {isVisible('regionExperience') && (
              <div>
                <label style={labelCss} className="f-body">
                  Previous experience in region?
                  {isRequired('regionExperience') ? ' *' : (
                    <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                  )}
                </label>
                <input value={regionExperience} onChange={e => setRegionExperience(e.target.value)}
                  placeholder="e.g. first time in Norway, fished River Alta twice…"
                  disabled={isPending} style={inputCss} className="f-body" />
              </div>
            )}

            {isVisible('budget') && (
              <div>
                <label style={labelCss} className="f-body">
                  Budget (EUR)
                  {isRequired('budget') ? ' *' : (
                    <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ ...labelCss, marginBottom: '6px' }} className="f-body">Min</label>
                    <input type="number" min="0" value={budgetMin}
                      onChange={e => setBudgetMin(e.target.value)}
                      placeholder="e.g. 500" disabled={isPending} style={inputCss} className="f-body" />
                  </div>
                  <div>
                    <label style={{ ...labelCss, marginBottom: '6px' }} className="f-body">Max</label>
                    <input type="number" min="0" value={budgetMax}
                      onChange={e => setBudgetMax(e.target.value)}
                      placeholder="e.g. 2 000" disabled={isPending} style={inputCss} className="f-body" />
                  </div>
                </div>
              </div>
            )}

            {isVisible('notes') && (
              <div>
                <label style={labelCss} className="f-body">
                  Anything else for the guide?
                  {isRequired('notes') ? ' *' : (
                    <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
                  )}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional context, questions or special requests…"
                  rows={3} disabled={isPending}
                  style={{ ...inputCss, resize: 'vertical', minHeight: '80px' }}
                  className="f-body" />
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error != null && (
        <div className="rounded-xl px-4 py-3 text-sm f-body"
          style={{ background: 'rgba(220,38,38,0.07)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.12)' }}>
          {error}
        </div>
      )}

      {/* ── Navigation footer ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {prevTab != null && (
          <button
            type="button"
            onClick={() => { setActiveTab(prevTab); setError(null) }}
            disabled={isPending}
            className="py-4 px-5 rounded-2xl text-base font-bold f-body transition-all"
            style={{
              background: 'rgba(10,46,77,0.06)',
              color: '#0A2E4D',
              border: '1px solid rgba(10,46,77,0.1)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            ← Back
          </button>
        )}

        {activeTab === 'extras' ? (
          <button
            key="submit-btn"
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPending}
            className="flex-1 py-4 rounded-2xl text-base font-bold f-body transition-all"
            style={{
              background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
              color: 'white',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Sending\u2026' : 'Send request'}
          </button>
        ) : (
          <button
            key="continue-btn"
            type="button"
            onClick={handleContinue}
            disabled={isPending}
            className="flex-1 py-4 rounded-2xl text-base font-bold f-body transition-all"
            style={{
              background: '#0A2E4D',
              color: 'white',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Continue →
          </button>
        )}
      </div>

      <p className="text-xs text-center f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
        No payment required &middot; Guide responds within 24 hours
      </p>

    </form>
  )
}
