import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

const STATUS_STYLES: Record<InquiryStatus, { bg: string; color: string; label: string }> = {
  inquiry:        { bg: 'rgba(59,130,246,0.1)',    color: '#2563EB', label: 'New'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',    color: '#7C3AED', label: 'Reviewing'  },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',   color: '#E67E50', label: 'Offer Sent' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',    color: '#2563EB', label: 'Accepted'   },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',    color: '#16A34A', label: 'Confirmed'  },
  completed:      { bg: 'rgba(74,222,128,0.1)',    color: '#16A34A', label: 'Completed'  },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',     color: '#DC2626', label: 'Cancelled'  },
}

// ─── Filter tabs definition ────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all',       label: 'All',          statuses: null                                       },
  { key: 'new',       label: 'Needs reply',  statuses: ['inquiry', 'reviewing']       as const    },
  { key: 'sent',      label: 'Offer sent',   statuses: ['offer_sent', 'offer_accepted'] as const  },
  { key: 'confirmed', label: 'Confirmed',    statuses: ['confirmed', 'completed']     as const    },
  { key: 'declined',  label: 'Declined',     statuses: ['cancelled']                  as const    },
] as const

type FilterKey = (typeof FILTER_TABS)[number]['key']

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function GuideInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">
        <p className="text-[#0A2E4D]/45 text-sm f-body">
          Please{' '}
          <Link href="/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to view requests.
        </p>
      </div>
    )
  }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">
        <p className="text-[#0A2E4D]/45 text-sm f-body">No guide profile found.</p>
      </div>
    )
  }

  const serviceClient = createServiceClient()

  // Fetch assigned + unassigned open inquiries
  const [{ data: assigned }, { data: unassigned }] = await Promise.all([
    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, angler_email, dates_from, dates_to, target_species, group_size, status, created_at')
      .eq('assigned_guide_id', guide.id)
      .order('created_at', { ascending: false }),

    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, angler_email, dates_from, dates_to, target_species, group_size, status, created_at')
      .is('assigned_guide_id', null)
      .in('status', ['inquiry', 'reviewing'])
      .order('created_at', { ascending: false }),
  ])

  // Merge, deduplicate, sort newest first
  const seen = new Set<string>()
  const all = [...(assigned ?? []), ...(unassigned ?? [])].filter(i => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
  all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // ── Filter state ───────────────────────────────────────────────────────────

  const sp = await searchParams
  const statusFilter: FilterKey = (() => {
    const v = sp.status
    return FILTER_TABS.some(t => t.key === v) ? (v as FilterKey) : 'all'
  })()

  // Counts per tab (from the full list)
  const tabsWithCounts = FILTER_TABS.map(tab => ({
    ...tab,
    count: tab.statuses
      ? all.filter(i => (tab.statuses as readonly string[]).includes(i.status)).length
      : all.length,
  }))

  // Filtered rows for display
  const activeTab = FILTER_TABS.find(t => t.key === statusFilter) ?? FILTER_TABS[0]
  const displayed = activeTab.statuses
    ? all.filter(i => (activeTab.statuses as readonly string[]).includes(i.status))
    : all

  // ── Stats (based on assigned inquiries only) ────────────────────────────────
  const assignedAll    = assigned ?? []
  const pendingCount   = assignedAll.filter(i => i.status === 'inquiry' || i.status === 'reviewing').length
  const offerSentCount = assignedAll.filter(i => i.status === 'offer_sent').length
  const confirmedCount = assignedAll.filter(i => i.status === 'confirmed' || i.status === 'completed').length

  const STATS = [
    { label: 'Pending response', value: pendingCount,   sub: 'assigned to you' },
    { label: 'Offer sent',       value: offerSentCount, sub: 'awaiting angler'  },
    { label: 'Confirmed',        value: confirmedCount, sub: 'confirmed & done' },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* Header */}
      <div className="mb-8">
        <p
          className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Custom <span style={{ fontStyle: 'italic' }}>Requests</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Concierge requests assigned to you or open for claiming.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {STATS.map(stat => (
          <div
            key={stat.label}
            className="px-6 py-5"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body"
              style={{ color: 'rgba(10,46,77,0.42)' }}
            >
              {stat.label}
            </p>
            <p className="text-[#0A2E4D] text-2xl font-bold f-display">{stat.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 mb-6 overflow-x-auto"
        style={{
          background:   'rgba(10,46,77,0.05)',
          borderRadius: '14px',
          width:        'fit-content',
          maxWidth:     '100%',
        }}
      >
        {tabsWithCounts.map(tab => {
          const isActive = statusFilter === tab.key
          const href = tab.key === 'all'
            ? '/dashboard/inquiries'
            : `/dashboard/inquiries?status=${tab.key}`

          return (
            <Link
              key={tab.key}
              href={href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm f-body transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'white' : 'transparent',
                color:      isActive ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
                fontWeight: isActive ? 600 : 400,
                boxShadow:  isActive ? '0 1px 4px rgba(10,46,77,0.1)' : 'none',
                textDecoration: 'none',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.06)',
                    color:      isActive ? 'rgba(10,46,77,0.6)' : 'rgba(10,46,77,0.4)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* ── Inquiries list ────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{
            background:   '#FDFAF7',
            borderRadius: '24px',
            border:       '2px dashed rgba(10,46,77,0.12)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(230,126,80,0.1)' }}
          >
            <svg width="22" height="22" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.4">
              <path d="M1.5 2.5h12a1 1 0 011 1v7a1 1 0 01-1 1H4l-3 2.5V3.5a1 1 0 011-1z" />
            </svg>
          </div>
          <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">
            {statusFilter === 'all' ? 'No requests yet' : 'No requests in this category'}
          </h3>
          <p className="text-[#0A2E4D]/45 text-sm f-body">
            {statusFilter === 'all'
              ? 'Custom trip requests assigned to you will appear here.'
              : 'Try a different filter above.'}
          </p>
          {statusFilter !== 'all' && (
            <Link
              href="/dashboard/inquiries"
              className="mt-4 text-xs font-semibold f-body hover:underline"
              style={{ color: '#E67E50' }}
            >
              Show all requests →
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            background:   '#FDFAF7',
            borderRadius: '24px',
            border:       '1px solid rgba(10,46,77,0.07)',
            boxShadow:    '0 2px 16px rgba(10,46,77,0.05)',
            overflow:     'hidden',
          }}
        >
          {/* Table header */}
          <div
            className="grid px-6 py-3"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 100px 110px',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              background:   'rgba(10,46,77,0.02)',
              gap: '12px',
            }}
          >
            {['Angler', 'Dates', 'Species', 'Group', 'Status', 'Submitted'].map(col => (
              <p
                key={col}
                className="text-[10px] uppercase tracking-[0.18em] f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                {col}
              </p>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {displayed.map(inquiry => {
              const s = STATUS_STYLES[inquiry.status]
              const submitted = new Date(inquiry.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })
              const speciesArr = (inquiry.target_species ?? []) as string[]
              const speciesShort = speciesArr.slice(0, 2).join(', ')
              const speciesMore  = Math.max(0, speciesArr.length - 2)

              // Is this a "needs action" inquiry?
              const needsAction = inquiry.status === 'inquiry' || inquiry.status === 'reviewing'

              return (
                <Link
                  key={inquiry.id}
                  href={`/dashboard/inquiries/${inquiry.id}`}
                  className="grid items-center px-6 py-4 transition-colors hover:bg-[#F8F4EE]"
                  style={{
                    gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 100px 110px',
                    gap:        '12px',
                    display:    'grid',
                    background: needsAction ? 'rgba(59,130,246,0.015)' : undefined,
                  }}
                >
                  {/* Angler */}
                  <div className="min-w-0 flex items-center gap-2">
                    {needsAction && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#2563EB' }}
                        title="Needs reply"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">
                        {inquiry.angler_name}
                      </p>
                      <p className="text-[#0A2E4D]/40 text-xs f-body truncate">
                        {inquiry.angler_email}
                      </p>
                    </div>
                  </div>

                  {/* Dates */}
                  <p className="text-[#0A2E4D]/65 text-xs f-body">
                    {inquiry.dates_from} – {inquiry.dates_to}
                  </p>

                  {/* Species */}
                  <p className="text-[#0A2E4D]/65 text-xs f-body truncate">
                    {speciesShort}
                    {speciesMore > 0 && ` +${speciesMore}`}
                  </p>

                  {/* Group */}
                  <p className="text-[#0A2E4D]/65 text-sm font-medium f-body">
                    {inquiry.group_size}
                  </p>

                  {/* Status */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full self-start f-body"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>

                  {/* Submitted */}
                  <p className="text-[#0A2E4D]/38 text-xs f-body">{submitted}</p>
                </Link>
              )
            })}
          </div>

          {/* Footer row: total count */}
          <div
            className="px-6 py-3"
            style={{ borderTop: '1px solid rgba(10,46,77,0.06)', background: 'rgba(10,46,77,0.015)' }}
          >
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              {displayed.length} {displayed.length === 1 ? 'request' : 'requests'}
              {statusFilter !== 'all' && ` · showing "${activeTab.label}" filter`}
            </p>
          </div>

        </div>
      )}
    </div>
  )
}
