import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import AcceptOfferButton from './AcceptOfferButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

// ─── Status timeline steps ────────────────────────────────────────────────────

const TIMELINE_STEPS: { key: InquiryStatus[]; label: string }[] = [
  { key: ['inquiry'],                       label: 'Inquiry sent'     },
  { key: ['reviewing'],                     label: 'Under review'     },
  { key: ['offer_sent', 'offer_accepted'],  label: 'Offer ready'      },
  { key: ['confirmed', 'completed'],        label: 'Confirmed'        },
]

function getTimelineIndex(status: InquiryStatus): number {
  return TIMELINE_STEPS.findIndex(s => s.key.includes(status))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}

export default async function AnglerTripPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/account/trips/${id}`)
  }

  // Fetch inquiry — must belong to this angler
  const { data: inquiry } = await supabase
    .from('trip_inquiries')
    .select('*, guides(full_name, country, avatar_url)')
    .eq('id', id)
    .single()

  if (!inquiry) notFound()

  // Ownership check
  const userEmail = user.email
  const isOwner =
    inquiry.angler_id === user.id ||
    (userEmail != null && inquiry.angler_email === userEmail)

  if (!isOwner) notFound()

  const assignedGuide = inquiry.guides as unknown as {
    full_name: string
    country: string
    avatar_url: string | null
  } | null

  const prefs = (inquiry.preferences ?? {}) as {
    budgetMin?: number
    budgetMax?: number
    accommodation?: boolean
    riverType?: string
    notes?: string
  }

  const currentStepIdx = getTimelineIndex(inquiry.status)
  const paidSuccessfully = sp.status === 'paid' || sp.status === 'accepted'

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* Nav bar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(243,237,228,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.06)',
        }}
      >
        <Link href="/account/bookings" className="f-body text-sm" style={{ color: 'rgba(10,46,77,0.5)' }}>
          ← My Bookings
        </Link>
        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
          Trip Request
        </p>
        <div className="w-24" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* ── Paid success banner ─────────────────────────────────────────────── */}
        {paidSuccessfully && (
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-6"
            style={{
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.2)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="#16A34A"
              strokeWidth="2"
            >
              <circle cx="10" cy="10" r="9" />
              <polyline points="6,10 9,13 14,7" />
            </svg>
            <p className="text-sm f-body font-semibold" style={{ color: '#16A34A' }}>
              Payment confirmed! Your trip is booked.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Custom Trip
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
            {inquiry.dates_from} — {inquiry.dates_to}
          </h1>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            {inquiry.group_size} {inquiry.group_size === 1 ? 'angler' : 'anglers'} ·{' '}
            {inquiry.target_species?.join(', ')}
          </p>
        </div>

        {/* ── Status timeline ─────────────────────────────────────────────────── */}
        <div
          className="p-6 mb-6"
          style={{
            background: '#FDFAF7',
            borderRadius: '20px',
            border: '1px solid rgba(10,46,77,0.08)',
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em] mb-5 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Status
          </p>
          <div className="flex items-center gap-0">
            {TIMELINE_STEPS.map((step, idx) => {
              const isPast    = idx < currentStepIdx
              const isCurrent = idx === currentStepIdx
              const isFuture  = idx > currentStepIdx
              const isLast    = idx === TIMELINE_STEPS.length - 1

              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold f-body transition-all"
                      style={{
                        background: isCurrent
                          ? '#E67E50'
                          : isPast
                          ? '#16A34A'
                          : 'rgba(10,46,77,0.08)',
                        color: isCurrent || isPast ? '#fff' : 'rgba(10,46,77,0.3)',
                      }}
                    >
                      {isPast ? '✓' : idx + 1}
                    </div>
                    <p
                      className="text-[9px] font-semibold f-body mt-1 text-center leading-tight"
                      style={{
                        color: isCurrent
                          ? '#E67E50'
                          : isPast
                          ? '#16A34A'
                          : 'rgba(10,46,77,0.3)',
                        width: 56,
                        marginLeft: -8,
                      }}
                    >
                      {step.label}
                    </p>
                  </div>

                  {!isLast && (
                    <div
                      className="flex-1 h-0.5 mx-1 transition-all"
                      style={{
                        background: isPast
                          ? '#16A34A'
                          : isCurrent
                          ? 'rgba(230,126,80,0.3)'
                          : 'rgba(10,46,77,0.08)',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Offer card (if offer_sent) ──────────────────────────────────────── */}
        {inquiry.status === 'offer_sent' && inquiry.offer_price_eur != null && (
          <div
            className="p-6 mb-6"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(230,126,80,0.2)',
              boxShadow: '0 4px 24px rgba(230,126,80,0.08)',
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Your Offer
            </p>

            {/* Guide */}
            {assignedGuide != null && (
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold f-body"
                  style={{ background: '#0A2E4D' }}
                >
                  {assignedGuide.full_name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    {assignedGuide.full_name}
                  </p>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {assignedGuide.country}
                  </p>
                </div>
              </div>
            )}

            {/* River + price */}
            {inquiry.assigned_river != null && (
              <p className="text-sm f-body mb-2" style={{ color: 'rgba(10,46,77,0.6)' }}>
                📍 {inquiry.assigned_river}
              </p>
            )}

            <div
              className="flex items-center justify-between py-3 mb-4"
              style={{ borderTop: '1px solid rgba(10,46,77,0.07)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Offer price
              </p>
              <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{inquiry.offer_price_eur}
              </p>
            </div>

            {/* Offer details */}
            {inquiry.offer_details != null && (
              <div className="mb-5">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  What&apos;s included
                </p>
                <p
                  className="text-sm f-body whitespace-pre-wrap leading-relaxed"
                  style={{ color: 'rgba(10,46,77,0.65)' }}
                >
                  {inquiry.offer_details}
                </p>
              </div>
            )}

            <AcceptOfferButton inquiryId={id} />
          </div>
        )}

        {/* ── Trip summary (always visible) ──────────────────────────────────── */}
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
            Request Summary
          </p>
          <div className="flex flex-col gap-3">
            <InfoRow label="Dates" value={`${inquiry.dates_from} to ${inquiry.dates_to}`} />
            <InfoRow
              label="Group size"
              value={`${inquiry.group_size} ${inquiry.group_size === 1 ? 'angler' : 'anglers'}`}
            />
            <InfoRow
              label="Level"
              value={
                { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[
                  inquiry.experience_level
                ] ?? inquiry.experience_level
              }
            />
            <InfoRow
              label="Species"
              value={inquiry.target_species?.join(', ') ?? '—'}
            />
            {prefs.budgetMin != null && (
              <InfoRow
                label="Budget"
                value={`€${prefs.budgetMin}${prefs.budgetMax != null ? ` – €${prefs.budgetMax}` : '+'}`}
              />
            )}
            {prefs.riverType && prefs.riverType !== 'Any' && (
              <InfoRow label="Water type" value={prefs.riverType} />
            )}
            {prefs.notes && <InfoRow label="Notes" value={prefs.notes} />}
          </div>
        </div>

        {/* ── Waiting / no offer yet ──────────────────────────────────────────── */}
        {(inquiry.status === 'inquiry' || inquiry.status === 'reviewing') && (
          <div
            className="mt-6 p-5 rounded-2xl flex items-start gap-3"
            style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="1.5"
              className="flex-shrink-0 mt-0.5"
            >
              <circle cx="9" cy="9" r="8" />
              <line x1="9" y1="5" x2="9" y2="9.5" />
              <circle cx="9" cy="12.5" r="0.5" fill="#3B82F6" />
            </svg>
            <div>
              <p className="text-sm f-body font-semibold" style={{ color: '#3B82F6' }}>
                {inquiry.status === 'inquiry' ? 'Your request is under review' : 'Finding the best guide for you'}
              </p>
              <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Our team will send you an offer within 48 hours. Check your email:{' '}
                <span className="font-semibold">{inquiry.angler_email}</span>
              </p>
            </div>
          </div>
        )}

        {/* Confirmed state */}
        {(inquiry.status === 'confirmed' || inquiry.status === 'completed') && (
          <div
            className="mt-6 p-5 rounded-2xl flex items-start gap-3"
            style={{
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="#16A34A"
              strokeWidth="2"
            >
              <circle cx="9" cy="9" r="8" />
              <polyline points="5.5,9 8,11.5 13,6.5" />
            </svg>
            <div>
              <p className="text-sm f-body font-semibold" style={{ color: '#16A34A' }}>
                {inquiry.status === 'completed' ? 'Trip completed!' : 'Trip confirmed — see you there!'}
              </p>
              <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Your guide will be in touch with final details closer to the trip date.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/trips"
            className="text-xs f-body"
            style={{ color: 'rgba(10,46,77,0.4)' }}
          >
            Browse more experiences →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>
        {label}
      </dt>
      <dd className="text-sm f-body text-right" style={{ color: '#0A2E4D', fontWeight: 500 }}>
        {value}
      </dd>
    </div>
  )
}
