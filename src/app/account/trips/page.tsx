import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { MessageSquare } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

const STATUS_STYLES: Record<InquiryStatus, { bg: string; color: string; label: string }> = {
  inquiry:        { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Sent'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'   },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer ready' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'    },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'   },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'   },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'   },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerTripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/trips')

  // Use service client — RLS on trip_inquiries blocks anon reads
  const serviceClient = createServiceClient()

  // Fetch inquiries by user id OR email (covers non-linked inquiries)
  const { data: byId } = await serviceClient
    .from('trip_inquiries')
    .select('id, angler_name, dates_from, dates_to, target_species, group_size, status, created_at, offer_price_eur')
    .eq('angler_id', user.id)
    .order('created_at', { ascending: false })

  const { data: byEmail } = user.email
    ? await serviceClient
        .from('trip_inquiries')
        .select('id, angler_name, dates_from, dates_to, target_species, group_size, status, created_at, offer_price_eur')
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

  const activeCount    = inquiries.filter(i => !['cancelled', 'completed'].includes(i.status)).length
  const offerCount     = inquiries.filter(i => i.status === 'offer_sent').length
  const confirmedCount = inquiries.filter(i => i.status === 'confirmed' || i.status === 'completed').length

  return (
    <div className="px-10 py-10 max-w-[1100px]">

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
          { label: 'Active requests', value: activeCount,    sub: 'in progress'      },
          { label: 'Offers ready',    value: offerCount,     sub: 'awaiting your reply' },
          { label: 'Confirmed',       value: confirmedCount, sub: 'trips booked'      },
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
          <span className="text-xl">📬</span>
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
            Browse trips and click "Request custom trip" to get started.
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
          {/* Table header */}
          <div
            className="grid px-6 py-3 text-[10px] uppercase tracking-[0.18em] f-body"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 120px 110px',
              gap:          '12px',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              background:   'rgba(10,46,77,0.02)',
              color:        'rgba(10,46,77,0.38)',
            }}
          >
            {['Dates', 'Species', 'Location', 'Group', 'Status', 'Submitted'].map(col => (
              <span key={col}>{col}</span>
            ))}
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {inquiries.map(inquiry => {
              const s           = STATUS_STYLES[inquiry.status]
              const isOffer     = inquiry.status === 'offer_sent'
              const speciesArr  = (inquiry.target_species ?? []) as string[]
              const speciesText = speciesArr.slice(0, 2).join(', ') + (speciesArr.length > 2 ? ` +${speciesArr.length - 2}` : '')
              const submitted   = new Date(inquiry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

              return (
                <Link
                  key={inquiry.id}
                  href={`/account/trips/${inquiry.id}`}
                  className="grid items-center px-6 py-4 transition-colors hover:bg-[#F8F4EE]"
                  style={{
                    gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 120px 110px',
                    gap:     '12px',
                    display: 'grid',
                    background: isOffer ? 'rgba(230,126,80,0.03)' : undefined,
                  }}
                >
                  {/* Dates */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {inquiry.dates_from} → {inquiry.dates_to}
                    </p>
                    {isOffer && inquiry.offer_price_eur != null && (
                      <p className="text-xs f-body font-bold mt-0.5" style={{ color: '#E67E50' }}>
                        €{inquiry.offer_price_eur} offered
                      </p>
                    )}
                  </div>

                  {/* Species */}
                  <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    {speciesText || '—'}
                  </p>

                  {/* Location (placeholder — no location on inquiry yet) */}
                  <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    —
                  </p>

                  {/* Group */}
                  <p className="text-sm font-medium f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
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
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    {submitted}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
