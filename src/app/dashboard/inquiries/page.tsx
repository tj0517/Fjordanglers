/**
 * /dashboard/inquiries — FA inquiry list.
 *
 * Shows all inquiries ordered by created_at desc.
 * Tabs: All / Pending / Deposit Sent / Confirmed
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending_fa_review: 'Pending review',
  deposit_sent:      'Deposit sent',
  deposit_paid:      'Confirmed',
  completed:         'Completed',
  cancelled:         'Cancelled',
}

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  pending_fa_review: { background: 'rgba(251,191,36,0.15)', color: '#92400E', border: '1px solid rgba(251,191,36,0.4)' },
  deposit_sent:      { background: 'rgba(59,130,246,0.12)', color: '#1E40AF', border: '1px solid rgba(59,130,246,0.3)' },
  deposit_paid:      { background: 'rgba(16,185,129,0.12)', color: '#065F46', border: '1px solid rgba(16,185,129,0.3)' },
  completed:         { background: 'rgba(107,114,128,0.10)', color: '#374151', border: '1px solid rgba(107,114,128,0.2)' },
  cancelled:         { background: 'rgba(239,68,68,0.10)',  color: '#991B1B', border: '1px solid rgba(239,68,68,0.25)' },
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) notFound()

  // Only admins/FA can access — check against a guide row with is_admin flag
  // For now: any authenticated user with access to the dashboard can view
  // (add proper admin guard when roles are implemented)

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

  // Fetch trip titles for all inquiries
  const tripIds = [...new Set((inquiries ?? []).map(i => i.trip_id).filter(Boolean))]
  const { data: trips } = tripIds.length > 0
    ? await svc.from('experiences').select('id, title').in('id', tripIds)
    : { data: [] as Array<{ id: string; title: string }> }

  const tripMap = new Map((trips ?? []).map(t => [t.id, t.title]))

  const tabs = [
    { key: 'all',              label: 'All' },
    { key: 'pending_fa_review', label: 'Pending' },
    { key: 'deposit_sent',      label: 'Deposit Sent' },
    { key: 'deposit_paid',      label: 'Confirmed' },
    { key: 'cancelled',         label: 'Cancelled' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] f-body mb-1"
          style={{ color: '#E67E50' }}>FA Admin</p>
        <h1 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Inquiries
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
          Review incoming inquiries and send deposit links.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/dashboard/inquiries' : `/dashboard/inquiries?status=${t.key}`}
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

      {/* List */}
      {(inquiries == null || inquiries.length === 0) ? (
        <div className="text-center py-16"
          style={{ background: '#FDFAF7', borderRadius: '20px', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            No inquiries found.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(inquiry => {
            const tripTitle = tripMap.get(inquiry.trip_id) ?? '—'
            const statusStyle = STATUS_COLOR[inquiry.status] ?? STATUS_COLOR.pending_fa_review

            return (
              <Link
                key={inquiry.id}
                href={`/dashboard/inquiries/${inquiry.id}`}
                className="block transition-all"
              >
                <div className="p-5 rounded-2xl transition-all hover:shadow-md"
                  style={{
                    background:  '#FDFAF7',
                    border:      '1px solid rgba(10,46,77,0.08)',
                    boxShadow:   '0 2px 8px rgba(10,46,77,0.04)',
                  }}>

                  <div className="flex items-start justify-between gap-4">
                    {/* Left: angler + trip */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
                          {inquiry.angler_name}
                        </p>
                        <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          {inquiry.angler_country}
                        </span>
                      </div>
                      <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {tripTitle}
                      </p>
                      <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {inquiry.angler_email}
                      </p>
                    </div>

                    {/* Right: meta */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold f-body"
                        style={statusStyle}>
                        {STATUS_LABEL[inquiry.status] ?? inquiry.status}
                      </span>
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {inquiry.requested_dates != null && inquiry.requested_dates.length > 0
                          ? fmtDate(inquiry.requested_dates[0]) + (inquiry.requested_dates.length > 1 ? ` +${inquiry.requested_dates.length - 1}` : '')
                          : '—'
                        } · {inquiry.party_size} pax
                      </p>
                      {inquiry.deposit_amount != null && (
                        <p className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                          €{Number(inquiry.deposit_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(10,46,77,0.05)' }}>
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
                      {new Date(inquiry.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <span className="text-[11px] font-semibold f-body" style={{ color: '#E67E50' }}>
                      View →
                    </span>
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
