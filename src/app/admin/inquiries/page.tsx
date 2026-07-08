/**
 * /admin/inquiries — FA inquiry management list (CRM view).
 *
 * Cold-lead signals:
 *   • "Needs Attention" smart tab  → pending w/ no contact  OR  active + silent 3d+
 *   • Silence badge on every row   → colour-coded days since last contact
 *   • "New" pulse                  → pending inquiry with no contact < 24 h old
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { InquiriesFilters } from './InquiriesFilters'
import { ExternalOfferToggle } from './ExternalOfferToggle'

export const metadata = {
  title: 'Inquiries — Admin',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WARM_DAYS  = 2   // 2–3 days → yellow
const COLD_DAYS  = 3   // 3–7 days → orange
const STALE_DAYS = 7   // 7d+      → red

/** Statuses that are still active (need attention if silent) */
const ACTIVE_STATUSES = new Set([
  'pending', 'in_negotiation', 'waiting_for_guide_offer',
  'offer_sent', 'waiting_for_deposit', 'deposit_sent',
])

// ─── Status style map ─────────────────────────────────────────────────────────

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

// ─── Row type ─────────────────────────────────────────────────────────────────

interface InquiryRow {
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
  // guide tracking
  assigned_guide_id:       string | null
  guide_acceptance:        string | null
  guide_decline_reason:    string | null
  external_offer_sent:     boolean
}

// ─── Guide offer stage ────────────────────────────────────────────────────────

type GuideStage = 'no_guide' | 'awaiting_response' | 'declined' | 'needs_offer' | 'offer_sent'

function guideStage(row: InquiryRow, hasOffer: boolean): GuideStage {
  if (row.assigned_guide_id == null) return 'no_guide'
  if (row.guide_acceptance === 'declined') return 'declined'
  if (row.guide_acceptance == null) return 'awaiting_response'
  return (hasOffer || row.external_offer_sent) ? 'offer_sent' : 'needs_offer'
}

