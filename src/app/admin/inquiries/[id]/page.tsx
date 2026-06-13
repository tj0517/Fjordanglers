/**
 * /admin/inquiries/[id] — FA inquiry detail.
 *
 * Left column : angler info · booking details · original message · correspondence thread
 * Right column: InquiryActionPanel (sticky) — offer builder, message composer, deposit link
 *
 * DB migration required for offer fields + inquiry_messages table:
 *   ALTER TABLE inquiries
 *     ADD COLUMN IF NOT EXISTS offer_total_eur   NUMERIC,
 *     ADD COLUMN IF NOT EXISTS offer_deposit_eur  NUMERIC,
 *     ADD COLUMN IF NOT EXISTS offer_notes        TEXT,
 *     ADD COLUMN IF NOT EXISTS offer_sent_at      TIMESTAMPTZ;
 *
 *   CREATE TABLE IF NOT EXISTS inquiry_messages (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     inquiry_id UUID REFERENCES inquiries(id) ON DELETE CASCADE NOT NULL,
 *     subject TEXT,
 *     body TEXT NOT NULL,
 *     sent_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { OfferBuilderModal } from './OfferBuilderModal'
import { MessageComposer } from './MessageComposer'
import { StatusChanger } from './StatusChanger'
import { InternalDealTracker } from './InternalDealTracker'
import { LeadCommsLogger } from './LeadCommsLogger'
import { NextActionEditor } from './NextActionEditor'
import type { LeadMessage } from '@/actions/inquiries'

export const metadata = { title: 'Inquiry Detail — Admin' }

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending_fa_review: 'Pending review',
  in_negotiation:    'Negotiating',
  deposit_sent:      'Deposit sent',
  deposit_paid:      'Confirmed',
  completed:         'Completed',
  lost:              'Lost',
  cancelled:         'Cancelled',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending_fa_review: { color: '#92400E', bg: 'rgba(251,191,36,0.15)',  border: '1px solid rgba(251,191,36,0.4)'  },
  in_negotiation:    { color: '#5B21B6', bg: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' },
  deposit_sent:      { color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)'  },
  deposit_paid:      { color: '#065F46', bg: 'rgba(16,185,129,0.12)',  border: '1px solid rgba(16,185,129,0.3)'  },
  completed:         { color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)' },
  lost:              { color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'  },
  cancelled:         { color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-start justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.38)', minWidth: '110px' }}>
        {label}
      </span>
      <span className="text-sm f-body text-right" style={{ color: '#0A2E4D' }}>{value}</span>
    </div>
  )
}

// ─── Correspondence thread item types ─────────────────────────────────────────

type ThreadItem =
  | { kind: 'angler_inquiry'; body: string; sentAt: string }
  | { kind: 'offer_sent'; totalEur: number; depositEur: number; notes: string | null; sentAt: string }
  | { kind: 'fa_message'; subject: string; body: string; sentAt: string }
  | { kind: 'deposit_sent'; depositEur: number; sentAt: string }
  | { kind: 'deposit_paid'; depositEur: number; paidAt: string }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const svc     = createServiceClient()

  // ── Fetch inquiry (offer fields added by migration) ────────────────────────
  const { data: rawInquiry } = await svc
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .single()

  if (rawInquiry == null) notFound()

  // Cast to include fields from migrations
  const inquiry = rawInquiry as typeof rawInquiry & {
    offer_total_eur:         number | null
    offer_deposit_eur:       number | null
    offer_notes:             string | null
    offer_sent_at:           string | null
    internal_deal_total_eur: number | null
    internal_commission_eur: number | null
    internal_notes:          string | null
    lost_reason:             string | null
    last_contact_at:         string | null
    next_action:             string | null
  }

  // ── Fetch messages (graceful if table doesn't exist yet) ───────────────────
  type InquiryMessage = { id: string; subject: string | null; body: string; sent_at: string }
  let messages: InquiryMessage[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc as any).from('inquiry_messages')
      .select('id, subject, body, sent_at')
      .eq('inquiry_id', id)
      .order('sent_at', { ascending: true })
    if (!error && data != null) messages = data as InquiryMessage[]
  } catch {
    // Table doesn't exist yet — safe to ignore until migration is run
  }

  // ── Fetch lead_messages (CRM log) ──────────────────────────────────────────
  let leadMessages: LeadMessage[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lmData, error: lmError } = await (svc as any)
      .from('lead_messages')
      .select('id, inquiry_id, direction, channel, contact_type, contact_name, content, created_at, created_by')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true })
    if (!lmError && lmData != null) leadMessages = lmData as LeadMessage[]
  } catch {
    // Table doesn't exist yet — safe to ignore
  }

  // ── Fetch trip ─────────────────────────────────────────────────────────────
  const { data: trip } = await svc
    .from('experiences')
    .select('id, title, price_per_person_eur, guide_id')
    .eq('id', inquiry.trip_id)
    .single()

  // ── Fetch guide ────────────────────────────────────────────────────────────
  const { data: guide } = trip?.guide_id
    ? await svc.from('guides').select('full_name, invite_email').eq('id', trip.guide_id).single()
    : { data: null }

  const st             = STATUS_STYLE[inquiry.status] ?? STATUS_STYLE.pending_fa_review
  const tripPriceEur   = (trip?.price_per_person_eur ?? 0) * (inquiry.party_size ?? 1)
  const requestedDates = inquiry.requested_dates as string[] | null

  // ── Build correspondence thread ────────────────────────────────────────────
  const thread: ThreadItem[] = []

  // Original angler message (if any)
  if (inquiry.message != null && inquiry.message.trim() !== '') {
    thread.push({ kind: 'angler_inquiry', body: inquiry.message, sentAt: inquiry.created_at })
  }

  // Offer sent
  if (inquiry.offer_sent_at != null && inquiry.offer_total_eur != null && inquiry.offer_deposit_eur != null) {
    thread.push({
      kind:       'offer_sent',
      totalEur:   inquiry.offer_total_eur,
      depositEur: inquiry.offer_deposit_eur,
      notes:      inquiry.offer_notes,
      sentAt:     inquiry.offer_sent_at,
    })
  }

  // FA messages
  for (const msg of messages) {
    thread.push({ kind: 'fa_message', subject: msg.subject ?? '(no subject)', body: msg.body, sentAt: msg.sent_at })
  }

  // Deposit link sent
  if (inquiry.deposit_stripe_session_id != null && inquiry.deposit_paid_at == null) {
    thread.push({ kind: 'deposit_sent', depositEur: inquiry.deposit_amount ?? 0, sentAt: inquiry.updated_at ?? inquiry.created_at })
  }

  // Deposit paid
  if (inquiry.deposit_paid_at != null) {
    thread.push({ kind: 'deposit_paid', depositEur: inquiry.deposit_amount ?? 0, paidAt: inquiry.deposit_paid_at })
  }

  // Sort by date
  thread.sort((a, b) => {
    const ta = 'sentAt' in a ? a.sentAt : a.paidAt
    const tb = 'sentAt' in b ? b.sentAt : b.paidAt
    return new Date(ta).getTime() - new Date(tb).getTime()
  })

  const canBuildOffer = ['pending_fa_review', 'deposit_sent'].includes(inquiry.status)

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Breadcrumb ──────────────────────────── */}
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

      {/* ─── Header ──────────────────────────────── */}
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

      {/* ─── Two-column layout ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Left: details + correspondence ─────── */}
        <div className="flex flex-col gap-4 min-w-0">

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

          {/* Booking request */}
          <div className="rounded-[22px] overflow-hidden"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Booking Request</h2>
            </div>
            <div className="px-6 pb-2">
              <Row label="Trip"            value={trip?.title ?? '—'} />
              <Row label="Guide"           value={guide?.full_name ?? '—'} />
              <Row label="Guide email"     value={guide?.invite_email ?? '—'} />
              <Row
                label="Requested dates"
                value={
                  requestedDates != null && requestedDates.length > 0
                    ? requestedDates.map(fmtDate).join(', ')
                    : '—'
                }
              />
              <Row label="Party size"   value={`${inquiry.party_size} ${inquiry.party_size === 1 ? 'person' : 'people'}`} />
              <Row
                label="List price"
                value={tripPriceEur > 0
                  ? `€${tripPriceEur.toFixed(2)} (${inquiry.party_size}× €${trip?.price_per_person_eur?.toFixed(2) ?? '0.00'}/person)`
                  : '—'
                }
              />
              {inquiry.selected_option != null && (
                <Row label="Option" value={inquiry.selected_option} />
              )}
            </div>
          </div>

          {/* Correspondence thread */}
          {thread.length > 0 && (
            <div className="rounded-[22px] overflow-hidden"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
                <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Correspondence</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                {thread.map((item, i) => {

                  /* ── Angler's original message ── */
                  if (item.kind === 'angler_inquiry') return (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold f-body"
                        style={{ background: 'rgba(10,46,77,0.1)', color: '#0A2E4D' }}>
                        {inquiry.angler_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>
                            {inquiry.angler_name}
                          </span>
                          <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            {fmtDateTime(item.sentAt)}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)' }}>
                            Inquiry
                          </span>
                        </div>
                        <div className="px-3 py-2.5 rounded-xl text-sm f-body leading-relaxed italic"
                          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)', color: '#374151' }}>
                          &ldquo;{item.body}&rdquo;
                        </div>
                      </div>
                    </div>
                  )

                  /* ── Offer sent ── */
                  if (item.kind === 'offer_sent') return (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                        style={{ background: '#E67E50', color: '#fff' }}>
                        FA
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>FjordAnglers</span>
                          <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            {fmtDateTime(item.sentAt)}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body"
                            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.25)' }}>
                            Offer sent
                          </span>
                        </div>
                        <div className="px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.18)' }}>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 mb-1">
                            <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                              Total: <strong>€{item.totalEur.toFixed(2)}</strong>
                            </span>
                            <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                              Deposit: <strong>€{item.depositEur.toFixed(2)}</strong>
                            </span>
                            <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                              Balance to guide: <strong>€{(item.totalEur - item.depositEur).toFixed(2)}</strong>
                            </span>
                          </div>
                          {item.notes != null && item.notes.trim() !== '' && (
                            <p className="text-xs f-body italic mt-1.5" style={{ color: 'rgba(10,46,77,0.55)' }}>
                              &ldquo;{item.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )

                  /* ── FA message ── */
                  if (item.kind === 'fa_message') return (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                        style={{ background: '#0A2E4D', color: '#fff' }}>
                        FA
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>FjordAnglers</span>
                          <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            {fmtDateTime(item.sentAt)}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 rounded-xl"
                          style={{ background: 'rgba(10,46,77,0.05)', border: '1px solid rgba(10,46,77,0.09)' }}>
                          <p className="text-xs font-bold f-body mb-1" style={{ color: '#0A2E4D' }}>
                            {item.subject}
                          </p>
                          <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                            {item.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  )

                  /* ── Deposit link sent ── */
                  if (item.kind === 'deposit_sent') return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <span className="text-[11px] f-body" style={{ color: '#1E40AF' }}>
                        🔗 Deposit link sent — €{item.depositEur.toFixed(2)} — awaiting payment
                      </span>
                    </div>
                  )

                  /* ── Deposit paid ── */
                  if (item.kind === 'deposit_paid') return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <span className="text-[11px] f-body font-semibold" style={{ color: '#065F46' }}>
                        ✅ Deposit paid — €{item.depositEur.toFixed(2)} — {fmtDateTime(item.paidAt)}
                      </span>
                    </div>
                  )

                  return null
                })}
              </div>
            </div>
          )}

          {/* CRM communications */}
          <LeadCommsLogger
            inquiryId={inquiry.id}
            initialMessages={leadMessages}
            anglerName={inquiry.angler_name ?? ''}
            guideName={guide?.full_name ?? null}
          />

          {/* Internal deal summary (if tracked) */}
          {inquiry.internal_deal_total_eur != null && (
            <div className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(230,126,80,0.05)', border: '1px solid rgba(230,126,80,0.12)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1.5"
                style={{ color: 'rgba(10,46,77,0.38)' }}>Internal deal</p>
              <div className="flex flex-wrap gap-x-6 gap-y-0.5">
                <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                  Total: <strong>€{Number(inquiry.internal_deal_total_eur).toFixed(2)}</strong>
                </span>
                {inquiry.internal_commission_eur != null && (
                  <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                    Commission: <strong style={{ color: '#E67E50' }}>€{Number(inquiry.internal_commission_eur).toFixed(2)}</strong>
                    {' '}
                    <span style={{ color: 'rgba(10,46,77,0.45)' }}>
                      ({((Number(inquiry.internal_commission_eur) / Number(inquiry.internal_deal_total_eur)) * 100).toFixed(1)}%)
                    </span>
                  </span>
                )}
              </div>
              {inquiry.internal_notes != null && inquiry.internal_notes.trim() !== '' && (
                <p className="text-[11px] f-body italic mt-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {inquiry.internal_notes}
                </p>
              )}
            </div>
          )}

          {/* Lost reason (if set) */}
          {inquiry.status === 'lost' && inquiry.lost_reason != null && inquiry.lost_reason.trim() !== '' && (
            <div className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1"
                style={{ color: 'rgba(153,27,27,0.6)' }}>Lost reason</p>
              <p className="text-sm f-body" style={{ color: '#374151' }}>{inquiry.lost_reason}</p>
            </div>
          )}

          {/* Metadata footer */}
          <div className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              ID: {inquiry.id} · Submitted: {new Date(inquiry.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        {/* ── Right: action buttons ─────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-3">

          {/* Status changer — manual */}
          <StatusChanger inquiryId={inquiry.id} currentStatus={inquiry.status} />

          {/* Offer builder card */}
          <div className="rounded-[20px] px-5 py-4"
            style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(10,46,77,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-1"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Offer & Deposit</p>
            <p className="text-sm font-semibold f-body mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {inquiry.angler_name} · {inquiry.party_size} {inquiry.party_size === 1 ? 'person' : 'people'}
            </p>

            {/* Build offer button → modal */}
            {canBuildOffer ? (
              <OfferBuilderModal
                inquiryId={inquiry.id}
                tripTitle={trip?.title ?? 'Your trip'}
                estimatedTotalEur={tripPriceEur}
              />
            ) : (
              <div className="px-4 py-3 rounded-xl"
                style={{
                  background: inquiry.status === 'deposit_paid'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  border: inquiry.status === 'deposit_paid'
                    ? '1px solid rgba(16,185,129,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                }}>
                <p className="text-sm f-body" style={{
                  color: inquiry.status === 'deposit_paid' ? '#6EE7B7' : 'rgba(255,255,255,0.5)',
                }}>
                  {inquiry.status === 'deposit_paid'  && '✅ Deposit received — booking confirmed'}
                  {inquiry.status === 'completed'     && '✅ Trip completed'}
                  {inquiry.status === 'cancelled'     && '❌ Inquiry cancelled'}
                  {inquiry.status === 'lost'          && '❌ Deal lost'}
                  {inquiry.status === 'in_negotiation' && '💬 In negotiation'}
                </p>
              </div>
            )}
          </div>

          {/* Message composer */}
          <div className="rounded-[20px] overflow-hidden"
            style={{ background: 'rgba(10,46,77,0.75)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
                style={{ color: 'rgba(255,255,255,0.28)' }}>Anytime</p>
              <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>
                Send message to angler
              </p>
            </div>
            <div className="px-5 py-4">
              <MessageComposer inquiryId={inquiry.id} />
            </div>
          </div>

          {/* Next action reminder */}
          <NextActionEditor
            inquiryId={inquiry.id}
            initialValue={inquiry.next_action}
          />

          {/* Internal deal tracker — no email */}
          <InternalDealTracker
            inquiryId={inquiry.id}
            initialTotal={inquiry.internal_deal_total_eur}
            initialCommission={inquiry.internal_commission_eur}
            initialNotes={inquiry.internal_notes}
          />

        </div>

      </div>
    </div>
  )
}
