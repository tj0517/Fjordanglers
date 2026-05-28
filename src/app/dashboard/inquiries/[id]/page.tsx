/**
 * /dashboard/inquiries/[id] — FA inquiry detail.
 *
 * Shows full inquiry info + rich offer builder (right panel).
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { OfferBuilder } from './OfferBuilder'
import { SendDepositButton } from './SendDepositButton'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { env } from '@/lib/env'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-start justify-between py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
      <span className="text-xs font-bold uppercase tracking-[0.1em] f-body"
        style={{ color: 'rgba(10,46,77,0.4)', minWidth: '120px' }}>{label}</span>
      <span className="text-sm f-body text-right" style={{ color: '#0A2E4D' }}>{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) notFound()

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .single()

  if (inquiry == null) notFound()

  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, price_per_person_eur, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  const { data: guide } = trip?.guide_id
    ? await svc.from('guides').select('full_name, invite_email').eq('id', trip.guide_id).single()
    : { data: null }

  const statusStyle = STATUS_COLOR[inquiry.status] ?? STATUS_COLOR.pending_fa_review

  const tripPriceEur       = (trip?.price_per_person_eur ?? 0) * (inquiry.party_size ?? 1)
  const offerToken         = inquiry.offer_token as string | null
  const offerUrl           = offerToken ? `${env.NEXT_PUBLIC_APP_URL}/offers/${offerToken}` : null
  const offerTotalEur      = inquiry.offer_total_eur  != null ? Number(inquiry.offer_total_eur) : null
  const offerDepositEur    = inquiry.offer_deposit_eur != null ? Number(inquiry.offer_deposit_eur) : null

  const canBuildOffer = ['pending_fa_review', 'deposit_sent'].includes(inquiry.status)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Back */}
      <Link href="/dashboard/inquiries"
        className="inline-flex items-center gap-1.5 text-sm f-body mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.5)' }}>
        <ChevronLeft size={16} />
        All inquiries
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            {inquiry.angler_name}
          </h1>
          <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            {trip?.title ?? inquiry.trip_id}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-sm font-semibold f-body flex-shrink-0"
          style={statusStyle}>
          {STATUS_LABEL[inquiry.status] ?? inquiry.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: inquiry details ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Angler */}
          <div className="p-6 rounded-2xl"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] f-body mb-4"
              style={{ color: '#E67E50' }}>Angler</p>
            <DetailRow label="Name"    value={inquiry.angler_name} />
            <DetailRow label="Email"   value={inquiry.angler_email} />
            <DetailRow label="Country" value={inquiry.angler_country} />
          </div>

          {/* Trip */}
          <div className="p-6 rounded-2xl"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] f-body mb-4"
              style={{ color: '#E67E50' }}>Trip</p>
            <DetailRow label="Trip"            value={trip?.title ?? '—'} />
            <DetailRow label="Guide"           value={guide?.full_name ?? '—'} />
            <DetailRow label="Guide email"     value={guide?.invite_email ?? '—'} />
            <DetailRow label="Requested dates" value={
              inquiry.requested_dates != null && (inquiry.requested_dates as string[]).length > 0
                ? (inquiry.requested_dates as string[]).map(fmtDate).join(', ')
                : '—'
            } />
            <DetailRow label="Party size"  value={`${inquiry.party_size} ${inquiry.party_size === 1 ? 'person' : 'people'}`} />
            <DetailRow label="Trip price"  value={tripPriceEur > 0 ? `€${tripPriceEur.toFixed(2)} (${inquiry.party_size}×)` : '—'} />
            {inquiry.selected_option != null && (
              <DetailRow label="Option" value={inquiry.selected_option as string} />
            )}
          </div>

          {/* Angler message */}
          {inquiry.message != null && (inquiry.message as string).trim() !== '' && (
            <div className="p-6 rounded-2xl"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] f-body mb-3"
                style={{ color: '#E67E50' }}>Message from angler</p>
              <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', fontStyle: 'italic' }}>
                &ldquo;{inquiry.message}&rdquo;
              </p>
            </div>
          )}

          {/* Existing offer summary (if already sent) */}
          {offerTotalEur != null && (
            <div className="p-6 rounded-2xl"
              style={{ background: '#F0F7FF', border: '1px solid #DBEAFE' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] f-body"
                  style={{ color: '#1E40AF' }}>Offer sent</p>
                {offerUrl != null && (
                  <a href={offerUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold f-body"
                    style={{ color: '#E67E50' }}>
                    <ExternalLink size={12} /> View offer page
                  </a>
                )}
              </div>
              <DetailRow label="Total price"  value={`€${offerTotalEur.toFixed(2)}`} />
              {offerDepositEur != null && (
                <DetailRow label="Deposit"    value={`€${offerDepositEur.toFixed(2)}`} />
              )}
              {offerDepositEur != null && (
                <DetailRow label="Balance to guide" value={`€${(offerTotalEur - offerDepositEur).toFixed(2)}`} />
              )}
              {inquiry.offer_notes != null && (
                <DetailRow label="Notes"      value={inquiry.offer_notes as string} />
              )}
              {inquiry.offer_sent_at != null && (
                <DetailRow label="Sent at" value={new Date(inquiry.offer_sent_at as string).toLocaleString('en-GB')} />
              )}
            </div>
          )}

          {/* Payment info */}
          {(inquiry.deposit_amount != null || inquiry.deposit_stripe_session_id != null) && (
            <div className="p-6 rounded-2xl"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] f-body mb-4"
                style={{ color: '#E67E50' }}>Deposit payment</p>
              {inquiry.deposit_amount != null && (
                <DetailRow label="Amount"         value={`€${Number(inquiry.deposit_amount).toFixed(2)}`} />
              )}
              {inquiry.deposit_stripe_session_id != null && (
                <DetailRow label="Stripe session" value={inquiry.deposit_stripe_session_id as string} />
              )}
              {inquiry.deposit_paid_at != null && (
                <DetailRow label="Paid at"        value={new Date(inquiry.deposit_paid_at as string).toLocaleString('en-GB')} />
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              ID: {inquiry.id} · Created: {new Date(inquiry.created_at as string).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        {/* ── Right: action panel ── */}
        <div>
          <div className="sticky top-6 space-y-4">

            {/* Offer builder panel */}
            <div className="p-5 rounded-2xl"
              style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(10,46,77,0.2)' }}>

              <p className="text-xs font-bold uppercase tracking-[0.15em] f-body mb-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                {canBuildOffer ? 'Send Offer' : STATUS_LABEL[inquiry.status] ?? inquiry.status}
              </p>
              <p className="text-sm font-semibold f-body mb-4" style={{ color: '#FFFFFF' }}>
                {canBuildOffer
                  ? 'Build & send a personalised offer'
                  : 'No actions available'}
              </p>

              {canBuildOffer ? (
                <OfferBuilder
                  inquiryId={inquiry.id}
                  tripTitle={trip?.title ?? 'Your trip'}
                  estimatedTotalEur={tripPriceEur}
                />
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
            </div>

            {/* Quick deposit link (secondary) */}
            {canBuildOffer && (
              <div className="p-4 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] f-body mb-1"
                  style={{ color: 'rgba(10,46,77,0.4)' }}>Quick send</p>
                <p className="text-xs f-body mb-3" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  Skip the offer builder — send a deposit link directly.
                </p>
                <SendDepositButton inquiryId={inquiry.id} defaultPercent={30} />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
