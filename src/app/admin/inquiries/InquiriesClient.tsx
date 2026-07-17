'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Search, X, CalendarDays, ChevronDown } from 'lucide-react'
import { ExternalOfferToggle } from './ExternalOfferToggle'

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
  internal_commission_eur: number | null
  deal_currency:           string | null
  lost_reason:             string | null
  last_contact_at:         string | null
  next_action:             string | null
  assigned_guide_id:       string | null
  guide_acceptance:        string | null
  guide_decline_reason:    string | null
  external_offer_sent:     boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WARM_DAYS  = 2
const COLD_DAYS  = 3
const STALE_DAYS = 7

const ACTIVE_STATUSES = new Set([
  'pending', 'in_negotiation', 'waiting_for_guide_offer',
  'offer_sent', 'waiting_for_deposit', 'deposit_sent',
])

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:                 { label: 'Pending',         color: '#92400E', bg: 'rgba(251,191,36,0.15)',  border: '1px solid rgba(251,191,36,0.4)'   },
  in_negotiation:          { label: 'Negotiating',     color: '#5B21B6', bg: 'rgba(139,92,246,0.15)',  border: '1px solid rgba(139,92,246,0.35)'  },
  waiting_for_guide_offer: { label: 'Waiting Guide',   color: '#C2410C', bg: 'rgba(234,88,12,0.12)',   border: '1px solid rgba(234,88,12,0.35)'   },
  offer_sent:              { label: 'Offer Sent',      color: '#0E7490', bg: 'rgba(6,182,212,0.12)',   border: '1px solid rgba(6,182,212,0.35)'   },
  waiting_for_deposit:     { label: 'Waiting Deposit', color: '#3730A3', bg: 'rgba(99,102,241,0.12)',  border: '1px solid rgba(99,102,241,0.35)'  },
  deposit_sent:            { label: 'Deposit Sent',    color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)'   },
  deposit_paid:            { label: 'Confirmed',       color: '#065F46', bg: 'rgba(16,185,129,0.12)',  border: '1px solid rgba(16,185,129,0.3)'   },
  completed:               { label: 'Completed',       color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)'  },
  lost:                    { label: 'Lost',            color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
  cancelled:               { label: 'Cancelled',       color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
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

type MainFilter = 'lead' | 'guide' | 'confirmed' | 'lost'

const STATUS_GROUPS: Record<MainFilter, string[]> = {
  lead:      ['pending', 'in_negotiation'],
  guide:     ['waiting_for_guide_offer', 'offer_sent', 'waiting_for_deposit', 'deposit_sent'],
  confirmed: ['deposit_paid', 'completed'],
  lost:      ['lost', 'cancelled'],
}

const MAIN_LABELS: Record<MainFilter, string> = {
  lead:      'Lead',
  guide:     'Guide',
  confirmed: 'Confirmed',
  lost:      'Lost',
}

const MAIN_COLORS: Record<MainFilter, { active: string; text: string; bg: string; border: string }> = {
  lead:      { active: '#0A2E4D', text: '#fff', bg: 'rgba(10,46,77,0.06)',    border: '1px solid rgba(10,46,77,0.12)'    },
  guide:     { active: '#5B21B6', text: '#fff', bg: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)' },
  confirmed: { active: '#065F46', text: '#fff', bg: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)'  },
  lost:      { active: '#991B1B', text: '#fff', bg: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)'   },
}

interface SubOption { key: string; label: string; special?: boolean }

const SUB_OPTIONS: Record<MainFilter, SubOption[]> = {
  lead: [
    { key: 'pending',        label: 'Pending'     },
    { key: 'in_negotiation', label: 'Negotiating' },
  ],
  guide: [
    { key: 'waiting_for_guide_offer', label: 'Waiting Guide'   },
    { key: 'offer_sent',              label: 'Offer Sent'      },
    { key: 'waiting_for_deposit',     label: 'Waiting Deposit' },
    { key: 'deposit_sent',            label: 'Deposit Sent'    },
  ],
  confirmed: [
    { key: 'deposit_paid', label: 'Confirmed' },
    { key: 'completed',    label: 'Completed' },
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

function needsAttention(row: InquiryRow): boolean {
  if (!ACTIVE_STATUSES.has(row.status)) return false
  if (row.last_contact_at == null) return true
  return silenceDays(row) >= COLD_DAYS
}

function isNewUnresponded(row: InquiryRow): boolean {
  if (row.status !== 'pending') return false
  if (row.last_contact_at != null) return false
  return (Date.now() - new Date(row.created_at).getTime()) < 86_400_000
}

function guideStage(row: InquiryRow, hasOffer: boolean): GuideStage {
  if (row.assigned_guide_id == null) return 'no_guide'
  if (row.guide_acceptance === 'declined') return 'declined'
  if (row.guide_acceptance == null) return 'awaiting_response'
  return (hasOffer || row.external_offer_sent) ? 'offer_sent' : 'needs_offer'
}

// ─── SilenceBadge ─────────────────────────────────────────────────────────────

function SilenceBadge({ row }: { row: InquiryRow }) {
  if (!ACTIVE_STATUSES.has(row.status)) return null

  const days    = silenceDays(row)
  const isNever = row.last_contact_at == null

  if (isNewUnresponded(row)) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
        style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.35)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: '#E67E50', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
        />
        New
      </span>
    )
  }

  let bg: string, color: string, border: string, label: string
  if (isNever) {
    bg = 'rgba(239,68,68,0.1)'; color = '#DC2626'; border = '1px solid rgba(239,68,68,0.25)'; label = 'No contact'
  } else if (days >= STALE_DAYS) {
    bg = 'rgba(239,68,68,0.1)'; color = '#DC2626'; border = '1px solid rgba(239,68,68,0.25)'; label = `${days}d silent`
  } else if (days >= COLD_DAYS) {
    bg = 'rgba(234,88,12,0.1)'; color = '#EA580C'; border = '1px solid rgba(234,88,12,0.25)'; label = `${days}d silent`
  } else if (days >= WARM_DAYS) {
    bg = 'rgba(202,138,4,0.1)'; color = '#A16207'; border = '1px solid rgba(202,138,4,0.25)'; label = `${days}d silent`
  } else {
    bg = 'rgba(16,185,129,0.08)'; color = '#059669'; border = '1px solid rgba(16,185,129,0.2)'; label = days === 0 ? 'Today' : '1d ago'
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
      style={{ background: bg, color, border }}>
      {label}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  allRows:      InquiryRow[]
  tripMap:      Record<string, string>
  guideMap:     Record<string, string>
  offerSentIds: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InquiriesClient({ allRows, tripMap, guideMap, offerSentIds }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

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
  const [q,      setQ     ] = useState(() => searchParams.get('q')    ?? '')
  const [localQ, setLocalQ] = useState(() => searchParams.get('q')    ?? '')
  const [from,   setFrom  ] = useState(() => searchParams.get('from') ?? '')
  const [to,     setTo    ] = useState(() => searchParams.get('to')   ?? '')

  // Sync filter state → URL (replace, not push, so back-button skips filter changes)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const p = new URLSearchParams()
    if (mainFilter !== 'lead') p.set('tab',  mainFilter)
    if (subFilter  != null)    p.set('sub',  subFilter)
    if (view       !== 'angler') p.set('view', view)
    if (q)    p.set('q',    q)
    if (from) p.set('from', from)
    if (to)   p.set('to',   to)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [mainFilter, subFilter, view, q, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

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

    return result
  }, [allRows, mainFilter, subFilter, q, from, to])

  // ── Stats (always from full data) ───────────────────────────────────────────
  const { totalCommission, hasMixedCurrency, convPct } = useMemo(() => {
    const USD_EUR_RATE = 0.92
    const mixed = allRows.some(r => r.deal_currency === 'USD' && r.internal_commission_eur != null)
    const total = allRows.reduce((sum, r) => {
      const c = r.internal_commission_eur != null ? Number(r.internal_commission_eur) : 0
      if (!Number.isFinite(c)) return sum
      return sum + (r.deal_currency === 'USD' ? c * USD_EUR_RATE : c)
    }, 0)
    const wonCount    = (statusCounts['deposit_paid'] ?? 0) + (statusCounts['completed'] ?? 0)
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
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Inquiry <span style={{ fontStyle: 'italic' }}>Management</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {allRows.length} total inquiries · review, negotiate, and close deals.
          </p>
        </div>
        <Link
          href="/admin/inquiries/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-bold f-body flex-shrink-0 transition-all hover:opacity-90"
          style={{ background: '#0A2E4D', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(10,46,77,0.2)' }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          New inquiry
        </Link>
      </div>

      {/* ─── Stats row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Lead',      value: groupCounts.lead,      color: '#0A2E4D' },
          { label: 'Guide',     value: groupCounts.guide,     color: '#5B21B6' },
          { label: 'Confirmed', value: groupCounts.confirmed, color: '#065F46' },
          { label: 'Lost',      value: groupCounts.lost,      color: '#991B1B' },
        ] as const).map(s => (
          <div key={s.label}
            className="px-4 py-3 rounded-[16px]"
            style={{
              background: 'highlight' in s && s.highlight ? 'rgba(239,68,68,0.05)' : '#FDFAF7',
              border:     'highlight' in s && s.highlight ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(10,46,77,0.07)',
              boxShadow:  '0 2px 10px rgba(10,46,77,0.04)',
            }}>
            <p className="text-[10px] uppercase tracking-[0.16em] f-body mb-1"
              style={{ color: 'rgba(10,46,77,0.4)' }}>{s.label}</p>
            <p className="text-2xl font-bold f-display" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Commission + win rate ────────────────────────────────────── */}
      {(totalCommission > 0 || convPct != null) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {totalCommission > 0 && (
            <div className="px-4 py-3 rounded-[16px] flex items-center gap-3"
              style={{ background: 'rgba(230,126,80,0.08)', border: '1px solid rgba(230,126,80,0.2)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] f-body"
                  style={{ color: 'rgba(10,46,77,0.45)' }}>Commission tracked</p>
                <p className="text-xl font-bold f-display" style={{ color: '#E67E50' }}>
                  €{totalCommission.toFixed(0)}
                  {hasMixedCurrency && (
                    <span className="text-sm font-normal ml-1" style={{ color: 'rgba(10,46,77,0.45)' }}>≈ EUR</span>
                  )}
                </p>
              </div>
            </div>
          )}
          {convPct != null && (
            <div className="px-4 py-3 rounded-[16px]"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.16em] f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Win rate</p>
              <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>{convPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Search + date filters ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-[14px] flex-1"
          style={{
            background: '#FDFAF7',
            border: `1px solid ${q ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}`,
            minWidth: '200px', maxWidth: '320px',
          }}
        >
          <Search size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
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
            className="flex-1 bg-transparent outline-none text-sm f-body placeholder:opacity-40"
            style={{ color: '#0A2E4D', minWidth: 0 }}
          />
          {localQ && (
            <button type="button" onClick={() => { setLocalQ(''); setQ('') }}
              className="flex-shrink-0 p-0.5 rounded-full transition-opacity hover:opacity-70">
              <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer"
          style={{ background: '#FDFAF7', border: `1px solid ${from ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}` }}>
          <CalendarDays size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
          <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em]"
            style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }}>From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-transparent outline-none text-sm f-body"
            style={{ color: from ? '#0A2E4D' : 'rgba(10,46,77,0.35)' }} />
          {from && (
            <button type="button" onClick={e => { e.preventDefault(); setFrom('') }} className="flex-shrink-0">
              <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
            </button>
          )}
        </label>

        <label className="flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer"
          style={{ background: '#FDFAF7', border: `1px solid ${to ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}` }}>
          <CalendarDays size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
          <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em]"
            style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }}>To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-transparent outline-none text-sm f-body"
            style={{ color: to ? '#0A2E4D' : 'rgba(10,46,77,0.35)' }} />
          {to && (
            <button type="button" onClick={e => { e.preventDefault(); setTo('') }} className="flex-shrink-0">
              <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
            </button>
          )}
        </label>

        {hasActiveFilters && (
          <button type="button"
            onClick={() => { setQ(''); setLocalQ(''); setFrom(''); setTo('') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-semibold f-body transition-all hover:opacity-80"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }}>
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
          const colors     = MAIN_COLORS[key]
          const popupOpen  = openPopup === key
          const subLabel   = active ? activeSubLabel : null

          return (
            <div key={key} className="relative" style={{ zIndex: popupOpen ? 50 : 'auto' }}>

              {/* Tab pill */}
              <div
                className="flex items-center rounded-full text-sm font-semibold f-body overflow-hidden"
                style={{
                  background: active ? colors.active : 'rgba(10,46,77,0.06)',
                  color:      active ? colors.text   : 'rgba(10,46,77,0.6)',
                  border:     active ? 'none'        : '1px solid rgba(10,46,77,0.1)',
                }}
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
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active ? 'rgba(255,255,255,0.18)' : 'rgba(10,46,77,0.1)',
                      color:      active ? 'rgba(255,255,255,0.9)'  : 'rgba(10,46,77,0.5)',
                    }}
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
                  className="flex items-center px-2.5 py-2 transition-opacity hover:opacity-80"
                  style={{
                    borderLeft: active
                      ? '1px solid rgba(255,255,255,0.15)'
                      : '1px solid rgba(10,46,77,0.1)',
                  }}
                >
                  <ChevronDown
                    size={13}
                    style={{
                      transition: 'transform 0.15s',
                      transform: popupOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
              </div>

              {/* Popup */}
              {popupOpen && (
                <div
                  className="absolute top-full left-0 mt-1.5 rounded-[16px] p-1.5 min-w-[200px]"
                  style={{
                    background: '#fff',
                    border:     '1px solid rgba(10,46,77,0.1)',
                    boxShadow:  '0 8px 32px rgba(10,46,77,0.13)',
                    zIndex: 50,
                  }}
                >
                  {/* "All" option */}
                  <button
                    onClick={() => { setSubFilter(null); setOpenPopup(null) }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body font-semibold transition-colors hover:bg-black/[0.03]"
                    style={{
                      background: subFilter == null ? 'rgba(10,46,77,0.06)' : 'transparent',
                      color: '#0A2E4D',
                    }}
                  >
                    <span>All {MAIN_LABELS[key]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.5)' }}>
                      {count}
                    </span>
                  </button>

                  <div className="my-1 mx-2" style={{ height: 1, background: 'rgba(10,46,77,0.07)' }} />

                  {/* Sub-filter options */}
                  {SUB_OPTIONS[key].map(opt => {
                    const optCount  = statusCounts[opt.key] ?? 0
                    const optActive = subFilter === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSubFilter(opt.key); setOpenPopup(null) }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body transition-colors hover:bg-black/[0.03]"
                        style={{
                          background: optActive ? 'rgba(10,46,77,0.06)' : 'transparent',
                          color:      opt.special ? '#DC2626' : '#0A2E4D',
                          fontWeight: optActive ? 600 : 400,
                        }}
                      >
                        <span>{opt.label}</span>
                        {optCount > 0 && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: opt.special ? 'rgba(239,68,68,0.1)' : 'rgba(10,46,77,0.08)',
                              color:      opt.special ? '#DC2626'              : 'rgba(10,46,77,0.5)',
                            }}
                          >
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
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs f-body transition-opacity hover:opacity-70"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)' }}
          >
            <X size={10} />
            {activeSubLabel}
          </button>
        )}
      </div>

      {/* ─── View toggle ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        {(['angler', 'guide'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
            style={{
              background: view === v ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
              color:      view === v ? '#fff'    : 'rgba(10,46,77,0.55)',
              border:     view === v ? 'none'    : '1px solid rgba(10,46,77,0.1)',
            }}
          >
            {v === 'angler' ? '👤 Angler view' : '🎣 Guide view'}
          </button>
        ))}
      </div>

      {/* ─── Results count ───────────────────────────────────────────── */}
      {(hasActiveFilters || subFilter != null) && (
        <p className="text-xs f-body mb-4" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {rows.length === 0 ? 'No results' : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
          {hasActiveFilters && <span style={{ color: 'rgba(10,46,77,0.3)' }}> (filtered)</span>}
        </p>
      )}

      {/* ─── List ────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[24px] text-center"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.12)' }}>
          <p className="text-[#0A2E4D]/40 text-base f-display mb-1">
            {hasActiveFilters ? 'No matches' : 'No inquiries here'}
          </p>
          <p className="text-[#0A2E4D]/30 text-sm f-body">
            {hasActiveFilters
              ? 'Try adjusting your search or date range.'
              : `No ${MAIN_LABELS[mainFilter].toLowerCase()} inquiries yet.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(row => {
            const st        = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending
            const tripTitle = row.trip_id != null ? (tripMap[row.trip_id] ?? '—') : '—'
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
                <Link key={row.id} href={`/admin/inquiries/${row.id}`} className="block group" style={{ textDecoration: 'none' }}>
                  <div
                    className="flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md"
                    style={{
                      background: stage === 'awaiting_response' ? 'rgba(251,191,36,0.04)' : '#FDFAF7',
                      border: stage === 'awaiting_response'
                        ? '1px solid rgba(251,191,36,0.25)'
                        : stage === 'declined'
                          ? '1px solid rgba(239,68,68,0.15)'
                          : '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
                    }}
                  >
                    <div className="flex-shrink-0 flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full mt-0.5"
                        style={{ background: stageSt.color, boxShadow: `0 0 0 3px ${stageSt.bg}` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-bold f-body text-[#0A2E4D] truncate">{row.angler_name}</span>
                        {row.party_size > 1 && (
                          <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}>
                            {row.party_size} pax
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                          style={{ background: st.bg, color: st.color, border: st.border }}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {tripTitle} · {dateLabel}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[160px]">
                      <span className="text-xs font-bold f-body text-right" style={{ color: '#0A2E4D' }}>
                        {guideName ?? <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>Unassigned</span>}
                      </span>
                      {row.assigned_guide_id != null && (
                        <span className="text-[10px] f-body font-semibold">
                          {row.guide_acceptance === 'accepted' && <span style={{ color: '#059669' }}>✓ Accepted</span>}
                          {row.guide_acceptance === 'declined' && <span style={{ color: '#DC2626' }}>✗ Declined</span>}
                          {row.guide_acceptance == null        && <span style={{ color: '#A16207' }}>⏳ No response</span>}
                        </span>
                      )}
                      {row.guide_decline_reason != null && row.guide_decline_reason.trim() !== '' && (
                        <p className="text-[10px] f-body max-w-[150px] text-right truncate"
                          style={{ color: 'rgba(153,27,27,0.65)' }}>
                          {row.guide_decline_reason}
                        </p>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                        style={{ background: stageSt.bg, color: stageSt.color, border: stageSt.border }}>
                        {stageSt.label}
                      </span>
                      {row.assigned_guide_id != null && row.guide_acceptance !== 'declined' && (
                        <ExternalOfferToggle inquiryId={row.id} initial={row.external_offer_sent} />
                      )}
                    </div>
                    <div className="flex items-center flex-shrink-0 pl-1">
                      <span className="text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                        style={{ color: '#E67E50' }}>→</span>
                    </div>
                  </div>
                </Link>
              )
            }

            // ── Angler view row ─────────────────────────────────────────────
            return (
              <Link key={row.id} href={`/admin/inquiries/${row.id}`} className="block group" style={{ textDecoration: 'none' }}>
                <div
                  className="flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md"
                  style={{
                    background: isNew
                      ? 'rgba(230,126,80,0.04)'
                      : isAttention ? 'rgba(239,68,68,0.025)' : '#FDFAF7',
                    border: isNew
                      ? '1px solid rgba(230,126,80,0.2)'
                      : isAttention
                        ? '1px solid rgba(239,68,68,0.15)'
                        : '1px solid rgba(10,46,77,0.07)',
                    boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
                  }}
                >
                  <div className="flex-shrink-0 flex flex-col items-center pt-1 gap-2">
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5"
                      style={{ background: st.color, boxShadow: `0 0 0 3px ${st.bg}` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold f-body text-[#0A2E4D] truncate">{row.angler_name}</span>
                      {row.party_size > 1 && (
                        <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}>
                          {row.party_size} pax
                        </span>
                      )}
                      <SilenceBadge row={row} />
                    </div>
                    <p className="text-xs f-body truncate mb-0.5" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {tripTitle} · {dateLabel}
                    </p>
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      {row.angler_email}
                      {row.angler_phone != null && row.angler_phone.trim() !== '' && (
                        <span style={{ marginLeft: 6 }}>· {row.angler_phone}</span>
                      )}
                    </p>
                    {row.next_action != null && row.next_action.trim() !== '' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.1em] f-body px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.2)' }}>
                          next
                        </span>
                        <span className="text-[11px] f-body font-medium truncate" style={{ color: '#0A2E4D' }}>
                          {row.next_action}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[120px]">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold f-body"
                      style={{ background: st.bg, color: st.color, border: st.border }}>
                      {st.label}
                    </span>
                    {row.internal_commission_eur != null && (
                      <span className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                        +{row.deal_currency === 'USD' ? '$' : '€'}{Number(row.internal_commission_eur).toFixed(0)}
                      </span>
                    )}
                    {row.status === 'lost' && row.lost_reason != null && row.lost_reason.trim() !== '' && (
                      <p className="text-[10px] f-body max-w-[140px] text-right truncate"
                        style={{ color: 'rgba(153,27,27,0.6)' }}>
                        {row.lost_reason}
                      </p>
                    )}
                    {row.last_contact_at != null && (
                      <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        contact {relativeTime(row.last_contact_at)}
                      </p>
                    )}
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.28)' }}>
                      {relativeTime(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center flex-shrink-0 pl-1">
                    <span className="text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                      style={{ color: '#E67E50' }}>→</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}
