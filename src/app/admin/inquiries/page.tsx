import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  pending:        { bg: 'rgba(230,126,80,0.12)', color: '#E67E50',  label: 'New'            },
  reviewing:      { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6',  label: 'Reviewing'      },
  offer_sent:     { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED',  label: 'Offer Sent'     },
  offer_accepted: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A',  label: 'Offer Accepted' },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A',  label: 'Confirmed'      },
  completed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A',  label: 'Completed'      },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626',  label: 'Cancelled'      },
  declined:       { bg: 'rgba(239,68,68,0.08)',  color: '#B91C1C',  label: 'Declined'       },
}

const DEFAULT_STATUS = { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D', label: '—' }

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Inquiries — FjordAnglers Admin',
}

export default async function AdminInquiriesPage() {
  // Use service client — admin bypasses RLS
  const supabase = createServiceClient()

  const { data: inquiries } = await supabase
    .from('bookings')
    .select(
      'id, angler_full_name, angler_email, booking_date, date_to, target_species, guests, experience_level, status, created_at',
    )
    .eq('source', 'inquiry')
    .order('created_at', { ascending: false })

  const all = inquiries ?? []

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total       = all.length
  const pending     = all.filter(i => i.status === 'pending' || i.status === 'reviewing').length
  const offerSent   = all.filter(i => i.status === 'offer_sent').length
  const confirmed   = all.filter(i => i.status === 'confirmed' || i.status === 'offer_accepted').length

  const STATS = [
    { label: 'Total inquiries', value: total,     sub: 'all time'         },
    { label: 'Pending',         value: pending,   sub: 'need attention'   },
    { label: 'Offer sent',      value: offerSent, sub: 'awaiting angler'  },
    { label: 'Confirmed',       value: confirmed, sub: 'accepted & paid'  },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1100px]">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Admin → Inquiries
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Trip <span style={{ fontStyle: 'italic' }}>Inquiries</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Concierge requests from anglers
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map(stat => (
          <div
            key={stat.label}
            className="px-6 py-5"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
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

      {/* Table */}
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
        {/* Header */}
        <div
          className="grid px-6 py-3"
          style={{
            gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 90px 100px 110px',
            borderBottom: '1px solid rgba(10,46,77,0.07)',
            background: 'rgba(10,46,77,0.02)',
            gap: '12px',
            minWidth: '780px',
          }}
        >
          {['Angler', 'Dates', 'Species', 'Group', 'Level', 'Status', 'Submitted'].map(col => (
            <p
              key={col}
              className="text-[10px] uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              {col}
            </p>
          ))}
        </div>

        {all.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <p className="text-[#0A2E4D]/30 text-sm f-body">No inquiries yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '780px' }}>
            {all.map(inquiry => {
              const s = STATUS_STYLES[inquiry.status as BookingStatus] ?? DEFAULT_STATUS
              const submitted = new Date(inquiry.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })
              const speciesArr  = (inquiry.target_species ?? []) as string[]
              const speciesShort = speciesArr.slice(0, 2).join(', ')
              const speciesMore  = Math.max(0, speciesArr.length - 2)
              const levelLabel   = ({
                beginner:     'Beginner',
                intermediate: 'Intermediate',
                expert:       'Expert',
              } as Record<string, string>)[inquiry.experience_level ?? ''] ?? (inquiry.experience_level ?? '—')

              const datesFrom = inquiry.booking_date ?? '—'
              const datesTo   = inquiry.date_to ?? datesFrom

              return (
                <Link
                  key={inquiry.id}
                  href={`/admin/inquiries/${inquiry.id}`}
                  className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors"
                  style={{
                    gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 90px 100px 110px',
                    gap: '12px',
                    display: 'grid',
                  }}
                >
                  {/* Angler */}
                  <div className="min-w-0">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">
                      {inquiry.angler_full_name ?? '—'}
                    </p>
                    <p className="text-[#0A2E4D]/40 text-xs f-body truncate">
                      {inquiry.angler_email ?? '—'}
                    </p>
                  </div>

                  {/* Dates */}
                  <p className="text-[#0A2E4D]/65 text-xs f-body">
                    {datesFrom} – {datesTo}
                  </p>

                  {/* Species */}
                  <p className="text-[#0A2E4D]/65 text-xs f-body truncate">
                    {speciesShort || '—'}
                    {speciesMore > 0 && ` +${speciesMore}`}
                  </p>

                  {/* Group */}
                  <p className="text-[#0A2E4D]/65 text-sm font-medium f-body">
                    {inquiry.guests ?? '—'}
                  </p>

                  {/* Level */}
                  <p className="text-[#0A2E4D]/55 text-xs f-body">{levelLabel}</p>

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
        )}
        </div>{/* /overflow-x-auto */}
      </div>
    </div>
  )
}
