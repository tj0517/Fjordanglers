import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import GuideOfferForm from '@/components/dashboard/guide-offer-form'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ id: string }>
}

export default async function GuideInquiryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Guide lookup
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) notFound()

  // Fetch the inquiry — must be assigned to this guide, or unassigned
  const { data: inquiry } = await supabase
    .from('trip_inquiries')
    .select('*')
    .eq('id', id)
    .single()

  if (!inquiry) notFound()

  // Authorization check: inquiry must be assigned to this guide OR unassigned
  if (
    inquiry.assigned_guide_id !== null &&
    inquiry.assigned_guide_id !== guide.id
  ) {
    notFound()
  }

  const prefs = (inquiry.preferences ?? {}) as {
    budgetMin?: number
    budgetMax?: number
    accommodation?: boolean
    riverType?: string
    notes?: string
  }

  const s = STATUS_STYLES[inquiry.status]

  const submittedDate = new Date(inquiry.created_at).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const levelLabel =
    { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[
      inquiry.experience_level
    ] ?? inquiry.experience_level

  const canSendOffer = inquiry.status === 'inquiry' || inquiry.status === 'reviewing'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/inquiries"
          className="text-xs f-body hover:text-[#E67E50] transition-colors mb-3 inline-block"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          ← All Inquiries
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            {inquiry.angler_name}
          </h1>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
            style={{ background: s.bg, color: s.color }}
          >
            {s.label}
          </span>
        </div>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">Submitted {submittedDate}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

        {/* Left column — Inquiry details */}
        <div className="flex flex-col gap-5">

          {/* Angler */}
          <Section title="Angler">
            <InfoRow label="Name"  value={inquiry.angler_name} />
            <InfoRow label="Email" value={inquiry.angler_email} />
          </Section>

          {/* Trip Details */}
          <Section title="Trip Details">
            <InfoRow
              label="Dates"
              value={`${inquiry.dates_from} to ${inquiry.dates_to}`}
            />
            <InfoRow
              label="Group size"
              value={`${inquiry.group_size} ${inquiry.group_size === 1 ? 'angler' : 'anglers'}`}
            />
            <InfoRow label="Experience level" value={levelLabel} />
            <InfoRow
              label="Target species"
              value={(inquiry.target_species as string[] | null)?.join(', ') ?? '—'}
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
          {!canSendOffer && inquiry.status !== 'cancelled' && (
            <Section title="Offer Sent">
              {inquiry.assigned_river != null && (
                <InfoRow label="River / Location" value={inquiry.assigned_river} />
              )}
              {inquiry.offer_price_eur != null && (
                <InfoRow label="Offer price" value={`€${inquiry.offer_price_eur}`} highlight />
              )}
              {inquiry.offer_details != null && inquiry.offer_details.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    Offer details
                  </p>
                  <p
                    className="text-sm f-body whitespace-pre-wrap"
                    style={{ color: 'rgba(10,46,77,0.7)' }}
                  >
                    {inquiry.offer_details}
                  </p>
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Right column — Action panel */}
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
              Actions
            </p>

            {/* Can send offer */}
            {canSendOffer && <GuideOfferForm inquiryId={id} />}

            {/* Offer already sent */}
            {inquiry.status === 'offer_sent' && (
              <div
                className="px-4 py-4 rounded-xl text-sm f-body"
                style={{
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  color: '#7C3AED',
                }}
              >
                <p className="font-semibold mb-1">Offer sent</p>
                <p className="text-xs" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  Waiting for the angler to review and accept the offer.
                </p>
              </div>
            )}

            {/* Confirmed / completed */}
            {(inquiry.status === 'offer_accepted' ||
              inquiry.status === 'confirmed' ||
              inquiry.status === 'completed') && (
              <div
                className="px-4 py-4 rounded-xl text-sm f-body"
                style={{
                  background: 'rgba(74,222,128,0.08)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  color: '#16A34A',
                }}
              >
                <p className="font-semibold mb-1">
                  {inquiry.status === 'completed' ? 'Trip completed' : 'Angler confirmed'}
                </p>
                <p className="text-xs" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {inquiry.status === 'offer_accepted'
                    ? 'Payment is being processed.'
                    : inquiry.status === 'confirmed'
                    ? 'Payment received. Trip is booked.'
                    : 'This trip has been completed.'}
                </p>
              </div>
            )}

            {/* Cancelled */}
            {inquiry.status === 'cancelled' && (
              <div
                className="px-4 py-4 rounded-xl text-sm f-body"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  color: '#DC2626',
                }}
              >
                This inquiry was cancelled.
              </div>
            )}
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
      <dt
        className="text-xs f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.45)', width: 120 }}
      >
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
