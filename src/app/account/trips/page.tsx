import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { MessageSquare } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

// Angler-facing status labels for inquiry bookings
const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  pending:        { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Sent'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'   },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer ready' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'    },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'   },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'   },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'   },
  declined:       { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(from: string | null, to: string | null): string {
  if (!from) return '—'
  const fmtFrom = new Date(`${from}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (!to || to === from) return fmtFrom
  const fmtTo = new Date(`${to}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmtFrom} – ${fmtTo}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerTripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/trips')

  // Service client — RLS may block some reads
  const serviceClient = createServiceClient()

  // Fetch inquiry bookings by user id OR email (covers non-linked bookings)
  const { data: byId } = await serviceClient
    .from('bookings')
    .select('id, angler_full_name, booking_date, date_to, target_species, guests, status, created_at, offer_price_eur, source')
    .eq('source', 'inquiry')
    .eq('angler_id', user.id)
    .order('created_at', { ascending: false })

  const { data: byEmail } = user.email
    ? await serviceClient
        .from('bookings')
        .select('id, angler_full_name, booking_date, date_to, target_species, guests, status, created_at, offer_price_eur, source')
        .eq('source', 'inquiry')
        .eq('angler_email', user.email)
        .is('angler_id', null)           // avoid duplicates with byId
        .order('created_at', { ascending: false })
    : { data: [] }

  // Merge + deduplicate
  const seen = new Set<string>()
  const inquiries = [...(byId ?? []), ...(byEmail ?? [])].filter(i => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
  inquiries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const activeCount = inquiries.filter(
    i => !['cancelled', 'completed', 'declined'].includes(i.status),
  ).length
  const offerCount     = inquiries.filter(i => i.status === 'offer_sent').length
  const confirmedCount = inquiries.filter(
    i => i.status === 'confirmed' || i.status === 'completed',
  ).length

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[900px]">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            My Account
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Trip <span style={{ fontStyle: 'italic' }}>Requests</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Your custom fishing trip requests and offers.
          </p>
        </div>
        <Link
          href="/trips"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          + New Request
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active requests', value: activeCount,    sub: 'in progress'         },
          { label: 'Offers ready',    value: offerCount,     sub: 'awaiting your reply'  },
          { label: 'Confirmed',       value: confirmedCount, sub: 'trips booked'         },
        ].map(s => (
          <div
            key={s.label}
            className="px-6 py-5"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
              {s.label}
            </p>
            <p className="text-[#0A2E4D] text-2xl font-bold f-display">{s.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Offer available banner */}
      {offerCount > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-6"
          style={{
            background: 'rgba(230,126,80,0.08)',
            border:     '1px solid rgba(230,126,80,0.25)',
          }}
        >
          <MessageSquare width={18} height={18} stroke="#E67E50" strokeWidth={1.5} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold f-body" style={{ color: '#E67E50' }}>
              You have {offerCount} offer{offerCount > 1 ? 's' : ''} waiting for your reply
            </p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Review the guide&apos;s offer and confirm your trip below.
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {inquiries.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center"
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
            <MessageSquare width={24} height={24} stroke="#E67E50" strokeWidth={1.5} />
          </div>
          <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">No requests yet</h3>
          <p className="text-[#0A2E4D]/45 text-sm f-body mb-6">
            Browse trips and click &quot;Request custom trip&quot; to get started.
          </p>
          <Link
            href="/trips"
            className="text-sm font-semibold f-body px-6 py-3 rounded-full text-white transition-all hover:brightness-110"
            style={{ background: '#E67E50' }}
          >
            Browse experiences →
          </Link>
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
          {/* Panel header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
          >
            <div>
              <h2 className="text-[#0A2E4D] text-base font-bold f-display">All Requests</h2>
              <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{inquiries.length} total</p>
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {inquiries.map(inquiry => {
              const statusKey = inquiry.status as BookingStatus
              const s          = STATUS_STYLES[statusKey] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D', label: statusKey }
              const isOffer    = inquiry.status === 'offer_sent'
              const speciesArr = (inquiry.target_species ?? []) as string[]
              const groupSize  = inquiry.guests ?? null
              const submitted  = new Date(inquiry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              const datesFrom  = inquiry.booking_date ?? null
              const datesTo    = (inquiry as unknown as { date_to?: string | null }).date_to ?? null

              return (
                <Link
                  key={inquiry.id}
                  href={`/account/trips/${inquiry.id}`}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-[#F8F4EF] transition-colors"
                  style={{
                    background: isOffer ? 'rgba(230,126,80,0.025)' : undefined,
                  }}
                >
                  {/* Date range pill */}
                  <div
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-center hidden sm:block"
                    style={{
                      background: 'rgba(10,46,77,0.05)',
                      minWidth: 100,
                    }}
                  >
                    <p className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {formatDateRange(datesFrom, datesTo)}
                    </p>
                  </div>

                  {/* Middle: species + meta */}
                  <div className="flex-1 min-w-0">
                    {/* Date range on mobile */}
                    <p className="text-xs font-semibold f-body mb-1 sm:hidden" style={{ color: '#0A2E4D' }}>
                      {formatDateRange(datesFrom, datesTo)}
                    </p>

                    {/* Species tags */}
                    {speciesArr.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {speciesArr.slice(0, 3).map(sp => (
                          <span
                            key={sp}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.65)' }}
                          >
                            {sp}
                          </span>
                        ))}
                        {speciesArr.length > 3 && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.4)' }}
                          >
                            +{speciesArr.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.35)' }}>—</p>
                    )}

                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
                      {groupSize != null ? `${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'} · ` : ''}Submitted {submitted}
                    </p>
                  </div>

                  {/* Right: status + price */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                    {isOffer && inquiry.offer_price_eur != null && (
                      <p className="text-sm font-bold f-display" style={{ color: '#E67E50' }}>
                        €{inquiry.offer_price_eur}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
