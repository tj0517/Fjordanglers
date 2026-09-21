'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Search, X, CalendarDays, ChevronDown, List, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExternalOfferToggle } from './ExternalOfferToggle'
import { InquiriesCalendar } from './InquiriesCalendar'
import { STATUS_LABELS } from '@/lib/inquiries/state'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InquiryRow {
  id:                      string
  status:                  string
  angler_name:             string
  angler_email:            string
  angler_phone:            string | null
  requested_dates:         string[] | null
  party_size:              number
  created_at:              string
  trip_id:                 string | null
  experience_page_id:      string | null
  internal_commission_eur: number | null
  deal_currency:           string | null
  lost_reason:             string | null
  last_contact_at:         string | null
  next_action:             string | null
  assigned_guide_id:       string | null
  guide_acceptance:        string | null
  guide_decline_reason:    string | null
  external_offer_sent:     boolean
  offer_sent_at:           string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WARM_DAYS  = 2
const COLD_DAYS  = 3
const STALE_DAYS = 7

const ACTIVE_STATUSES = new Set([
  'new', 'qualifying', 'waiting_guide', 'offer_presented', 'awaiting_payment',
])

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:              { label: STATUS_LABELS.new,              color: '#92400E', bg: 'rgba(251,191,36,0.15)',  border: '1px solid rgba(251,191,36,0.4)'   },
  qualifying:       { label: STATUS_LABELS.qualifying,       color: '#5B21B6', bg: 'rgba(139,92,246,0.15)',  border: '1px solid rgba(139,92,246,0.35)'  },
  waiting_guide:    { label: STATUS_LABELS.waiting_guide,    color: '#C2410C', bg: 'rgba(234,88,12,0.12)',   border: '1px solid rgba(234,88,12,0.35)'   },
  offer_presented:  { label: STATUS_LABELS.offer_presented,  color: '#0E7490', bg: 'rgba(6,182,212,0.12)',   border: '1px solid rgba(6,182,212,0.35)'   },
  awaiting_payment: { label: STATUS_LABELS.awaiting_payment, color: '#3730A3', bg: 'rgba(99,102,241,0.12)',  border: '1px solid rgba(99,102,241,0.35)'  },
  paid:             { label: STATUS_LABELS.paid,             color: '#065F46', bg: 'rgba(16,185,129,0.12)',  border: '1px solid rgba(16,185,129,0.3)'   },
  handed_over:      { label: STATUS_LABELS.handed_over,      color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)'   },
  completed:        { label: STATUS_LABELS.completed,        color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)'  },
  lost:             { label: STATUS_LABELS.lost,             color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
  cancelled:        { label: STATUS_LABELS.cancelled,        color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
}

type GuideStage = 'no_guide' | 'awaiting_response' | 'declined' | 'needs_offer' | 'offer_sent'

const GUIDE_STAGE_STYLE: Record<GuideStage, { label: string; color: string; bg: string; border: string }> = {
  no_guide:          { label: 'No guide',      color: 'rgba(10,46,77,0.4)',  bg: 'rgba(10,46,77,0.05)',    border: '1px solid rgba(10,46,77,0.1)'    },
  awaiting_response: { label: '⏳ Awaiting',   color: '#92400E',             bg: 'rgba(251,191,36,0.12)',  border: '1px solid rgba(251,191,36,0.35)' },
  declined:          { label: '✗ Declined',    color: '#991B1B',             bg: 'rgba(239,68,68,0.08)',   border: '1px solid rgba(239,68,68,0.2)'   },
  needs_offer:       { label: 'Needs offer',   color: '#1E40AF',             bg: 'rgba(59,130,246,0.1)',   border: '1px solid rgba(59,130,246,0.25)' },
  offer_sent:        { label: '✓ Offer sent',  color: '#065F46',             bg: 'rgba(16,185,129,0.1)',   border: '1px solid rgba(16,185,129,0.25)' },
}

// ─── Main filter groups ───────────────────────────────────────────────────────

export type MainFilter = 'lead' | 'guide' | 'confirmed' | 'lost'

export const STATUS_GROUPS: Record<MainFilter, string[]> = {
  lead:      ['new', 'qualifying'],
  guide:     ['waiting_guide', 'offer_presented', 'awaiting_payment'],
  confirmed: ['paid', 'handed_over', 'completed'],
  lost:      ['lost', 'cancelled'],
}

export const MAIN_LABELS: Record<MainFilter, string> = {
  lead:      'Lead',
  guide:     'Guide',
  confirmed: 'Confirmed',
  lost:      'Lost',
}


export interface SubOption { key: string; label: string; special?: boolean }

export const SUB_OPTIONS: Record<MainFilter, SubOption[]> = {
  lead: [
    { key: 'new',        label: STATUS_LABELS.new        },
    { key: 'qualifying', label: STATUS_LABELS.qualifying },
  ],
  guide: [
    { key: 'waiting_guide',    label: STATUS_LABELS.waiting_guide    },
    { key: 'offer_presented',  label: STATUS_LABELS.offer_presented  },
    { key: 'awaiting_payment', label: STATUS_LABELS.awaiting_payment },
  ],
  confirmed: [
    { key: 'paid',        label: STATUS_LABELS.paid        },
    { key: 'handed_over', label: STATUS_LABELS.handed_over },
    { key: 'completed',   label: STATUS_LABELS.completed   },
  ],
  lost: [
    { key: 'lost',      label: 'Lost'      },
    { key: 'cancelled', label: 'Cancelled' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7)  return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function silenceDays(row: InquiryRow): number {
  const ref = row.last_contact_at ?? row.created_at
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
}

const SLA_STATUSES_EXCLUDED = new Set(['lost', 'cancelled', 'paid', 'handed_over', 'completed'])

function noOfferSinceHours(row: InquiryRow): number | null {
  if (row.offer_sent_at != null || row.external_offer_sent) return null
  if (SLA_STATUSES_EXCLUDED.has(row.status)) return null
  return (Date.now() - new Date(row.created_at).getTime()) / 3_600_000
}

function needsAttention(row: InquiryRow): boolean {
  if (!ACTIVE_STATUSES.has(row.status)) return false
  if (row.last_contact_at == null) return true
  return silenceDays(row) >= COLD_DAYS
}

function isNewUnresponded(row: InquiryRow): boolean {
  if (row.status !== 'new') return false
  if (row.last_contact_at != null) return false
  return (Date.now() - new Date(row.created_at).getTime()) < 86_400_000
}

function guideStage(row: InquiryRow, hasOffer: boolean): GuideStage {
  if (row.assigned_guide_id == null) return 'no_guide'
  if (row.guide_acceptance === 'declined') return 'declined'
  if (row.guide_acceptance == null) return 'awaiting_response'
  return (hasOffer || row.external_offer_sent) ? 'offer_sent' : 'needs_offer'
}

// ─── SlaBadge ─────────────────────────────────────────────────────────────────

function SlaBadge({ row }: { row: InquiryRow }) {
  const hours = noOfferSinceHours(row)
  if (hours == null || hours < 24) return null

  const state = hours > 48 ? 'red' : 'orange'

  return (
    <span
      data-state={state}
      className="sla-badge inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
    >
      {Math.floor(hours)}h no offer
    </span>
  )
}

// ─── SilenceBadge ─────────────────────────────────────────────────────────────

function SilenceBadge({ row }: { row: InquiryRow }) {
  if (!ACTIVE_STATUSES.has(row.status)) return null

  const days    = silenceDays(row)
  const isNever = row.last_contact_at == null

  if (isNewUnresponded(row)) {
    return (
      <span
        data-state="new"
        className="silence-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 animate-ping" />
        New
      </span>
    )
  }

  let state: string, label: string
  if (isNever)              { state = 'never'; label = 'No contact'      }
  else if (days >= STALE_DAYS) { state = 'stale'; label = `${days}d silent` }
  else if (days >= COLD_DAYS)  { state = 'cold';  label = `${days}d silent` }
  else if (days >= WARM_DAYS)  { state = 'warm';  label = `${days}d silent` }
  else                         { state = 'ok';    label = days === 0 ? 'Today' : '1d ago' }

  return (
    <span
      data-state={state}
      className="silence-badge inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
    >
      {label}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  allRows:      InquiryRow[]
  /** tripMap / slugMap / countryMap are keyed by INQUIRY id (resolved via experience-lookup). */
  tripMap:      Record<string, string>
  slugMap:      Record<string, string>
  countryMap:   Record<string, string>
  guideMap:     Record<string, string>
  offerSentIds: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InquiriesClient({ allRows, tripMap, slugMap, countryMap, guideMap, offerSentIds }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const [displayMode, setDisplayMode] = useState<'list' | 'calendar'>(() =>
    searchParams.get('mode') === 'calendar' ? 'calendar' : 'list'
  )

  // Initialise from URL so back-navigation restores filters
  const [mainFilter, setMainFilter] = useState<MainFilter>(() => {
    const t = searchParams.get('tab')
    return (t === 'lead' || t === 'guide' || t === 'confirmed' || t === 'lost') ? t : 'lead'
  })
  const [subFilter,  setSubFilter ] = useState<string | null>(() => searchParams.get('sub'))
  const [openPopup,  setOpenPopup ] = useState<MainFilter | null>(null)
  const [view,       setView      ] = useState<'angler' | 'guide'>(() =>
    searchParams.get('view') === 'guide' ? 'guide' : 'angler'
  )
  const [q,       setQ      ] = useState(() => searchParams.get('q')    ?? '')
  const [localQ,  setLocalQ ] = useState(() => searchParams.get('q')    ?? '')
  const [from,    setFrom   ] = useState(() => searchParams.get('from') ?? '')
  const [to,      setTo     ] = useState(() => searchParams.get('to')   ?? '')
  const [sortSla, setSortSla] = useState(false)

  // Sync filter state → URL (replace, not push, so back-button skips filter changes)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const p = new URLSearchParams()
    if (displayMode !== 'list') p.set('mode', displayMode)
    if (mainFilter !== 'lead') p.set('tab',  mainFilter)
    if (subFilter  != null)    p.set('sub',  subFilter)
    if (view       !== 'angler') p.set('view', view)
    if (q)    p.set('q',    q)
    if (from) p.set('from', from)
    if (to)   p.set('to',   to)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [displayMode, mainFilter, subFilter, view, q, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const offerSentSet = useMemo(() => new Set(offerSentIds), [offerSentIds])

  // ── Per-status counts (for popups) ─────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of allRows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [allRows])

  // ── Group counts (for main tabs) ────────────────────────────────────────────
  const groupCounts = useMemo(() => ({
    lead:      allRows.filter(r => STATUS_GROUPS.lead.includes(r.status)).length,
    guide:     allRows.filter(r => STATUS_GROUPS.guide.includes(r.status)).length,
    confirmed: allRows.filter(r => STATUS_GROUPS.confirmed.includes(r.status)).length,
    lost:      allRows.filter(r => STATUS_GROUPS.lost.includes(r.status)).length,
  }), [allRows])

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const group = STATUS_GROUPS[mainFilter]
    let result: InquiryRow[]

    if (subFilter === 'needs_attention') {
      result = allRows.filter(r => group.includes(r.status) && needsAttention(r))
      result = [...result].sort((a, b) => silenceDays(b) - silenceDays(a))
    } else if (subFilter != null) {
      result = allRows.filter(r => r.status === subFilter)
    } else {
      result = allRows.filter(r => group.includes(r.status))
    }

    if (q) {
      const lq = q.toLowerCase()
      result = result.filter(r =>
        (r.angler_name  ?? '').toLowerCase().includes(lq) ||
        (r.angler_email ?? '').toLowerCase().includes(lq)
      )
    }
    if (from) result = result.filter(r => r.created_at >= from)
    if (to)   result = result.filter(r => r.created_at.slice(0, 10) <= to)

    if (sortSla) {
      result = [...result].sort((a, b) => (noOfferSinceHours(b) ?? 0) - (noOfferSinceHours(a) ?? 0))
    }

    return result
  }, [allRows, mainFilter, subFilter, q, from, to, sortSla])

  // ── Stats (always from full data) ───────────────────────────────────────────
  const { totalCommission, hasMixedCurrency, convPct } = useMemo(() => {
    const USD_EUR_RATE = 0.92
    const mixed = allRows.some(r => r.deal_currency === 'USD' && r.internal_commission_eur != null)
    const total = allRows.reduce((sum, r) => {
      const c = r.internal_commission_eur != null ? Number(r.internal_commission_eur) : 0
      if (!Number.isFinite(c)) return sum
      return sum + (r.deal_currency === 'USD' ? c * USD_EUR_RATE : c)
    }, 0)
    const wonCount    = (statusCounts['paid'] ?? 0) + (statusCounts['handed_over'] ?? 0) + (statusCounts['completed'] ?? 0)
    const closedCount = allRows.filter(r => !ACTIVE_STATUSES.has(r.status)).length
    const pct         = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null
    return { totalCommission: total, hasMixedCurrency: mixed, convPct: pct }
  }, [allRows, statusCounts])

  const hasActiveFilters = q !== '' || from !== '' || to !== ''

  function commitSearch(value: string) { setQ(value.trim()) }

  function switchMain(key: MainFilter) {
    setMainFilter(key)
    setSubFilter(null)
    setOpenPopup(null)
  }

  // Active sub-filter label (for tab display)
  const activeSubLabel = subFilter != null
    ? SUB_OPTIONS[mainFilter].find(o => o.key === subFilter)?.label ?? null
    : null

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body text-primary/38">Admin</p>
          <h1 className="text-primary text-3xl font-bold f-display">
            Inquiry <span className="italic">Management</span>
          </h1>
          <p className="text-primary/45 text-sm mt-1 f-body">
            {allRows.length} total inquiries · review, negotiate, and close deals.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* List / Calendar toggle */}
          <div className="flex items-center rounded-[12px] overflow-hidden p-0.5 gap-0.5 bg-primary/[6%] border border-primary/10">
            {([
              { mode: 'list' as const,     icon: <List     size={14} />, title: 'List view'     },
              { mode: 'calendar' as const, icon: <Calendar size={14} />, title: 'Calendar view' },
            ]).map(({ mode, icon, title }) => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                title={title}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-[9px] transition-all',
                  displayMode === mode ? 'bg-primary text-white' : 'bg-transparent text-primary/45',
                )}
              >
                {icon}
              </button>
            ))}
          </div>

          <Link
            href="/admin/inquiries/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-bold f-body flex-shrink-0 transition-all hover:opacity-90 bg-primary text-white shadow-[0_4px_16px_rgba(10,46,77,0.2)]"
          >
            <span className="text-base leading-none">+</span>
            New inquiry
          </Link>
        </div>
      </div>

      {/* ─── Stats row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Lead',      value: groupCounts.lead,      textClass: 'text-primary'       },
          { label: 'Guide',     value: groupCounts.guide,     textClass: 'text-[#5B21B6]'    },
          { label: 'Confirmed', value: groupCounts.confirmed, textClass: 'text-[#065F46]'    },
          { label: 'Lost',      value: groupCounts.lost,      textClass: 'text-[#991B1B]'    },
        ] as const).map(s => (
          <div
            key={s.label}
            className="px-4 py-3 rounded-[16px] bg-[#FDFAF7] border border-primary/7 shadow-[0_2px_10px_rgba(10,46,77,0.04)]"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] f-body mb-1 text-primary/40">{s.label}</p>
            <p className={cn('text-2xl font-bold f-display', s.textClass)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Commission + win rate ────────────────────────────────────── */}
      {(totalCommission > 0 || convPct != null) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {totalCommission > 0 && (
            <div className="px-4 py-3 rounded-[16px] flex items-center gap-3 bg-accent/[8%] border border-accent/20">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] f-body text-primary/45">Commission tracked</p>
                <p className="text-xl font-bold f-display text-accent">
                  €{totalCommission.toFixed(0)}
                  {hasMixedCurrency && (
                    <span className="text-sm font-normal ml-1 text-primary/45">≈ EUR</span>
                  )}
                </p>
              </div>
            </div>
          )}
          {convPct != null && (
            <div className="px-4 py-3 rounded-[16px] bg-[#FDFAF7] border border-primary/7">
              <p className="text-[10px] uppercase tracking-[0.16em] f-body text-primary/40">Win rate</p>
              <p className="text-xl font-bold f-display text-primary">{convPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Calendar view ───────────────────────────────────────────── */}
      {displayMode === 'calendar' && (
        <InquiriesCalendar allRows={allRows} tripMap={tripMap} slugMap={slugMap} countryMap={countryMap} />
      )}

      {/* ─── List view ───────────────────────────────────────────────── */}
      {displayMode === 'list' && (<>

      {/* ─── Search + date filters ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-[14px] flex-1 min-w-[200px] max-w-xs bg-[#FDFAF7] border',
            q ? 'border-primary/25' : 'border-primary/10',
          )}
        >
          <Search size={13} className="text-primary/35 flex-shrink-0" />
          <input
            type="text"
            value={localQ}
            onChange={e => setLocalQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitSearch(localQ)
              if (e.key === 'Escape') { setLocalQ(''); setQ('') }
            }}
            onBlur={() => commitSearch(localQ)}
            placeholder="Search name or email…"
            className="flex-1 bg-transparent outline-none text-sm f-body text-primary min-w-0 placeholder:opacity-40"
          />
          {localQ && (
            <button type="button" onClick={() => { setLocalQ(''); setQ('') }}
              className="flex-shrink-0 p-0.5 rounded-full transition-opacity hover:opacity-70">
              <X size={11} className="text-primary/45" />
            </button>
          )}
        </div>

        <label
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer bg-[#FDFAF7] border',
            from ? 'border-primary/25' : 'border-primary/10',
          )}
        >
          <CalendarDays size={13} className="text-primary/35 flex-shrink-0" />
          <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em] text-primary/35 flex-shrink-0">From</span>
          <input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            className={cn(
              'bg-transparent outline-none text-sm f-body',
              from ? 'text-primary' : 'text-primary/35',
            )}
          />
          {from && (
            <button type="button" onClick={e => { e.preventDefault(); setFrom('') }} className="flex-shrink-0">
              <X size={11} className="text-primary/45" />
            </button>
          )}
        </label>

        <label
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer bg-[#FDFAF7] border',
            to ? 'border-primary/25' : 'border-primary/10',
          )}
        >
          <CalendarDays size={13} className="text-primary/35 flex-shrink-0" />
          <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em] text-primary/35 flex-shrink-0">To</span>
          <input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            className={cn(
              'bg-transparent outline-none text-sm f-body',
              to ? 'text-primary' : 'text-primary/35',
            )}
          />
          {to && (
            <button type="button" onClick={e => { e.preventDefault(); setTo('') }} className="flex-shrink-0">
              <X size={11} className="text-primary/45" />
            </button>
          )}
        </label>

        {hasActiveFilters && (
          <button type="button"
            onClick={() => { setQ(''); setLocalQ(''); setFrom(''); setTo('') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-semibold f-body transition-all hover:opacity-80 bg-red-500/[8%] text-red-600 border border-red-500/20">
            <X size={11} />
            Clear
          </button>
        )}
      </div>

      {/* ─── Main filter tabs + sub-filter popups ────────────────────── */}

      {/* Backdrop — closes popup when clicking outside */}
      {openPopup != null && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
      )}

      <div className="flex items-center gap-2 flex-wrap mb-5">
        {(['lead', 'guide', 'confirmed', 'lost'] as const).map(key => {
          const active     = mainFilter === key
          const count      = groupCounts[key]
          const popupOpen  = openPopup === key
          const subLabel   = active ? activeSubLabel : null

          return (
            <div key={key} className={cn('relative', popupOpen && 'z-50')}>

              {/* Tab pill */}
              <div
                data-key={key}
                data-active={String(active)}
                className="filter-tab flex items-center rounded-full text-sm font-semibold f-body overflow-hidden"
              >
                {/* Label + count — click to switch */}
                <button
                  onClick={() => switchMain(key)}
                  className="flex items-center gap-2 pl-4 py-2 pr-2.5"
                >
                  <span>{MAIN_LABELS[key]}</span>
                  {subLabel != null && (
                    <span className="text-[11px] font-normal opacity-70">· {subLabel}</span>
                  )}
                  <span
                    data-active={String(active)}
                    className="filter-count text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  >
                    {count}
                  </span>
                </button>

                {/* Chevron — click to open popup */}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (!active) switchMain(key)
                    setOpenPopup(popupOpen ? null : key)
                  }}
                  data-active={String(active)}
                  className="filter-chevron flex items-center px-2.5 py-2 transition-opacity hover:opacity-80"
                >
                  <ChevronDown
                    size={13}
                    className={cn('transition-transform', popupOpen && 'rotate-180')}
                  />
                </button>
              </div>

              {/* Popup */}
              {popupOpen && (
                <div className="absolute top-full left-0 mt-1.5 rounded-[16px] p-1.5 min-w-[200px] bg-white border border-primary/10 shadow-[0_8px_32px_rgba(10,46,77,0.13)] z-50">
                  {/* "All" option */}
                  <button
                    onClick={() => { setSubFilter(null); setOpenPopup(null) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body font-semibold text-primary transition-colors hover:bg-black/[0.03]',
                      subFilter == null && 'bg-primary/[6%]',
                    )}
                  >
                    <span>All {MAIN_LABELS[key]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/[8%] text-primary/50">
                      {count}
                    </span>
                  </button>

                  <div className="my-1 mx-2 h-px bg-primary/7" />

                  {/* Sub-filter options */}
                  {SUB_OPTIONS[key].map(opt => {
                    const optCount  = statusCounts[opt.key] ?? 0
                    const optActive = subFilter === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSubFilter(opt.key); setOpenPopup(null) }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body transition-colors hover:bg-black/[0.03]',
                          opt.special ? 'text-red-600' : 'text-primary',
                          optActive ? 'bg-primary/[6%] font-semibold' : 'font-normal',
                        )}
                      >
                        <span>{opt.label}</span>
                        {optCount > 0 && (
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            opt.special
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-primary/[8%] text-primary/50',
                          )}>
                            {optCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Active sub-filter clear */}
        {subFilter != null && (
          <button
            type="button"
            onClick={() => setSubFilter(null)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs f-body transition-opacity hover:opacity-70 bg-primary/[6%] text-primary/50 border border-primary/10"
          >
            <X size={10} />
            {activeSubLabel}
          </button>
        )}
      </div>

      {/* ─── View toggle + SLA sort ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['angler', 'guide'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all',
              view === v
                ? 'bg-primary text-white'
                : 'bg-primary/[6%] text-primary/55 border border-primary/10',
            )}
          >
            {v === 'angler' ? '👤 Angler view' : '🎣 Guide view'}
          </button>
        ))}

        <button
          onClick={() => setSortSla(s => !s)}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all',
            sortSla
              ? 'bg-red-500/10 text-red-600 border border-red-500/25'
              : 'bg-primary/[6%] text-primary/55 border border-primary/10',
          )}
          title="Sort: inquiries without offer, oldest first"
        >
          ⏱ Bez oferty od
        </button>
      </div>

      {/* ─── Results count ───────────────────────────────────────────── */}
      {(hasActiveFilters || subFilter != null) && (
        <p className="text-xs f-body mb-4 text-primary/40">
          {rows.length === 0 ? 'No results' : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
          {hasActiveFilters && <span className="text-primary/30"> (filtered)</span>}
        </p>
      )}

      {/* ─── List ────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[24px] text-center bg-[#FDFAF7] border-2 border-dashed border-primary/[12%]">
          <p className="text-primary/40 text-base f-display mb-1">
            {hasActiveFilters ? 'No matches' : 'No inquiries here'}
          </p>
          <p className="text-primary/30 text-sm f-body">
            {hasActiveFilters
              ? 'Try adjusting your search or date range.'
              : `No ${MAIN_LABELS[mainFilter].toLowerCase()} inquiries yet.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(row => {
            const st        = STATUS_STYLE[row.status] ?? STATUS_STYLE.new
            const tripTitle = tripMap[row.id] ?? '—'
            const dates     = row.requested_dates
            const dateLabel = dates != null && dates.length > 0
              ? fmtDate(dates[0]) + (dates.length > 1 ? ` +${dates.length - 1}` : '')
              : '—'
            const isAttention = needsAttention(row)
            const isNew       = isNewUnresponded(row)

            // ── Guide view row ──────────────────────────────────────────────
            if (view === 'guide') {
              const hasOffer  = offerSentSet.has(row.id)
              const stage     = guideStage(row, hasOffer)
              const stageSt   = GUIDE_STAGE_STYLE[stage]
              const guideName = row.assigned_guide_id != null
                ? (guideMap[row.assigned_guide_id] ?? 'Unknown guide')
                : null

              return (
                <Link key={row.id} href={`/admin/inquiries/${row.id}`} className="block group no-underline">
                  <div
                    data-state={
                      stage === 'awaiting_response' ? 'guide-await' :
                      stage === 'declined'          ? 'guide-dec'   : undefined
                    }
                    className="inquiry-row flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md shadow-[0_1px_6px_rgba(10,46,77,0.04)]"
                  >
                    <div className="flex-shrink-0 flex flex-col items-center pt-1">
                      <div
                        data-stage={stage}
                        className="guide-stage-dot w-2.5 h-2.5 rounded-full mt-0.5"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-bold f-body text-primary truncate">{row.angler_name}</span>
                        {row.party_size > 1 && (
                          <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full bg-primary/7 text-primary/50">
                            {row.party_size} pax
                          </span>
                        )}
                        <span
                          data-status={row.status}
                          className="status-badge px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs f-body truncate text-primary/55">
                        {tripTitle} · {dateLabel}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[160px]">
                      <span className="text-xs font-bold f-body text-right text-primary">
                        {guideName ?? <span className="text-primary/30 font-normal">Unassigned</span>}
                      </span>
                      {row.assigned_guide_id != null && (
                        <span className="text-[10px] f-body font-semibold">
                          {row.guide_acceptance === 'accepted' && <span className="text-emerald-600">✓ Accepted</span>}
                          {row.guide_acceptance === 'declined' && <span className="text-red-600">✗ Declined</span>}
                          {row.guide_acceptance == null        && <span className="text-yellow-700">⏳ No response</span>}
                        </span>
                      )}
                      {row.guide_decline_reason != null && row.guide_decline_reason.trim() !== '' && (
                        <p className="text-[10px] f-body max-w-[150px] text-right truncate text-[#991B1B]/65">
                          {row.guide_decline_reason}
                        </p>
                      )}
                      <span
                        data-stage={stage}
                        className="guide-stage-badge px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                      >
                        {stageSt.label}
                      </span>
                      {row.assigned_guide_id != null && row.guide_acceptance !== 'declined' && (
                        <ExternalOfferToggle inquiryId={row.id} initial={row.external_offer_sent} />
                      )}
                    </div>
                    <div className="flex items-center flex-shrink-0 pl-1">
                      <span className="text-sm font-semibold transition-transform group-hover:translate-x-0.5 text-accent">→</span>
                    </div>
                  </div>
                </Link>
              )
            }

            // ── Angler view row ─────────────────────────────────────────────
            return (
              <Link key={row.id} href={`/admin/inquiries/${row.id}`} className="block group no-underline">
                <div
                  data-state={isNew ? 'new' : isAttention ? 'attention' : undefined}
                  className="inquiry-row flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md shadow-[0_1px_6px_rgba(10,46,77,0.04)]"
                >
                  <div className="flex-shrink-0 flex flex-col items-center pt-1 gap-2">
                    <div
                      data-status={row.status}
                      className="status-dot w-2.5 h-2.5 rounded-full mt-0.5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold f-body text-primary truncate">{row.angler_name}</span>
                      {row.party_size > 1 && (
                        <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full bg-primary/7 text-primary/50">
                          {row.party_size} pax
                        </span>
                      )}
                      <SilenceBadge row={row} />
                    </div>
                    <p className="text-xs f-body truncate mb-0.5 text-primary/55">
                      {tripTitle} · {dateLabel}
                    </p>
                    <p className="text-[11px] f-body text-primary/38">
                      {row.angler_email}
                      {row.angler_phone != null && row.angler_phone.trim() !== '' && (
                        <span className="ml-1.5">· {row.angler_phone}</span>
                      )}
                    </p>
                    {row.next_action != null && row.next_action.trim() !== '' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.1em] f-body px-1.5 py-0.5 rounded bg-accent/12 text-accent border border-accent/20">
                          next
                        </span>
                        <span className="text-[11px] f-body font-medium truncate text-primary">
                          {row.next_action}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[120px]">
                    <span
                      data-status={row.status}
                      className="status-badge px-2.5 py-0.5 rounded-full text-[10px] font-bold f-body"
                    >
                      {st.label}
                    </span>
                    <SlaBadge row={row} />
                    {row.internal_commission_eur != null && (
                      <span className="text-xs font-bold f-body text-accent">
                        +{row.deal_currency === 'USD' ? '$' : '€'}{Number(row.internal_commission_eur).toFixed(0)}
                      </span>
                    )}
                    {row.status === 'lost' && row.lost_reason != null && row.lost_reason.trim() !== '' && (
                      <p className="text-[10px] f-body max-w-[140px] text-right truncate text-[#991B1B]/60">
                        {row.lost_reason}
                      </p>
                    )}
                    {row.last_contact_at != null && (
                      <p className="text-[10px] f-body text-primary/38">
                        contact {relativeTime(row.last_contact_at)}
                      </p>
                    )}
                    <p className="text-[10px] f-body text-primary/28">
                      {relativeTime(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center flex-shrink-0 pl-1">
                    <span className="text-sm font-semibold transition-transform group-hover:translate-x-0.5 text-accent">→</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      </>)}

    </div>
  )
}
