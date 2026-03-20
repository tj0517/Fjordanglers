'use client'

import { useState, useTransition } from 'react'
import { submitInquiry } from '@/actions/inquiries'
import { type InquiryFormConfig, resolveFormConfig } from '@/lib/inquiry-form-config'

// ─── Types ────────────────────────────────────────────────────────────────────

type DurationType        = 'half_day' | 'full_day' | 'multi_day'
type GearOption          = 'own' | 'need_some' | 'need_all'
type AccommodationOption = 'needed' | 'not_needed' | 'flexible'
type TransportOption     = 'need_pickup' | 'self_drive' | 'flexible'
type TabKey              = 'trip' | 'group' | 'needs' | 'extras'

type Props = {
  experienceId:   string
  guideId:        string | null
  prefilledDates: string[]
  prefilledGroup: number
  anglerName:     string | null
  anglerEmail:    string | null
  formConfig?:    Partial<InquiryFormConfig> | null
}

// ─── Tabs metadata ────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; next: TabKey | null }[] = [
  { key: 'trip',   label: 'Trip',   next: 'group'  },
  { key: 'group',  label: 'Group',  next: 'needs'  },
  { key: 'needs',  label: 'Needs',  next: 'extras' },
  { key: 'extras', label: 'Extras', next: null      },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
  'Salmon', 'Sea Trout', 'Brown Trout', 'Pike', 'Perch',
  'Arctic Char', 'Grayling', 'Halibut', 'Cod', 'Zander',
]


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

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  from,
  to,
  onChange,
  disabled = false,
}: {
  from:     string   // 'YYYY-MM-DD' or ''
  to:       string   // 'YYYY-MM-DD' or ''
  onChange: (from: string, to: string) => void
  disabled?: boolean
}) {
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`

  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth()) // 0-indexed
  const [hovered,   setHovered]   = useState<string | null>(null)

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(dateStr: string) {
    if (disabled) return
    if (!from || (from && to)) {
      onChange(dateStr, '') // start new selection
    } else {
      // Complete selection — ensure from < to
      if (dateStr >= from) onChange(from, dateStr)
      else onChange(dateStr, from)
    }
  }

  // Effective end for hover preview (only forward ranges)
  const effectiveEnd = from && !to && hovered && hovered >= from ? hovered : to

  // Build day cells for current view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
  const offset      = (firstDow + 6) % 7                        // Mon=0
  const cells: (string | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const dayCount = from && to
    ? Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000) + 1
    : 0

  return (
    <div>
      {/* ── Selected range summary ───────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 px-3 py-2 rounded-xl"
          style={{
            background: from ? 'rgba(10,46,77,0.07)' : 'rgba(10,46,77,0.03)',
            border: `1px solid ${from ? 'rgba(10,46,77,0.18)' : 'rgba(10,46,77,0.08)'}`,
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest f-body block"
            style={{ color: 'rgba(10,46,77,0.35)' }}>From</span>
          <span className="text-[12px] font-semibold f-body"
            style={{ color: from ? '#0A2E4D' : 'rgba(10,46,77,0.25)' }}>
            {from ? fmtDate(from) : '—'}
          </span>
        </div>

        <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: '16px', flexShrink: 0 }}>→</span>

        <div
          className="flex-1 px-3 py-2 rounded-xl"
          style={{
            background: to ? 'rgba(10,46,77,0.07)' : 'rgba(10,46,77,0.03)',
            border: `1px solid ${to ? 'rgba(10,46,77,0.18)' : 'rgba(10,46,77,0.08)'}`,
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest f-body block"
            style={{ color: 'rgba(10,46,77,0.35)' }}>To</span>
          <span className="text-[12px] font-semibold f-body"
            style={{ color: to ? '#0A2E4D' : 'rgba(10,46,77,0.25)' }}>
            {to ? fmtDate(to) : '—'}
          </span>
        </div>

        {(from || to) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            style={{
              width: 28, height: 28, borderRadius: '8px',
              background: 'rgba(10,46,77,0.06)', border: 'none',
              cursor: 'pointer', color: 'rgba(10,46,77,0.45)',
              fontSize: '16px', lineHeight: 1, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(10,46,77,0.025)', borderRadius: '16px', padding: '14px 16px 16px', border: '1px solid rgba(10,46,77,0.07)' }}>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth} disabled={disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ‹
          </button>
          <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
            {monthLabel}
          </span>
          <button type="button" onClick={nextMonth} disabled={disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ›
          </button>
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
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`pad-${idx}`} />

            const isPast    = dateStr < todayStr
            const isStart   = !!from && dateStr === from
            const isEnd     = !!to   && dateStr === to
            const inRange   = !!(from && effectiveEnd && dateStr > from && dateStr < effectiveEnd)
            const isPreview = !!(from && !to && hovered && dateStr === hovered && hovered >= from)
            const isToday   = dateStr === todayStr
            const dayNum    = parseInt(dateStr.split('-')[2], 10)

            let bg     = 'transparent'
            let color  = isPast ? 'rgba(10,46,77,0.2)' : '#0A2E4D'
            let fw     = isToday ? 700 : 400
            let border = 'none'

            if (isStart || isEnd) {
              bg = '#0A2E4D'; color = 'white'; fw = 700
            } else if (isPreview) {
              bg = 'rgba(10,46,77,0.22)'; fw = 600
            } else if (inRange) {
              bg = 'rgba(10,46,77,0.09)'
            } else if (isToday) {
              border = '1.5px solid rgba(10,46,77,0.25)'
            }

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled || isPast}
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => { if (!disabled && from && !to) setHovered(dateStr) }}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background:   bg,
                  color,
                  fontWeight:   fw,
                  borderRadius: '7px',
                  border,
                  cursor:       isPast || disabled ? 'default' : 'pointer',
                  fontSize:     '13px',
                  fontFamily:   'var(--font-dm-sans, DM Sans, sans-serif)',
                  padding:      '7px 0',
                  width:        '100%',
                  textAlign:    'center',
                  lineHeight:   1,
                  transition:   'background 0.1s',
                  opacity:      isPast ? 0.35 : 1,
                }}
              >
                {dayNum}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      <p className="text-[11px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
        {!from
          ? 'Click to select your start date'
          : !to
            ? 'Now click your end date'
            : `${dayCount} day${dayCount === 1 ? '' : 's'} selected`
        }
      </p>
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
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <line x1="5" y1="1.5" x2="5" y2="4.5" />
      <line x1="11" y1="1.5" x2="11" y2="4.5" />
      <line x1="2" y1="7" x2="14" y2="7" />
    </svg>
  )
}

function IconPeople({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13.5c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      <circle cx="12" cy="5" r="2" opacity="0.55" />
      <path d="M15 13.5c0-1.93-1.34-3.55-3.14-3.96" opacity="0.55" />
    </svg>
  )
}

function IconSliders({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="5"  cy="4"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="8"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7"  cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconNotes({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <polyline points="10,2 10,6 14,6" opacity="0.5" />
      <line x1="5" y1="9"  x2="11" y2="9"  />
      <line x1="5" y1="12" x2="9"  y2="12" />
    </svg>
  )
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
    <div className={cols === 2 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}>
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
function TabHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
        {title}
      </h3>
      {subtitle != null && (
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InquireForm({
  guideId,
  prefilledGroup,
  anglerName,
  anglerEmail,
  formConfig: rawConfig,
}: Props) {
  const cfg = resolveFormConfig(rawConfig)

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
  const [durationType,     setDurationType]     = useState<DurationType>('full_day')
  const [numDays,          setNumDays]          = useState(3)
  const [specificFrom, setSpecificFrom] = useState('')
  const [specificTo,   setSpecificTo]   = useState('')

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
    trip:   !!specificFrom && !!specificTo,
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
        if (!specificFrom || !specificTo) return 'Please select your preferred dates.'
        if (specificFrom > specificTo)    return 'Start date must be before end date.'
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
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isLoggedIn && (!name.trim() || !email.trim())) {
      setError('Please enter your name and email.')
      return
    }

    // Validate dates + compute range
    let datesFrom = ''
    let datesTo   = ''
    const nextErrorTabs: Partial<Record<TabKey, boolean>> = {}

    if (!specificFrom || !specificTo) {
      nextErrorTabs.trip = true
    } else if (specificFrom > specificTo) {
      nextErrorTabs.trip = true
    } else {
      datesFrom = specificFrom
      datesTo   = specificTo
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
        },
        guideId: guideId ?? undefined,
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

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
            <label style={labelCss} className="f-body">Your name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="John Smith" required disabled={isPending}
              style={inputCss} className="f-body" />
          </div>
          <div>
            <label style={labelCss} className="f-body">Email *</label>
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
            />

            {/* Trip type */}
            {isVisible('tripType') && (
              <div>
                <label style={labelCss} className="f-body">
                  Trip type{isRequired('tripType') && ' *'}
                </label>
                <div className="grid grid-cols-3 gap-2">
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
            )}

            {/* Days stepper */}
            {isVisible('numDays') && durationType === 'multi_day' && (
              <div>
                <label style={labelCss} className="f-body">
                  How many days?{isRequired('numDays') && ' *'}
                </label>
                <Stepper value={numDays} onChange={setNumDays} min={2} max={21}
                  disabled={isPending} suffix="days" />
              </div>
            )}

            {/* Preferred dates */}
            <div>
              <label style={labelCss} className="f-body">Preferred dates *</label>
              <DateRangePicker
                from={specificFrom}
                to={specificTo}
                onChange={(f, t) => { setSpecificFrom(f); setSpecificTo(t) }}
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
            />

            {/* Group size */}
            <div>
              <label style={labelCss} className="f-body">Group size *</label>
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
                {SPECIES_OPTIONS.map(s => {
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
                <div className="grid grid-cols-3 gap-2">
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
            />

            {(['gear', 'accommodation', 'transport', 'boatPreference', 'dietary'] as const)
              .every(k => !isVisible(k)) ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
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
            type="submit"
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
