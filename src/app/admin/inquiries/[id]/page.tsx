/**
 * /admin/inquiries/[id] — FA inquiry detail.
 *
 * Shows full angler + trip info and the "Send Deposit Link" CTA panel.
 * FA can adjust the deposit % and send the Stripe Checkout link directly to the angler.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { SendDepositButton } from './SendDepositButton'
import { ChevronLeft } from 'lucide-react'

export const metadata = { title: 'Inquiry Detail — Admin' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending_fa_review: 'Pending review',
  deposit_sent:      'Deposit sent',
  deposit_paid:      'Confirmed',
  completed:         'Completed',
  cancelled:         'Cancelled',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending_fa_review: { color: '#92400E', bg: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' },
  deposit_sent:      { color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)' },
  deposit_paid:      { color: '#065F46', bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' },
  completed:         { color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)' },
  cancelled:         { color: '#991B1B', bg: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.25)' },
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-start justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.38)', minWidth: '110px' }}>{label}</span>
      <span className="text-sm f-body text-right" style={{ color: '#0A2E4D' }}>{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .single()

  if (inquiry == null) notFound()

  // Fetch trip
  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, price_per_person_eur, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  // Fetch guide
  const { data: guide } = trip?.guide_id
    ? await svc.from('guides').select('full_name, invite_email').eq('id', trip.guide_id).single()
    : { data: null }

  const st             = STATUS_STYLE[inquiry.status] ?? STATUS_STYLE.pending_fa_review
  const tripPriceEur   = (trip?.price_per_person_eur ?? 0) * (inquiry.party_size ?? 1)
  const deposit30Eur   = Math.round(tripPriceEur * 0.30 * 100) / 100
  const requestedDates = inquiry.requested_dates as string[] | null

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[900px]">

      {/* ─── Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/inquiries" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Inquiries</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>
          {inquiry.angler_name}
        </span>
      </div>

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold f-display text-[#0A2E4D]">{inquiry.angler_name}</h1>
          <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {trip?.title ?? inquiry.trip_id}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-sm font-semibold f-body flex-shrink-0"
          style={{ background: st.bg, color: st.color, border: st.border }}>
          {STATUS_LABEL[inquiry.status] ?? inquiry.status}
        </span>
      </div>

      {/* ─── Two-column layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* ── Left: details ── */}
        <div className="flex flex-col gap-4">

          {/* Angler info */}
          <div className="rounded-[22px] overflow-hidden"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Angler</h2>
            </div>
            <div className="px-6 pb-2">
              <Row label="Name"    value={inquiry.angler_name} />
              <Row label="Email"   value={inquiry.angler_email} />
              <Row label="Country" value={inquiry.angler_country} />
            </div>
          </div>

          {/* Trip + booking details */}
          <div className="rounded-[22px] overflow-hidden"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Booking Request</h2>
            </div>
            <div className="px-6 pb-2">
              <Row label="Trip"       value={trip?.title ?? '—'} />
              <Row label="Guide"      value={guide?.full_name ?? '—'} />
              <Row label="Guide email" value={guide?.invite_email ?? '—'} />
              <Row
                label="Requested dates"
                value={
                  requestedDates != null && requestedDates.length > 0
                    ? requestedDates.map(fmtDate).join(', ')
                    : '—'
                }
              />
              <Row label="Party size"  value={`${inquiry.party_size} ${inquiry.party_size === 1 ? 'person' : 'people'}`} />
              <Row label="Trip total"  value={tripPriceEur > 0 ? `€${tripPriceEur.toFixed(2)} (${inquiry.party_size}×€${trip?.price_per_person_eur?.toFixed(2) ?? '0.00'}/person)` : '—'} />
            </div>
          </div>

          {/* Message */}
          {inquiry.message != null && inquiry.message.trim() !== '' && (
            <div className="rounded-[22px] overflow-hidden"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
                <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Message from angler</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', fontStyle: 'italic' }}>
                  &ldquo;{inquiry.message}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Deposit info (if already processed) */}
          {(inquiry.deposit_amount != null || inquiry.deposit_stripe_session_id != null) && (
            <div className="rounded-[22px] overflow-hidden"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
                <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Deposit</h2>
              </div>
              <div className="px-6 pb-2">
                {inquiry.deposit_amount != null && (
                  <Row label="Amount" value={`€${Number(inquiry.deposit_amount).toFixed(2)}`} />
                )}
                {inquiry.deposit_stripe_session_id != null && (
                  <Row label="Stripe session" value={inquiry.deposit_stripe_session_id} />
                )}
                {inquiry.deposit_paid_at != null && (
                  <Row label="Paid at" value={new Date(inquiry.deposit_paid_at).toLocaleString('en-GB')} />
                )}
              </div>
            </div>
          )}

          {/* Internal metadata */}
          <div className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              ID: {inquiry.id} · Submitted: {new Date(inquiry.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        {/* ── Right: action panel ── */}
        <div>
          <div className="sticky top-6 p-6 rounded-[22px]"
            style={{
              background:  '#0A2E4D',
              border:      '1px solid rgba(255,255,255,0.08)',
              boxShadow:   '0 8px 32px rgba(10,46,77,0.25)',
            }}>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-1"
              style={{ color: 'rgba(255,255,255,0.35)' }}>FA Action</p>
            <p className="text-base font-semibold f-body mb-4" style={{ color: '#FFFFFF' }}>
              {inquiry.status === 'pending_fa_review'
                ? 'Send deposit link to angler'
                : STATUS_LABEL[inquiry.status] ?? inquiry.status}
            </p>

            {/* Deposit estimate */}
            {inquiry.status === 'pending_fa_review' && deposit30Eur > 0 && (
              <div className="mb-4 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[10px] f-body mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Estimated 30% deposit
                </p>
                <p className="text-xl font-bold f-body" style={{ color: '#E67E50' }}>
                  €{deposit30Eur.toFixed(2)}
                </p>
                <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Based on €{tripPriceEur.toFixed(2)} trip total
                </p>
              </div>
            )}

            {/* CTA */}
            {inquiry.status === 'pending_fa_review' ? (
              <SendDepositButton inquiryId={inquiry.id} defaultPercent={30} />
            ) : inquiry.status === 'deposit_sent' ? (
              <div className="space-y-3">
                <div className="px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <p className="text-sm f-body" style={{ color: '#93C5FD' }}>
                    Deposit link already sent. Waiting for angler payment.
                  </p>
                </div>
                <SendDepositButton inquiryId={inquiry.id} defaultPercent={30} />
              </div>
            ) : inquiry.status === 'deposit_paid' ? (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <p className="text-sm f-body" style={{ color: '#6EE7B7' }}>
                  ✅ Deposit received. Booking confirmed.
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-sm f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  No actions available for this status.
                </p>
              </div>
            )}

            {/* Back link */}
            <Link
              href="/admin/inquiries"
              className="flex items-center gap-1.5 mt-4 text-xs f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <ChevronLeft size={13} />
              All inquiries
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
