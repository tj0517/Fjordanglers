/**
 * /admin/inquiries — FA inquiry management list.
 *
 * Shows all inquiries ordered newest-first.
 * FA can filter by status and click through to the detail page to send deposit links.
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Inquiries — Admin',
}

// ─── Status style map ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_fa_review: { label: 'Pending review', color: '#92400E', bg: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' },
  deposit_sent:      { label: 'Deposit sent',   color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)' },
  deposit_paid:      { label: 'Confirmed',       color: '#065F46', bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' },
  completed:         { label: 'Completed',       color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)' },
  cancelled:         { label: 'Cancelled',       color: '#991B1B', bg: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.25)' },
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp     = await searchParams
  const filter = sp.status ?? 'all'

  const svc = createServiceClient()

  let query = svc
    .from('inquiries')
    .select('id, status, angler_name, angler_email, angler_country, requested_dates, party_size, deposit_amount, created_at, trip_id')
    .order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data: inquiries } = await query

  // Fetch trip titles
  const tripIds = [...new Set((inquiries ?? []).map(i => i.trip_id).filter(Boolean))]
  const { data: trips } = tripIds.length > 0
    ? await svc.from('experiences').select('id, title').in('id', tripIds)
    : { data: [] as Array<{ id: string; title: string }> }

  const tripMap = new Map((trips ?? []).map(t => [t.id, t.title]))

  const rows = inquiries ?? []

  const counts = {
    all:               rows.length === 0 && filter !== 'all' ? '—' : rows.length,
    pending_fa_review: rows.filter(r => r.status === 'pending_fa_review').length,
    deposit_sent:      rows.filter(r => r.status === 'deposit_sent').length,
    deposit_paid:      rows.filter(r => r.status === 'deposit_paid').length,
    cancelled:         rows.filter(r => r.status === 'cancelled').length,
  }

  const tabs = [
    { key: 'all',               label: 'All' },
    { key: 'pending_fa_review', label: 'Pending' },
    { key: 'deposit_sent',      label: 'Deposit Sent' },
    { key: 'deposit_paid',      label: 'Confirmed' },
    { key: 'cancelled',         label: 'Cancelled' },
  ]

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Inquiry <span style={{ fontStyle: 'italic' }}>Management</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Review incoming inquiries and send deposit links to anglers.
          </p>
        </div>
      </div>

      {/* ─── Stats row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {([
          { label: 'Pending',       value: counts.pending_fa_review, color: '#92400E' },
          { label: 'Deposit Sent',  value: counts.deposit_sent,      color: '#1E40AF' },
          { label: 'Confirmed',     value: counts.deposit_paid,       color: '#065F46' },
          { label: 'Cancelled',     value: counts.cancelled,          color: '#6B7280' },
        ] as const).map(s => (
          <div key={s.label}
            className="px-4 py-3 rounded-[16px]"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.04)' }}>
            <p className="text-[10px] uppercase tracking-[0.16em] f-body mb-1"
              style={{ color: 'rgba(10,46,77,0.4)' }}>{s.label}</p>
            <p className="text-2xl font-bold f-display" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Filter tabs ─────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/admin/inquiries' : `/admin/inquiries?status=${t.key}`}
            className="px-4 py-2 rounded-full text-sm font-semibold f-body transition-all"
            style={{
              background: filter === t.key ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
              color:      filter === t.key ? '#fff'    : 'rgba(10,46,77,0.6)',
              border:     filter === t.key ? 'none'    : '1px solid rgba(10,46,77,0.1)',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ─── List ────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[24px] text-center"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.12)' }}>
          <p className="text-[#0A2E4D]/45 text-sm f-body">
            {filter === 'all' ? 'No inquiries yet.' : `No inquiries with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const st        = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending_fa_review
            const tripTitle = tripMap.get(row.trip_id) ?? '—'
            const dates     = row.requested_dates as string[] | null
            const dateLabel = dates != null && dates.length > 0
              ? fmtDate(dates[0]) + (dates.length > 1 ? ` +${dates.length - 1}` : '')
              : '—'

            return (
              <Link
                key={row.id}
                href={`/admin/inquiries/${row.id}`}
                className="block transition-all hover:translate-y-[-1px]"
              >
                <div
                  className="flex items-center gap-4 px-6 py-4 rounded-[20px]"
                  style={{
                    background:  '#FDFAF7',
                    border:      '1px solid rgba(10,46,77,0.07)',
                    boxShadow:   '0 2px 10px rgba(10,46,77,0.04)',
                    transition:  'box-shadow 0.15s',
                  }}
                >
                  {/* Status dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: st.color }}
                  />

                  {/* Angler + trip */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold f-body text-[#0A2E4D] truncate">
                        {row.angler_name}
                      </p>
                      <span className="text-[10px] f-body flex-shrink-0"
                        style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {row.angler_country}
                      </span>
                    </div>
                    <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {tripTitle}
                    </p>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      {row.angler_email}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold f-body"
                      style={{ background: st.bg, color: st.color, border: st.border }}
                    >
                      {st.label}
                    </span>
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      {dateLabel} · {row.party_size} pax
                    </p>
                    {row.deposit_amount != null && (
                      <p className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                        €{Number(row.deposit_amount).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Date + caret */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                      {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <span className="text-[11px] font-semibold f-body" style={{ color: '#E67E50' }}>→</span>
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