const GUIDE_STAGE_STYLE: Record<GuideStage, { label: string; color: string; bg: string; border: string }> = {
  no_guide:          { label: 'No guide',       color: 'rgba(10,46,77,0.4)',  bg: 'rgba(10,46,77,0.05)',    border: '1px solid rgba(10,46,77,0.1)'    },
  awaiting_response: { label: '⏳ Awaiting',    color: '#92400E',             bg: 'rgba(251,191,36,0.12)',  border: '1px solid rgba(251,191,36,0.35)' },
  declined:          { label: '✗ Declined',     color: '#991B1B',             bg: 'rgba(239,68,68,0.08)',   border: '1px solid rgba(239,68,68,0.2)'   },
  needs_offer:       { label: 'Needs offer',    color: '#1E40AF',             bg: 'rgba(59,130,246,0.1)',   border: '1px solid rgba(59,130,246,0.25)' },
  offer_sent:        { label: '✓ Offer sent',   color: '#065F46',             bg: 'rgba(16,185,129,0.1)',   border: '1px solid rgba(16,185,129,0.25)' },
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

/** Days since last contact (or since created_at if never contacted). */
function silenceDays(row: InquiryRow): number {
  const ref = row.last_contact_at ?? row.created_at
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
}

/**
 * A lead needs attention if:
 *  – it's active (pending/negotiating/deposit sent)  AND
 *  – either never contacted  OR  silent for 3+ days
 */
function needsAttention(row: InquiryRow): boolean {
  if (!ACTIVE_STATUSES.has(row.status)) return false
  if (row.last_contact_at == null) return true          // no first reply yet
  return silenceDays(row) >= COLD_DAYS
}

/** Brand new pending lead with no contact yet and <24h old. */
function isNewUnresponded(row: InquiryRow): boolean {
  if (row.status !== 'pending') return false
  if (row.last_contact_at != null) return false
  return (Date.now() - new Date(row.created_at).getTime()) < 86_400_000
}

// ─── Silence badge ────────────────────────────────────────────────────────────

function SilenceBadge({ row }: { row: InquiryRow }) {
  if (!ACTIVE_STATUSES.has(row.status)) return null

  const days = silenceDays(row)
  const isNever = row.last_contact_at == null

  let bg: string, color: string, border: string, label: string

  if (isNewUnresponded(row)) {
    // Pulsing "New" badge
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

  if (isNever) {
    bg = 'rgba(239,68,68,0.1)'; color = '#DC2626'; border = '1px solid rgba(239,68,68,0.25)'
    label = 'No contact'
  } else if (days >= STALE_DAYS) {
    bg = 'rgba(239,68,68,0.1)'; color = '#DC2626'; border = '1px solid rgba(239,68,68,0.25)'
    label = `${days}d silent`
  } else if (days >= COLD_DAYS) {
    bg = 'rgba(234,88,12,0.1)'; color = '#EA580C'; border = '1px solid rgba(234,88,12,0.25)'
    label = `${days}d silent`
  } else if (days >= WARM_DAYS) {
    bg = 'rgba(202,138,4,0.1)'; color = '#A16207'; border = '1px solid rgba(202,138,4,0.25)'
    label = `${days}d silent`
  } else {
    // Recent contact — subtle green
    bg = 'rgba(16,185,129,0.08)'; color = '#059669'; border = '1px solid rgba(16,185,129,0.2)'
    label = days === 0 ? 'Today' : '1d ago'
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
      style={{ background: bg, color, border }}
    >
      {label}
    </span>
  )
}

// ─── Status tab keys ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',                    label: 'All' },
  { key: 'needs_attention',        label: '⚡ Needs Attention' },
  { key: 'pending',                label: 'Pending' },
  { key: 'in_negotiation',         label: 'Negotiating' },
  { key: 'waiting_for_guide_offer',label: 'Waiting Guide' },
  { key: 'offer_sent',             label: 'Offer Sent' },
  { key: 'waiting_for_deposit',    label: 'Waiting Deposit' },
  { key: 'deposit_sent',           label: 'Deposit Sent' },
  { key: 'deposit_paid',           label: 'Confirmed' },
  { key: 'completed',              label: 'Completed' },
  { key: 'lost',                   label: 'Lost' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp     = await searchParams
  const filter = sp.status ?? 'all'
  const view   = (sp.view === 'guide') ? 'guide' : 'angler'
  const q      = (sp.q ?? '').trim().toLowerCase()
  const from   = sp.from ?? ''
  const to     = sp.to   ?? ''

  const svc = createServiceClient()

  // ── Fetch ALL rows (no filter) for accurate counts ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawAll } = await (svc as any)
    .from('inquiries')
    .select('id, status, angler_name, angler_email, angler_phone, requested_dates, party_size, created_at, trip_id, internal_commission_eur, deal_currency, lost_reason, last_contact_at, next_action, assigned_guide_id, guide_acceptance, guide_decline_reason, external_offer_sent')
    .order('created_at', { ascending: false })

  const allRows = (rawAll ?? []) as InquiryRow[]

  // ── Counts always from full data ───────────────────────────────────────────
  const counts = {
    all:                     allRows.length,
    needs_attention:         allRows.filter(needsAttention).length,
    pending:                 allRows.filter(r => r.status === 'pending').length,
    in_negotiation:          allRows.filter(r => r.status === 'in_negotiation').length,
    waiting_for_guide_offer: allRows.filter(r => r.status === 'waiting_for_guide_offer').length,
    offer_sent:              allRows.filter(r => r.status === 'offer_sent').length,
    waiting_for_deposit:     allRows.filter(r => r.status === 'waiting_for_deposit').length,
    deposit_sent:            allRows.filter(r => r.status === 'deposit_sent').length,
    deposit_paid:            allRows.filter(r => r.status === 'deposit_paid').length,
    completed:               allRows.filter(r => r.status === 'completed').length,
    lost:                    allRows.filter(r => r.status === 'lost').length,
  }

  // ── Apply filters ──────────────────────────────────────────────────────────
  let rows = allRows

  if (filter === 'needs_attention') {
    rows = rows.filter(needsAttention)
  } else if (filter !== 'all') {
    rows = rows.filter(r => r.status === filter)
  }
  if (q) {
    rows = rows.filter(r =>
      (r.angler_name  ?? '').toLowerCase().includes(q) ||
      (r.angler_email ?? '').toLowerCase().includes(q)
    )
  }
  if (from) {
    rows = rows.filter(r => r.created_at >= from)
  }
  if (to) {
    rows = rows.filter(r => r.created_at.slice(0, 10) <= to)
  }

  // Sort "needs attention" by worst silence first
  if (filter === 'needs_attention') {
    rows = [...rows].sort((a, b) => silenceDays(b) - silenceDays(a))
  }

  // ── Trip titles for displayed rows ─────────────────────────────────────────
  const tripIds = [...new Set(rows.map(r => r.trip_id).filter(Boolean))] as string[]
  const { data: trips } = tripIds.length > 0
    ? await svc.from('experiences').select('id, title').in('id', tripIds)
    : { data: [] as Array<{ id: string; title: string }> }

  const tripMap = new Map((trips ?? []).map(t => [t.id, t.title]))

  // ── Guide names for assigned inquiries ─────────────────────────────────────
  const guideIds = [...new Set(allRows.map(r => r.assigned_guide_id).filter(Boolean))] as string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: guidesData } = guideIds.length > 0
    ? await (svc as any).from('guides').select('id, full_name').in('id', guideIds)
    : { data: [] as Array<{ id: string; full_name: string }> }
  const guideMap = new Map(((guidesData ?? []) as Array<{ id: string; full_name: string }>).map(g => [g.id, g.full_name]))

  // ── Offer status: which inquiries have guide_options set ───────────────────
  const assignedInquiryIds = rows.filter(r => r.assigned_guide_id != null).map(r => r.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tripDetailsData } = assignedInquiryIds.length > 0
    ? await (svc as any)
        .from('inquiry_trip_details')
        .select('inquiry_id, guide_options')
        .in('inquiry_id', assignedInquiryIds)
    : { data: [] as Array<{ inquiry_id: string; guide_options: unknown }> }
  const offerSentSet = new Set(
    ((tripDetailsData ?? []) as Array<{ inquiry_id: string; guide_options: unknown }>)
      .filter(d => Array.isArray(d.guide_options) && (d.guide_options as unknown[]).length > 0)
      .map(d => d.inquiry_id)
  )

  // ── Stats (from full data) ─────────────────────────────────────────────────
  const USD_EUR_RATE   = 0.92
  const hasMixedCurrency = allRows.some(r => r.deal_currency === 'USD' && r.internal_commission_eur != null)
  const totalCommission = allRows.reduce((sum, r) => {
    const c = r.internal_commission_eur != null ? Number(r.internal_commission_eur) : 0
    if (!Number.isFinite(c)) return sum
    const eur = r.deal_currency === 'USD' ? c * USD_EUR_RATE : c
    return sum + eur
  }, 0)
  const wonCount    = counts.deposit_paid + counts.completed
  const closedCount = allRows.filter(r => !ACTIVE_STATUSES.has(r.status)).length
  const convPct     = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null

  // ── Helper: build tab href preserving current search/date/view params ──────
  function tabHref(key: string): string {
    const params = new URLSearchParams()
    if (q)            params.set('q',      q)
    if (from)         params.set('from',   from)
    if (to)           params.set('to',     to)
    if (view === 'guide') params.set('view', 'guide')
    if (key !== 'all') params.set('status', key)
    const qs = params.toString()
    return qs ? `/admin/inquiries?${qs}` : '/admin/inquiries'
  }

  function viewHref(v: 'angler' | 'guide'): string {
    const params = new URLSearchParams()
    if (q)    params.set('q',    q)
    if (from) params.set('from', from)
    if (to)   params.set('to',   to)
    if (filter !== 'all') params.set('status', filter)
    if (v === 'guide') params.set('view', 'guide')
    const qs = params.toString()
    return qs ? `/admin/inquiries?${qs}` : '/admin/inquiries'
  }

  const hasActiveFilters = q !== '' || from !== '' || to !== ''

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { label: 'Pending',     value: counts.pending,        color: '#92400E' },
          { label: 'Negotiating', value: counts.in_negotiation, color: '#5B21B6' },
          { label: 'Won',         value: wonCount,                  color: '#065F46' },
          { label: 'Lost',        value: counts.lost,               color: '#991B1B' },
          {
            label: '⚡ Need Action',
            value: counts.needs_attention,
            color: counts.needs_attention > 0 ? '#DC2626' : '#374151',
            highlight: counts.needs_attention > 0,
          },
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
                  €{totalCommission.toFixed(0)}{hasMixedCurrency && <span className="text-sm font-normal ml-1" style={{ color: 'rgba(10,46,77,0.45)' }}>≈ EUR</span>}
                </p>
              </div>
            </div>
          )}
          {convPct != null && (
            <div className="px-4 py-3 rounded-[16px]"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.16em] f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Win rate</p>
              <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                {convPct}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Search + date filters ────────────────────────────────────── */}
      <div className="mb-4">
        <Suspense fallback={null}>
          <InquiriesFilters />
        </Suspense>
      </div>

      {/* ─── Status tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-5">
        {TABS.map(t => {
          const count  = counts[t.key as keyof typeof counts] ?? 0
          const active = filter === t.key
          const isAlert = t.key === 'needs_attention' && count > 0 && !active
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold f-body transition-all"
              style={{
                background: active
                  ? (t.key === 'needs_attention' ? '#DC2626' : '#0A2E4D')
                  : isAlert
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(10,46,77,0.06)',
                color: active
                  ? '#fff'
                  : isAlert
                    ? '#DC2626'
                    : 'rgba(10,46,77,0.6)',
                border: active
                  ? 'none'
                  : isAlert
                    ? '1px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(10,46,77,0.1)',
              }}
            >
              {t.label}
              {t.key !== 'all' && count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(255,255,255,0.2)' : isAlert ? 'rgba(239,68,68,0.15)' : 'rgba(10,46,77,0.1)',
                    color:      active ? 'rgba(255,255,255,0.9)' : isAlert ? '#DC2626'               : 'rgba(10,46,77,0.5)',
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* ─── View toggle ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        {(['angler', 'guide'] as const).map(v => (
          <Link
            key={v}
            href={viewHref(v)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
            style={{
              background: view === v ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
              color:      view === v ? '#fff'    : 'rgba(10,46,77,0.55)',
              border:     view === v ? 'none'    : '1px solid rgba(10,46,77,0.1)',
            }}
          >
            {v === 'angler' ? '👤 Angler view' : '🎣 Guide view'}
          </Link>
        ))}
      </div>

      {/* ─── Results count ───────────────────────────────────────────── */}
      {(hasActiveFilters || filter !== 'all') && (
        <p className="text-xs f-body mb-4" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {rows.length === 0
            ? 'No results'
            : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
          {hasActiveFilters && (
            <span style={{ color: 'rgba(10,46,77,0.3)' }}> (filtered)</span>
          )}
        </p>
      )}

      {/* ─── List ────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[24px] text-center"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.12)' }}>
          <p className="text-[#0A2E4D]/40 text-base f-display mb-1">
            {filter === 'needs_attention' ? '🎉 All caught up!' : hasActiveFilters ? 'No matches' : 'No inquiries yet'}
          </p>
          <p className="text-[#0A2E4D]/30 text-sm f-body">
            {filter === 'needs_attention'
              ? 'No leads need attention right now.'
              : hasActiveFilters
                ? 'Try adjusting your search or date range.'
                : 'New inquiries will appear here.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(row => {
            const st        = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending_fa_review
            const tripTitle = row.trip_id != null ? (tripMap.get(row.trip_id) ?? '—') : '—'
            const dates     = row.requested_dates
            const dateLabel = dates != null && dates.length > 0
              ? fmtDate(dates[0]) + (dates.length > 1 ? ` +${dates.length - 1}` : '')
              : '—'
            const isAttention = needsAttention(row)
            const isNew       = isNewUnresponded(row)

            // ── Guide view row ─────────────────────────────────────────────
            if (view === 'guide') {
              const hasOffer   = offerSentSet.has(row.id)
              const stage      = guideStage(row, hasOffer)
              const stageSt    = GUIDE_STAGE_STYLE[stage]
              const guideName  = row.assigned_guide_id != null
                ? (guideMap.get(row.assigned_guide_id) ?? 'Unknown guide')
                : null

              return (
                <Link
                  key={row.id}
                  href={`/admin/inquiries/${row.id}`}
                  className="block group"
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md"
                    style={{
                      background: stage === 'awaiting_response' ? 'rgba(251,191,36,0.04)' : '#FDFAF7',
                      border:     stage === 'awaiting_response'
                        ? '1px solid rgba(251,191,36,0.25)'
                        : stage === 'declined'
                          ? '1px solid rgba(239,68,68,0.15)'
                          : '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
                    }}
                  >
                    {/* Stage dot */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-0.5"
                        style={{ background: stageSt.color, boxShadow: `0 0 0 3px ${stageSt.bg}` }}
                      />
                    </div>

                    {/* Left: angler + trip */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-bold f-body text-[#0A2E4D] truncate">
                          {row.angler_name}
                        </span>
                        {row.party_size > 1 && (
                          <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}>
                            {row.party_size} pax
                          </span>
                        )}
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                          style={{ background: st.bg, color: st.color, border: st.border }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {tripTitle} · {dateLabel}
                      </p>
                    </div>

                    {/* Right: guide + stage */}
                    <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[160px]">
                      {/* Guide name */}
                      <span className="text-xs font-bold f-body text-right" style={{ color: '#0A2E4D' }}>
                        {guideName ?? <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>Unassigned</span>}
                      </span>

                      {/* Guide acceptance */}
                      {row.assigned_guide_id != null && (
                        <span className="text-[10px] f-body font-semibold">
                          {row.guide_acceptance === 'accepted' && <span style={{ color: '#059669' }}>✓ Accepted</span>}
                          {row.guide_acceptance === 'declined' && <span style={{ color: '#DC2626' }}>✗ Declined</span>}
                          {row.guide_acceptance == null        && <span style={{ color: '#A16207' }}>⏳ No response</span>}
                        </span>
                      )}

                      {/* Decline reason */}
                      {row.guide_decline_reason != null && row.guide_decline_reason.trim() !== '' && (
                        <p className="text-[10px] f-body max-w-[150px] text-right truncate"
                          style={{ color: 'rgba(153,27,27,0.65)' }}>
                          {row.guide_decline_reason}
                        </p>
                      )}

                      {/* Offer stage badge */}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                        style={{ background: stageSt.bg, color: stageSt.color, border: stageSt.border }}
                      >
                        {stageSt.label}
                      </span>

                      {/* External offer toggle */}
                      {row.assigned_guide_id != null && row.guide_acceptance !== 'declined' && (
                        <ExternalOfferToggle
                          inquiryId={row.id}
                          initial={row.external_offer_sent}
                        />
                      )}
                    </div>

                    {/* Caret */}
                    <div className="flex items-center flex-shrink-0 pl-1">
                      <span className="text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                        style={{ color: '#E67E50' }}>→</span>
                    </div>
                  </div>
                </Link>
              )
            }

            // ── Angler view row (original) ─────────────────────────────────
            return (
              <Link
                key={row.id}
                href={`/admin/inquiries/${row.id}`}
                className="block group"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="flex gap-4 px-5 py-4 rounded-[20px] transition-all group-hover:shadow-md"
                  style={{
                    background: isNew
                      ? 'rgba(230,126,80,0.04)'
                      : isAttention
                        ? 'rgba(239,68,68,0.025)'
                        : '#FDFAF7',
                    border: isNew
                      ? '1px solid rgba(230,126,80,0.2)'
                      : isAttention
                        ? '1px solid rgba(239,68,68,0.15)'
                        : '1px solid rgba(10,46,77,0.07)',
                    boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
                  }}
                >
                  {/* ── Status dot ─────────────────────────────── */}
                  <div className="flex-shrink-0 flex flex-col items-center pt-1 gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-0.5"
                      style={{ background: st.color, boxShadow: `0 0 0 3px ${st.bg}` }}
                    />
                  </div>

                  {/* ── Left: angler + trip ─────────────────────── */}
                  <div className="flex-1 min-w-0">
                    {/* Name + pax + silence badge */}
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold f-body text-[#0A2E4D] truncate">
                        {row.angler_name}
                      </span>
                      {row.party_size > 1 && (
                        <span className="text-[10px] f-body flex-shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}>
                          {row.party_size} pax
                        </span>
                      )}
                      <SilenceBadge row={row} />
                    </div>

                    {/* Trip */}
                    <p className="text-xs f-body truncate mb-0.5" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {tripTitle} · {dateLabel}
                    </p>

                    {/* Contact */}
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      {row.angler_email}
                      {row.angler_phone != null && row.angler_phone.trim() !== '' && (
                        <span style={{ marginLeft: 6 }}>· {row.angler_phone}</span>
                      )}
                    </p>

                    {/* Next action — highlighted */}
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

                  {/* ── Right: status + meta ────────────────────── */}
                  <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[120px]">
                    {/* Status badge */}
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold f-body"
                      style={{ background: st.bg, color: st.color, border: st.border }}
                    >
                      {st.label}
                    </span>

                    {/* Commission */}
                    {row.internal_commission_eur != null && (
                      <span className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                        +{row.deal_currency === 'USD' ? '$' : '€'}{Number(row.internal_commission_eur).toFixed(0)}
                      </span>
                    )}

                    {/* Lost reason */}
                    {row.status === 'lost' && row.lost_reason != null && row.lost_reason.trim() !== '' && (
                      <p className="text-[10px] f-body max-w-[140px] text-right truncate"
                        style={{ color: 'rgba(153,27,27,0.6)' }}>
                        {row.lost_reason}
                      </p>
                    )}

                    {/* Last contact */}
                    {row.last_contact_at != null && (
                      <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        contact {relativeTime(row.last_contact_at)}
                      </p>
                    )}

                    {/* Created */}
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.28)' }}>
                      {relativeTime(row.created_at)}
                    </p>
                  </div>

                  {/* ── Caret ────────────────────────────────────── */}
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
