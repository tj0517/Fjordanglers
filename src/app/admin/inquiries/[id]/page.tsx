import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import AdminInquiryActions from './AdminInquiryActions'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  pending:        { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'New'            },
  reviewing:      { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6', label: 'Reviewing'      },
  offer_sent:     { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', label: 'Offer Sent'     },
  offer_accepted: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Offer Accepted' },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Confirmed'      },
  completed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Completed'      },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Cancelled'      },
  declined:       { bg: 'rgba(239,68,68,0.08)',  color: '#B91C1C', label: 'Declined'       },
}

const DEFAULT_STATUS = { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D', label: '—' }

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminInquiryDetailPage({ params }: Props) {
  const { id } = await params

  // Use service client — admin bypasses RLS
  const supabase = createServiceClient()

  // Fetch booking (inquiry-sourced)
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, guides(id, full_name, country)')
    .eq('id', id)
    .eq('source', 'inquiry')
    .single()

  if (!booking) notFound()

  // Fetch all active guides for the offer/assignment form
  const { data: allGuides } = await supabase
    .from('guides')
    .select('id, full_name, country')
    .eq('status', 'active')
    .order('full_name')

  const assignedGuide = booking.guides as unknown as {
    id: string
    full_name: string
    country: string
  } | null

  const prefs = (booking.preferences ?? {}) as {
    budgetMin?: number
    budgetMax?: number
    accommodation?: boolean
    riverType?: string
    notes?: string
  }

  const s = STATUS_STYLES[booking.status as BookingStatus] ?? DEFAULT_STATUS

  const submittedDate = new Date(booking.created_at).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const guideOptions = (allGuides ?? []).map(g => ({
    id: g.id,
    full_name: g.full_name,
    country: g.country,
  }))

  const anglerName     = booking.angler_full_name ?? '—'
  const anglerEmail    = booking.angler_email ?? '—'
  const datesFrom      = booking.booking_date ?? '—'
  const datesTo        = booking.date_to ?? datesFrom
  const groupSize      = booking.guests
  const expLevel       = booking.experience_level ?? '—'
  const targetSpecies  = booking.target_species ?? []

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/inquiries"
          className="text-xs f-body hover:text-[#E67E50] transition-colors mb-3 inline-block"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          ← All Inquiries
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            {anglerName}
          </h1>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
            style={{ background: s.bg, color: s.color }}
          >
            {s.label}
          </span>
        </div>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Submitted {submittedDate}
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">

        {/* ── LEFT: Booking details ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Contact */}
          <Section title="Angler">
            <InfoRow label="Name"  value={anglerName} />
            <InfoRow label="Email" value={anglerEmail} />
          </Section>

          {/* Trip info */}
          <Section title="Trip Details">
            <InfoRow
              label="Dates"
              value={`${datesFrom} to ${datesTo}`}
            />
            <InfoRow
              label="Group size"
              value={`${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`}
            />
            <InfoRow
              label="Experience level"
              value={
                ({
                  beginner:     'Beginner',
                  intermediate: 'Intermediate',
                  expert:       'Expert',
                } as Record<string, string>)[expLevel] ?? expLevel
              }
            />
            <InfoRow
              label="Target species"
              value={targetSpecies.length > 0 ? targetSpecies.join(', ') : '—'}
            />
          </Section>

          {/* Preferences */}
          <Section title="Preferences">
            {prefs.budgetMin != null || prefs.budgetMax != null ? (
              <InfoRow
                label="Budget"
                value={[
                  prefs.budgetMin != null && `Min €${prefs.budgetMin}`,
                  prefs.budgetMax != null && `Max €${prefs.budgetMax}`,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              />
            ) : (
              <InfoRow label="Budget" value="Not specified" />
            )}
            <InfoRow
              label="Accommodation"
              value={
                prefs.accommodation === true
                  ? 'Yes — needed'
                  : prefs.accommodation === false
                  ? 'No — not needed'
                  : 'Flexible'
              }
            />
            <InfoRow label="Water type" value={prefs.riverType ?? 'Any'} />
            {prefs.notes != null && prefs.notes.length > 0 && (
              <InfoRow label="Notes" value={prefs.notes} />
            )}
          </Section>

          {/* Offer details (if sent) */}
          {booking.status !== 'pending' && booking.status !== 'reviewing' && (
            <Section title="Offer Sent">
              {assignedGuide != null && (
                <InfoRow label="Guide" value={`${assignedGuide.full_name} (${assignedGuide.country})`} />
              )}
              {booking.assigned_river != null && (
                <InfoRow label="River / Location" value={booking.assigned_river} />
              )}
              {booking.offer_price_eur != null && (
                <InfoRow label="Offer price" value={`€${booking.offer_price_eur}`} highlight />
              )}
              {booking.offer_details != null && booking.offer_details.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    Offer details
                  </p>
                  <p className="text-sm f-body whitespace-pre-wrap" style={{ color: 'rgba(10,46,77,0.7)' }}>
                    {booking.offer_details}
                  </p>
                </div>
              )}
            </Section>
          )}
        </div>

        {/* ── RIGHT: Admin actions ──────────────────────────────────────────── */}
        <div>
          <div
            className="p-6"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.08)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              Admin Actions
            </p>

            <AdminInquiryActions
              inquiryId={id}
              status={booking.status}
              guides={guideOptions}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6"
      style={{
        background: '#FDFAF7',
        borderRadius: '20px',
        border: '1px solid rgba(10,46,77,0.08)',
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', width: 120 }}>
        {label}
      </dt>
      <dd
        className="text-sm f-body text-right"
        style={{ color: highlight ? '#E67E50' : '#0A2E4D', fontWeight: highlight ? 700 : 500 }}
      >
        {value}
      </dd>
    </div>
  )
}
