'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Search, X, CalendarDays, List, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExternalOfferToggle } from './ExternalOfferToggle'
import { InquiriesCalendar } from './InquiriesCalendar'
import { STATUS_LABELS, type InquiryStatus } from '@/lib/inquiries/state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

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
  source:                  string | null
  qualified:               string
  trip_country:            string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WARM_DAYS  = 2
const COLD_DAYS  = 3
const STALE_DAYS = 7

const ACTIVE_STATUSES = new Set([
  'new', 'qualifying', 'waiting_guide', 'offer_presented', 'awaiting_payment',
])

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
  if (isNever)                { state = 'never'; label = 'No contact'      }
  else if (days >= STALE_DAYS){ state = 'stale'; label = `${days}d silent` }
  else if (days >= COLD_DAYS) { state = 'cold';  label = `${days}d silent` }
  else if (days >= WARM_DAYS) { state = 'warm';  label = `${days}d silent` }
  else                        { state = 'ok';    label = days === 0 ? 'Today' : '1d ago' }

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

  const [mainFilter, setMainFilter] = useState<MainFilter>(() => {
    const t = searchParams.get('tab')
    return (t === 'lead' || t === 'guide' || t === 'confirmed' || t === 'lost') ? t : 'lead'
  })
  const [subFilter,  setSubFilter ] = useState<string | null>(() => searchParams.get('sub'))
  const [openPopup,  setOpenPopup ] = useState<MainFilter | null>(null)

  const [q,       setQ      ] = useState(() => searchParams.get('q')    ?? '')
  const [localQ,  setLocalQ ] = useState(() => searchParams.get('q')    ?? '')
  const [from,    setFrom   ] = useState(() => searchParams.get('from') ?? '')
  const [to,      setTo     ] = useState(() => searchParams.get('to')   ?? '')

  const [countryFilter,   setCountryFilter  ] = useState(() => searchParams.get('country')    ?? '')
  const [guideIdFilter,   setGuideIdFilter  ] = useState(() => searchParams.get('guide_id')   ?? '')
  const [guideRespFilter, setGuideRespFilter] = useState(() => searchParams.get('guide_resp') ?? '')
  const [sourceFilter,    setSourceFilter   ] = useState(() => searchParams.get('source')     ?? '')
  const [qualifiedFilter, setQualifiedFilter] = useState(() => searchParams.get('qualified')  ?? '')
  const [slaFilter,       setSlaFilter      ] = useState(() => searchParams.get('sla') === '1')

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const p = new URLSearchParams()
    if (displayMode !== 'list') p.set('mode', displayMode)
    if (mainFilter !== 'lead')  p.set('tab',       mainFilter)
    if (subFilter != null)      p.set('sub',       subFilter)
    if (q)             p.set('q',          q)
    if (from)          p.set('from',       from)
    if (to)            p.set('to',         to)
    if (countryFilter)   p.set('country',    countryFilter)
    if (guideIdFilter)   p.set('guide_id',   guideIdFilter)
    if (guideRespFilter) p.set('guide_resp', guideRespFilter)
    if (sourceFilter)    p.set('source',     sourceFilter)
    if (qualifiedFilter) p.set('qualified',  qualifiedFilter)
    if (slaFilter)       p.set('sla',        '1')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [displayMode, mainFilter, subFilter, q, from, to, countryFilter, guideIdFilter, guideRespFilter, sourceFilter, qualifiedFilter, slaFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropdown options ───────────────────────────────────────────────────────
  const countries = useMemo(() =>
    [...new Set(allRows.map(r => r.trip_country ?? countryMap[r.id]).filter(Boolean) as string[])].sort(),
    [allRows, countryMap]
  )
  const guideOptions = useMemo(() =>
    Object.entries(guideMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    [guideMap]
  )
  const sources = useMemo(() =>
    [...new Set(allRows.map(r => r.source).filter(Boolean) as string[])].sort(),
    [allRows]
  )

  // ── Per-status counts ──────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of allRows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [allRows])

  // ── Group counts ───────────────────────────────────────────────────────────
  const groupCounts = useMemo(() => ({
    lead:      allRows.filter(r => STATUS_GROUPS.lead.includes(r.status)).length,
    guide:     allRows.filter(r => STATUS_GROUPS.guide.includes(r.status)).length,
    confirmed: allRows.filter(r => STATUS_GROUPS.confirmed.includes(r.status)).length,
    lost:      allRows.filter(r => STATUS_GROUPS.lost.includes(r.status)).length,
  }), [allRows])

  // ── Filtered rows ──────────────────────────────────────────────────────────
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
        (r.angler_email ?? '').toLowerCase().includes(lq) ||
        (tripMap[r.id]  ?? '').toLowerCase().includes(lq)
      )
    }
    if (from) result = result.filter(r => r.created_at >= from)
    if (to)   result = result.filter(r => r.created_at.slice(0, 10) <= to)

    if (countryFilter)
      result = result.filter(r => (r.trip_country ?? countryMap[r.id]) === countryFilter)

    if (guideIdFilter)
      result = result.filter(r => r.assigned_guide_id === guideIdFilter)

    if (guideRespFilter === 'none')
      result = result.filter(r => r.assigned_guide_id === null)
    else if (guideRespFilter === 'pending')
      result = result.filter(r => r.assigned_guide_id !== null && r.guide_acceptance === null)
    else if (guideRespFilter === 'accepted')
      result = result.filter(r => r.guide_acceptance === 'accepted')
    else if (guideRespFilter === 'declined')
      result = result.filter(r => r.guide_acceptance === 'declined')

    if (sourceFilter)
      result = result.filter(r => r.source === sourceFilter)

    if (qualifiedFilter === 'yes')
      result = result.filter(r => r.qualified === 'yes')
    else if (qualifiedFilter === 'no')
      result = result.filter(r => r.qualified === 'no')
    else if (qualifiedFilter === 'unknown')
      result = result.filter(r => r.qualified !== 'yes' && r.qualified !== 'no')

    if (slaFilter)
      result = result.filter(r => needsAttention(r) || noOfferSinceHours(r) !== null)

    return result
  }, [allRows, mainFilter, subFilter, q, from, to, countryFilter, guideIdFilter, guideRespFilter, sourceFilter, qualifiedFilter, slaFilter, tripMap, countryMap])

  // ── Stats ──────────────────────────────────────────────────────────────────
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

  const hasActiveFilters = q !== '' || from !== '' || to !== '' ||
    countryFilter !== '' || guideIdFilter !== '' || guideRespFilter !== '' ||
    sourceFilter !== '' || qualifiedFilter !== '' || slaFilter

  function commitSearch(value: string) { setQ(value.trim()) }

  function clearAllFilters() {
    setQ(''); setLocalQ(''); setFrom(''); setTo('')
    setCountryFilter(''); setGuideIdFilter(''); setGuideRespFilter('')
    setSourceFilter(''); setQualifiedFilter(''); setSlaFilter(false)
  }

  function switchMain(key: MainFilter) {
    setMainFilter(key)
    setSubFilter(null)
    setOpenPopup(null)
  }

  const activeSubLabel = subFilter != null
    ? SUB_OPTIONS[mainFilter].find(o => o.key === subFilter)?.label ?? null
    : null

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
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
          <div className="flex items-center rounded-[12px] overflow-hidden p-0.5 gap-0.5 bg-primary/[6%] border border-primary/10">
            {([
              { mode: 'list' as const,     icon: <List     size={14} />, title: 'List view'     },
              { mode: 'calendar' as const, icon: <Calendar size={14} />, title: 'Calendar view' },
            ]).map(({ mode, icon, title }) => (
              <Button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                title={title}
                variant={displayMode === mode ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'w-8 h-8 rounded-[9px]',
                  displayMode !== mode && 'text-primary/45',
                )}
              >
                {icon}
              </Button>
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

      {/* ─── Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Lead',      value: groupCounts.lead,      textClass: 'text-primary'     },
          { label: 'Guide',     value: groupCounts.guide,     textClass: 'text-purple-800'  },
          { label: 'Confirmed', value: groupCounts.confirmed, textClass: 'text-emerald-800' },
          { label: 'Lost',      value: groupCounts.lost,      textClass: 'text-red-800'     },
        ] as const).map(s => (
          <div
            key={s.label}
            className="px-4 py-3 rounded-[16px] bg-card border border-primary/7 shadow-[0_2px_10px_rgba(10,46,77,0.04)]"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] f-body mb-1 text-primary/40">{s.label}</p>
            <p className={cn('text-2xl font-bold f-display', s.textClass)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Commission + win rate ──────────────────────────────── */}
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
            <div className="px-4 py-3 rounded-[16px] bg-card border border-primary/7">
              <p className="text-[10px] uppercase tracking-[0.16em] f-body text-primary/40">Win rate</p>
              <p className="text-xl font-bold f-display text-primary">{convPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Calendar view ──────────────────────────────────────── */}
      {displayMode === 'calendar' && (
        <InquiriesCalendar allRows={allRows} tripMap={tripMap} slugMap={slugMap} countryMap={countryMap} />
      )}

      {/* ─── List view ──────────────────────────────────────────── */}
      {displayMode === 'list' && (<>

      {/* ─── Status group chips ─────────────────────────────────── */}
      {openPopup != null && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
      )}

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {(['lead', 'guide', 'confirmed', 'lost'] as const).map(key => {
          const active    = mainFilter === key
          const count     = groupCounts[key]
          const popupOpen = openPopup === key
          const subLabel  = active ? activeSubLabel : null

          return (
            <div key={key} className={cn('relative', popupOpen && 'z-50')}>
              <div className="flex items-center overflow-hidden rounded-full border border-primary/15">
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => switchMain(key)}
                  className={cn(
                    'rounded-none rounded-l-full pl-4 pr-2 h-8 border-0',
                    !active && 'text-primary/60',
                  )}
                >
                  {MAIN_LABELS[key]}
                  {subLabel != null && (
                    <span className="ml-1 text-[11px] font-normal opacity-70">· {subLabel}</span>
                  )}
                  <span className={cn(
                    'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    active ? 'bg-white/20 text-white' : 'bg-primary/[8%] text-primary/50',
                  )}>
                    {count}
                  </span>
                </Button>
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={e => {
                    e.stopPropagation()
                    if (!active) switchMain(key)
                    setOpenPopup(popupOpen ? null : key)
                  }}
                  className={cn(
                    'rounded-none rounded-r-full px-2 h-8 border-0 border-l border-primary/10',
                    !active && 'text-primary/45',
                  )}
                >
                  <span className={cn('text-xs transition-transform inline-block', popupOpen && 'rotate-180')}>▾</span>
                </Button>
              </div>

              {popupOpen && (
                <div className="absolute top-full left-0 mt-1.5 rounded-[16px] p-1.5 min-w-[200px] bg-popover border border-primary/10 shadow-[0_8px_32px_rgba(10,46,77,0.13)] z-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSubFilter(null); setOpenPopup(null) }}
                    className={cn(
                      'w-full justify-between font-semibold text-primary',
                      subFilter == null && 'bg-primary/[6%]',
                    )}
                  >
                    <span>All {MAIN_LABELS[key]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/[8%] text-primary/50">
                      {count}
                    </span>
                  </Button>
                  <div className="my-1 mx-2 h-px bg-primary/7" />
                  {SUB_OPTIONS[key].map(opt => {
                    const optCount  = statusCounts[opt.key] ?? 0
                    const optActive = subFilter === opt.key
                    return (
                      <Button
                        key={opt.key}
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSubFilter(opt.key); setOpenPopup(null) }}
                        className={cn(
                          'w-full justify-between',
                          opt.special ? 'text-destructive' : 'text-primary',
                          optActive && 'bg-primary/[6%] font-semibold',
                        )}
                      >
                        <span>{opt.label}</span>
                        {optCount > 0 && (
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            opt.special ? 'bg-destructive/10 text-destructive' : 'bg-primary/[8%] text-primary/50',
                          )}>
                            {optCount}
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {subFilter != null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubFilter(null)}
            className="text-primary/50 border border-primary/10"
          >
            <X size={10} className="mr-1" />
            {activeSubLabel}
          </Button>
        )}
      </div>

      {/* ─── Detailed filters ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={localQ}
            onChange={e => setLocalQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitSearch(localQ)
              if (e.key === 'Escape') { setLocalQ(''); setQ('') }
            }}
            onBlur={() => commitSearch(localQ)}
            placeholder="Name, email or trip…"
            className="pl-8 h-8 text-sm"
          />
          {localQ && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => { setLocalQ(''); setQ('') }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <X size={11} />
            </Button>
          )}
        </div>

        {/* From date */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 rounded-lg bg-background border h-8',
          from ? 'border-primary/25' : 'border-input',
        )}>
          <CalendarDays size={13} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex-shrink-0">From</span>
          <Input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            className={cn('border-0 shadow-none bg-transparent p-0 h-auto text-sm ring-0 focus-visible:ring-0', from ? 'text-foreground' : 'text-muted-foreground')}
          />
          {from && (
            <Button variant="ghost" size="icon-xs" onClick={() => setFrom('')} className="flex-shrink-0 -mr-1">
              <X size={11} />
            </Button>
          )}
        </div>

        {/* To date */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 rounded-lg bg-background border h-8',
          to ? 'border-primary/25' : 'border-input',
        )}>
          <CalendarDays size={13} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex-shrink-0">To</span>
          <Input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            className={cn('border-0 shadow-none bg-transparent p-0 h-auto text-sm ring-0 focus-visible:ring-0', to ? 'text-foreground' : 'text-muted-foreground')}
          />
          {to && (
            <Button variant="ghost" size="icon-xs" onClick={() => setTo('')} className="flex-shrink-0 -mr-1">
              <X size={11} />
            </Button>
          )}
        </div>

        {/* Country */}
        {countries.length > 0 && (
          <Select value={countryFilter || null} onValueChange={(v) => setCountryFilter(v ?? '')}>
            <SelectTrigger size="sm" className="min-w-[110px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Guide */}
        {guideOptions.length > 0 && (
          <Select value={guideIdFilter || null} onValueChange={(v) => setGuideIdFilter(v ?? '')}>
            <SelectTrigger size="sm" className="min-w-[110px]">
              <SelectValue placeholder="Guide" />
            </SelectTrigger>
            <SelectContent>
              {guideOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Guide response */}
        <Select value={guideRespFilter || null} onValueChange={(v) => setGuideRespFilter(v ?? '')}>
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue placeholder="Guide resp." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="accepted">✓ Accepted</SelectItem>
            <SelectItem value="declined">✗ Declined</SelectItem>
            <SelectItem value="pending">⏳ Awaiting</SelectItem>
            <SelectItem value="none">No guide</SelectItem>
          </SelectContent>
        </Select>

        {/* Source */}
        {sources.length > 0 && (
          <Select value={sourceFilter || null} onValueChange={(v) => setSourceFilter(v ?? '')}>
            <SelectTrigger size="sm" className="min-w-[100px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Qualified */}
        <Select value={qualifiedFilter || null} onValueChange={(v) => setQualifiedFilter(v ?? '')}>
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue placeholder="Qualified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Qualified ✓</SelectItem>
            <SelectItem value="no">Not qualified</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        {/* SLA */}
        <Button
          variant={slaFilter ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setSlaFilter(s => !s)}
          title="Show only inquiries needing attention (silence ≥3d or no offer 24h+)"
        >
          ⏱ SLA
        </Button>

        {/* Clear */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-destructive">
            <X className="mr-1 size-3" /> Clear
          </Button>
        )}
      </div>

      {/* ─── Results count ──────────────────────────────────────── */}
      {(hasActiveFilters || subFilter != null) && (
        <p className="text-xs f-body mb-4 text-primary/40">
          {rows.length === 0 ? 'No results' : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
          {hasActiveFilters && <span className="text-primary/30"> (filtered)</span>}
        </p>
      )}

      {/* ─── Table ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[190px]">Angler</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>Trip</TableHead>
              <TableHead className="hidden sm:table-cell whitespace-nowrap">Dates</TableHead>
              <TableHead className="hidden sm:table-cell text-center w-12">Pax</TableHead>
              <TableHead>Guide</TableHead>
              <TableHead className="hidden md:table-cell text-right whitespace-nowrap">€</TableHead>
              <TableHead className="hidden sm:table-cell whitespace-nowrap">Last contact</TableHead>
              <TableHead className="hidden lg:table-cell">Next action</TableHead>
              <TableHead>SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  {hasActiveFilters
                    ? 'No matches — try adjusting filters.'
                    : `No ${MAIN_LABELS[mainFilter].toLowerCase()} inquiries yet.`}
                </TableCell>
              </TableRow>
            ) : rows.map(row => {
              const tripTitle = tripMap[row.id] ?? '—'
              const country   = row.trip_country ?? countryMap[row.id] ?? null
              const dates     = row.requested_dates
              const dateLabel = dates?.length
                ? fmtDate(dates[0]) + (dates.length > 1 ? ` +${dates.length - 1}` : '')
                : '—'
              const guideName = row.assigned_guide_id
                ? (guideMap[row.assigned_guide_id] ?? 'Unknown')
                : null
              const showToggle = row.assigned_guide_id != null &&
                row.guide_acceptance === 'accepted' &&
                STATUS_GROUPS.guide.includes(row.status)

              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/inquiries/${row.id}`)}
                >
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/admin/inquiries/${row.id}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline text-sm leading-tight"
                        onClick={e => e.stopPropagation()}
                      >
                        {row.angler_name}
                      </Link>
                      <Badge data-status={row.status} className="status-badge w-fit text-[10px] h-auto py-0.5">
                        {STATUS_LABELS[row.status as InquiryStatus] ?? row.status}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground py-3">
                    <div className="truncate max-w-[180px]">{row.angler_email}</div>
                    {row.angler_phone && <div className="mt-0.5">{row.angler_phone}</div>}
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="font-medium text-foreground text-sm truncate max-w-[150px]" title={tripTitle}>
                      {tripTitle}
                    </div>
                    {country && <div className="text-xs text-muted-foreground mt-0.5">{country}</div>}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap py-3">
                    {dateLabel}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-center text-sm text-muted-foreground py-3">
                    {row.party_size}
                  </TableCell>

                  <TableCell className="text-xs py-3">
                    {guideName ? (
                      <div>
                        <span className="font-medium text-foreground text-sm">{guideName}</span>
                        <div className="mt-0.5">
                          {row.guide_acceptance === 'accepted' && (
                            <span className="text-emerald-600 text-[10px]">✓ Accepted</span>
                          )}
                          {row.guide_acceptance === 'declined' && (
                            <span
                              className="text-red-600 text-[10px] block max-w-[120px]"
                              title={row.guide_decline_reason ?? 'Declined'}
                            >
                              ✗ {row.guide_decline_reason
                                ? `"${row.guide_decline_reason.slice(0, 30)}${row.guide_decline_reason.length > 30 ? '…' : ''}"`
                                : 'Declined'}
                            </span>
                          )}
                          {row.guide_acceptance == null && (
                            <span className="text-yellow-700 text-[10px]">⏳ Awaiting</span>
                          )}
                        </div>
                        {showToggle && (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <ExternalOfferToggle inquiryId={row.id} initial={row.external_offer_sent} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-right text-xs font-semibold text-accent whitespace-nowrap py-3">
                    {row.internal_commission_eur != null
                      ? `${row.deal_currency === 'USD' ? '$' : '€'}${Number(row.internal_commission_eur).toFixed(0)}`
                      : <span className="text-muted-foreground font-normal">—</span>}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap py-3">
                    {row.last_contact_at ? relativeTime(row.last_contact_at) : '—'}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[160px] py-3">
                    {row.next_action ? (
                      <span className="truncate block" title={row.next_action}>
                        {row.next_action.slice(0, 50)}{row.next_action.length > 50 ? '…' : ''}
                      </span>
                    ) : '—'}
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <SilenceBadge row={row} />
                      <SlaBadge row={row} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      </>)}
    </div>
  )
}
