import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPayoutsActions } from './AdminPayoutsActions'

/**
 * /admin/guides/[id]/payouts
 *
 * All bookings for a guide, grouped by payout_status.
 * Admin can send payouts or issue refunds from here.
 */

const PAYOUT_STYLE = {
  pending:  { bg: 'rgba(217,119,6,0.1)',   color: '#B45309', label: 'Pending' },
  sent:     { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Sent' },
  returned: { bg: 'rgba(239,68,68,0.08)', color: '#DC2626', label: 'Returned' },
} as const

const BOOKING_STYLE = {
  pending:   { color: 'rgba(10,46,77,0.45)', label: 'Pending' },
  accepted:  { color: '#D97706',             label: 'Accepted' },
  confirmed: { color: '#0A2E4D',             label: 'Confirmed' },
  completed: { color: '#16A34A',             label: 'Completed' },
  declined:  { color: '#DC2626',             label: 'Declined' },
  refunded:  { color: '#DC2626',             label: 'Refunded' },
  cancelled: { color: '#DC2626',             label: 'Cancelled' },
} as const

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function AdminGuidePayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: guide }, { data: bookings }] = await Promise.all([
    supabase
      .from('guides')
      .select('id, full_name, stripe_account_id')
      .eq('id', id)
      .single(),
    supabase
      .from('bookings')
      .select(
        'id, status, payout_status, payout_sent_at, total_eur, deposit_eur, guide_payout_eur, platform_fee_eur, booking_date, created_at, confirmed_at, angler_full_name, angler_email, stripe_payment_intent_id, experiences(title)',
      )
      .eq('guide_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (guide == null) notFound()

  const rows = bookings ?? []

  // Counts for summary pills
  const pendingCount  = rows.filter(b => b.payout_status === 'pending'  && ['confirmed', 'completed'].includes(b.status)).length
  const sentCount     = rows.filter(b => b.payout_status === 'sent').length
  const returnedCount = rows.filter(b => b.payout_status === 'returned').length

  // Total owed (pending payouts for confirmed/completed bookings)
  const pendingPayoutEur = rows
    .filter(b => b.payout_status === 'pending' && ['confirmed', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + (b.guide_payout_eur ?? 0), 0)

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/guides" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Guides</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href={`/admin/guides/${guide.id}`} className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>{guide.full_name}</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>Payouts</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[#0A2E4D] text-2xl font-bold f-display mb-1">Payouts — {guide.full_name}</h1>
          <p className="text-[#0A2E4D]/45 text-sm f-body">
            Manage guide payouts and angler refunds.
          </p>
        </div>
        <Link
          href={`/admin/guides/${guide.id}`}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full f-body"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          ← Guide profile
        </Link>
      </div>

      {/* ─── Summary row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-7 sm:grid-cols-4">
        {[
          { label: 'Pending payouts', value: pendingCount, sub: `€${pendingPayoutEur.toFixed(2)} owed`, color: '#B45309', bg: 'rgba(217,119,6,0.07)' },
          { label: 'Sent',           value: sentCount,    sub: 'paid out to guide',                     color: '#16A34A', bg: 'rgba(74,222,128,0.07)' },
          { label: 'Returned',       value: returnedCount, sub: 'refunded to angler',                   color: '#DC2626', bg: 'rgba(239,68,68,0.07)' },
          { label: 'Total bookings', value: rows.length,  sub: 'all time',                              color: '#0A2E4D', bg: 'rgba(10,46,77,0.04)' },
        ].map(card => (
          <div
            key={card.label}
            className="p-4 rounded-2xl"
            style={{ background: card.bg, border: `1px solid ${card.bg}` }}
          >
            <p className="text-[10px] uppercase tracking-[0.16em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>{card.label}</p>
            <p className="text-2xl font-bold f-display" style={{ color: card.color }}>{card.value}</p>
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Bookings table ──────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div
          className="flex items-center justify-center py-20 rounded-3xl"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.1)' }}
        >
          <p className="text-[#0A2E4D]/30 text-sm f-body">No bookings yet for this guide.</p>
        </div>
      ) : (
        <div
          style={{
            background: '#FDFAF7',
            borderRadius: '24px',
            border: '1px solid rgba(10,46,77,0.07)',
            boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            overflow: 'hidden',
          }}
        >
          <div className="overflow-x-auto">
          {/* Table header */}
          <div
            className="grid px-6 py-3"
            style={{
              gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1.4fr',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              background: 'rgba(10,46,77,0.02)',
              minWidth: '820px',
            }}
          >
            {['Booking', 'Angler', 'Amount', 'Guide payout', 'Status', 'Action'].map(col => (
              <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                {col}
              </p>
            ))}
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '820px' }}>
            {rows.map(booking => {
              const experienceTitle =
                (booking.experiences as unknown as { title: string } | null)?.title ?? '—'

              const ps = PAYOUT_STYLE[booking.payout_status as keyof typeof PAYOUT_STYLE] ?? PAYOUT_STYLE.pending
              const bs = BOOKING_STYLE[booking.status as keyof typeof BOOKING_STYLE] ?? BOOKING_STYLE.pending

              return (
                <div
                  key={booking.id}
                  className="grid items-center px-6 py-4"
                  style={{ gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1.4fr' }}
                >
                  {/* Trip + date */}
                  <div className="min-w-0 pr-3">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{experienceTitle}</p>
                    <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      {fmt(booking.booking_date)}
                    </p>
                    {booking.stripe_payment_intent_id != null && (
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(10,46,77,0.3)' }}>
                        {booking.stripe_payment_intent_id.slice(0, 16)}…
                      </p>
                    )}
                  </div>

                  {/* Angler */}
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] f-body font-medium truncate" style={{ color: '#0A2E4D' }}>
                      {booking.angler_full_name ?? '—'}
                    </p>
                    <p className="text-[10px] f-body truncate" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      {booking.angler_email ?? '—'}
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      €{booking.total_eur?.toFixed(2) ?? '—'}
                    </p>
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      fee €{booking.platform_fee_eur?.toFixed(2) ?? '0'}
                    </p>
                  </div>

                  {/* Guide payout */}
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      €{booking.guide_payout_eur?.toFixed(2) ?? '—'}
                    </p>
                    {booking.payout_sent_at && (
                      <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {fmt(booking.payout_sent_at)}
                      </p>
                    )}
                  </div>

                  {/* Status pills */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="self-start text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body"
                      style={{ background: ps.bg, color: ps.color }}
                    >
                      {ps.label}
                    </span>
                    <span
                      className="self-start text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body"
                      style={{ background: 'rgba(10,46,77,0.06)', color: bs.color }}
                    >
                      {bs.label}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex justify-end">
                    <AdminPayoutsActions
                      bookingId={booking.id}
                      payoutStatus={booking.payout_status}
                      bookingStatus={booking.status}
                      hasStripeAccount={guide.stripe_account_id != null}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          </div>{/* /overflow-x-auto */}
        </div>
      )}
    </div>
  )
}
