/**
 * /admin/inquiries/[id] — FA inquiry detail.
 *
 * Left column : angler info · booking details · original message · messages thread
 * Right column: ThreadActionsPanel (sticky) — offer builder, message composer, deposit link
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { env } from '@/lib/env'
import { getGuidePhone } from '@/lib/guide-contacts'
import { MessageComposer } from './MessageComposer'
import { ThreadActionsPanel } from './ThreadActionsPanel'
import type { OfferForPanel } from './ThreadActionsPanel'
import { StatusChanger } from './StatusChanger'
import { InternalDealTracker } from './InternalDealTracker'
import { NextActionEditor } from './NextActionEditor'
import { InquiryDetailTabs } from './InquiryDetailTabs'
import { GuideAttachmentTab, type GuideWithCalendar } from './GuideAttachmentTab'
import { TripSetupTab } from './TripSetupTab'
import { ProposalTab } from './ProposalTab'
import { ReviewLinkGenerator } from './ReviewLinkGenerator'
import { AgentToggle } from './AgentToggle'
import { QualifiedChanger } from './QualifiedChanger'
import type { QualifiedValue } from '@/lib/inquiries/qualified'
import { RequestedDatesEditor } from './RequestedDatesEditor'
import { DeleteInquiryButton } from './DeleteInquiryButton'
import type { TripDetails, OfferQuestion, ScheduleEntry, OfferOptionInput } from '@/actions/inquiries'
import type { InitialOfferData } from './OfferBuilder'

export const metadata = { title: 'Inquiry Detail — Admin' }

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending:                 'Pending',
  in_negotiation:          'Negotiating',
  waiting_for_guide_offer: 'Waiting for guide offer',
  offer_sent:              'Offer sent',
  waiting_for_deposit:     'Waiting for deposit',
  deposit_sent:            'Deposit sent',
  deposit_paid:            'Confirmed',
  completed:               'Completed',
  lost:                    'Lost',
  cancelled:               'Cancelled',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending:                 { color: '#92400E', bg: 'rgba(251,191,36,0.15)',  border: '1px solid rgba(251,191,36,0.4)'  },
  in_negotiation:          { color: '#5B21B6', bg: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' },
  waiting_for_guide_offer: { color: '#C2410C', bg: 'rgba(234,88,12,0.12)',  border: '1px solid rgba(234,88,12,0.35)'  },
  offer_sent:              { color: '#0E7490', bg: 'rgba(6,182,212,0.12)',  border: '1px solid rgba(6,182,212,0.35)'  },
  waiting_for_deposit:     { color: '#3730A3', bg: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)' },
  deposit_sent:            { color: '#1E40AF', bg: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)'  },
  deposit_paid:            { color: '#065F46', bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)'  },
  completed:               { color: '#374151', bg: 'rgba(107,114,128,0.10)',border: '1px solid rgba(107,114,128,0.2)' },
  lost:                    { color: '#991B1B', bg: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.25)'  },
  cancelled:               { color: '#991B1B', bg: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.25)'  },
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
  | { kind: 'message'; id: string; direction: 'inbound' | 'outbound'; channel: string; counterpart: string; subject: string | null; body: string; draftedBy: string | null; sentAt: string }
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
    offer_trip_plan:         string | null
    offer_license_info:      string | null
    offer_license_heading:   string | null
    offer_inclusions:        unknown
    offer_questions:         unknown
    offer_refund_reason:     string | null
    offer_photos:            unknown
    offer_location:          string | null
    offer_what_to_bring:     unknown
    offer_schedule:          unknown
    offer_location_lat:      number | null
    offer_location_lng:      number | null
    offer_location_zoom:     number | null
    offer_location_geojson:  unknown
    offer_options:           unknown
    internal_deal_total_eur: number | null
    internal_commission_eur: number | null
    internal_notes:          string | null
    lost_reason:             string | null
    last_contact_at:         string | null
    next_action:             string | null
    deal_currency:           string | null
    assigned_guide_id:       string | null
    guide_acceptance:        string | null
    guide_decline_reason:    string | null
    external_offer_sent:     boolean
    offer_token:             string | null
    deposit_paid_at:         string | null
    agent_status:            string | null
    agent_round:             number | null
  }


  // ── Fetch messages thread ──────────────────────────────────────────────────
  type MessageRow = {
    id:          string
    direction:   'inbound' | 'outbound'
    channel:     string
    counterpart: string
    body:        string
    subject:     string | null
    status:      string
    drafted_by:  string | null
    occurred_at: string
  }
  let threadMessages: MessageRow[] = []
  try {
    const { data, error } = await svc
      .from('messages')
      .select('id, direction, channel, counterpart, body, subject, status, drafted_by, occurred_at')
      .eq('inquiry_id', id)
      .order('occurred_at', { ascending: true })
    if (!error && data != null) threadMessages = data as MessageRow[]
  } catch {
    // Table not yet migrated — graceful fallback
  }

  // Trip title and country come from the inquiry's experience_pages row
  // (experience_page_id first, then trip_id). Null when it cannot be resolved.
  const experience = await getInquiryExperience({
    experience_page_id: inquiry.experience_page_id,
    trip_id:            inquiry.trip_id,
  })
  const tripTitle: string | null = experience?.name ?? null
  const tripLocationCountry: string | null = experience?.country ?? null

  // ── Fetch assigned guide (name + contact) ─────────────────────────────────
  const { data: guide } = inquiry.assigned_guide_id != null
    ? await svc.from('guides').select('full_name, invite_email').eq('id', inquiry.assigned_guide_id).single()
    : { data: null }

  // ── Fetch active guides with their blocked dates ───────────────────────────

  let countryGuides: GuideWithCalendar[] = []
  try {
    const today     = new Date().toISOString().slice(0, 10)
    // impure by design, patrz FA-1.15 — async Server Component, wartość liczona raz na żądanie
    // eslint-disable-next-line react-hooks/purity
    const yearAhead = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)

    const { data: guideRows } = await svc
      .from('guides')
      .select('id, full_name, avatar_url, country')
      .eq('status', 'active')
      .order('full_name')

    const guideIds = (guideRows ?? []).map(g => g.id)

    if (guideIds.length > 0) {
      // Fetch their blocked dates
      const { data: blockedRows } = await svc
        .from('guide_unavailable_dates')
        .select('guide_id, date')
        .in('guide_id', guideIds)
        .gte('date', today)
        .lte('date', yearAhead)

      type BlockedRow = { guide_id: string; date: string }

      countryGuides = (guideRows ?? []).map(g => ({
        id:           g.id,
        full_name:    g.full_name ?? '',
        avatar_url:   g.avatar_url ?? null,
        country:      (g as typeof g & { country?: string }).country ?? null,
        blockedDates: (blockedRows ?? [] as BlockedRow[])
          .filter((r: BlockedRow) => r.guide_id === g.id)
          .map((r: BlockedRow) => r.date),
      }))
    }
  } catch {
    // Non-fatal — guide attachment tab will show empty state
  }

  // ── Fetch review link (graceful if table doesn't exist yet) ───────────────
  let existingReview: { token: string; submitted_at: string | null } | null = null
  try {
    const { data: reviewRow } = await svc
      .from('reviews')
      .select('token, submitted_at')
      .eq('inquiry_id', id)
      .maybeSingle()
    if (reviewRow != null) existingReview = reviewRow as { token: string; submitted_at: string | null }
  } catch {
    // Table not yet created — safe to ignore
  }

  // ── Fetch trip brief ───────────────────────────────────────────────────────
  let tripDetails: TripDetails | null = null
  try {
    const { data: tdData } = await svc
      .from('inquiry_trip_details')
      .select('confirmed_date,confirmed_party_size,price_range,date_flexibility,target_species,accommodation,guide_notes,guide_final_dates,guide_options')
      .eq('inquiry_id', id)
      .maybeSingle()
    if (tdData != null) tripDetails = tdData as unknown as TripDetails
  } catch {
    // Table not yet migrated — safe to ignore
  }

  // ── Fetch offer + options for ThreadActionsPanel ──────────────────────────
  let panelOffer: OfferForPanel | null = null
  let latestInboundMsgId:     string | null = null
  let latestOutboundAnglerId: string | null = null
  let latestOutboundGuideId:  string | null = null
  let guideNotifiedPaid = false

  try {
    const { data: offerRow } = await svc
      .from('offers')
      .select('id, status, source_message_id')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (offerRow != null) {
      const { data: opts } = await svc
        .from('offer_options')
        .select('id, label, price_cents, currency')
        .eq('offer_id', offerRow.id)
      panelOffer = {
        id:                offerRow.id,
        status:            offerRow.status,
        source_message_id: offerRow.source_message_id,
        options:           (opts ?? []).map(o => ({
          id:          o.id,
          label:       o.label,
          price_cents: o.price_cents,
          currency:    o.currency,
        })),
      }
    }

    // Latest inbound message (any counterpart)
    const inbound = threadMessages.filter(m => m.direction === 'inbound')
    latestInboundMsgId = inbound.length > 0 ? inbound[inbound.length - 1].id : null

    // Latest outbound to angler
    const outboundAngler = threadMessages.filter(m => m.direction === 'outbound' && m.counterpart === 'angler')
    latestOutboundAnglerId = outboundAngler.length > 0 ? outboundAngler[outboundAngler.length - 1].id : null

    // Latest outbound to guide
    const outboundGuide = threadMessages.filter(m => m.direction === 'outbound' && m.counterpart === 'guide')
    latestOutboundGuideId = outboundGuide.length > 0 ? outboundGuide[outboundGuide.length - 1].id : null

    // Was guide.notified_paid already emitted?
    const { data: notifyEvt } = await svc
      .from('inquiry_events')
      .select('id')
      .eq('inquiry_id', id)
      .eq('type', 'guide.notified_paid')
      .maybeSingle()
    guideNotifiedPaid = notifyEvt != null
  } catch {
    // Non-fatal — panel shows empty state
  }

  // ── WA composer props ─────────────────────────────────────────────────────
  const anglerHasPhone = Boolean(
    (inquiry as typeof inquiry & { angler_phone?: string | null }).angler_phone,
  )
  let guideHasPhone   = false
  let waLastInboundAt: string | null = null

  try {
    if (inquiry.assigned_guide_id != null) {
      guideHasPhone = Boolean(await getGuidePhone(inquiry.assigned_guide_id))
    }

    const waInbounds = threadMessages.filter(
      m => m.channel === 'whatsapp' && m.direction === 'inbound',
    )
    if (waInbounds.length > 0) {
      waLastInboundAt = waInbounds[waInbounds.length - 1].occurred_at
    }
  } catch {
    // Non-fatal — WA composer will show email fallback
  }

  const igEnabled = Boolean(env.INSTAGRAM_ACCESS_TOKEN)

  const st             = STATUS_STYLE[inquiry.status] ?? STATUS_STYLE.pending
  const requestedDates = inquiry.requested_dates as string[] | null

  // ── Build correspondence thread ────────────────────────────────────────────
  const thread: ThreadItem[] = []

  // Original angler message (if any)
  if (inquiry.message != null && inquiry.message.trim() !== '') {
    thread.push({ kind: 'angler_inquiry', body: inquiry.message, sentAt: inquiry.created_at })
  }

  // All messages from the messages table
  for (const msg of threadMessages) {
    thread.push({
      kind:        'message',
      id:          msg.id,
      direction:   msg.direction,
      channel:     msg.channel,
      counterpart: msg.counterpart,
      subject:     msg.subject,
      body:        msg.body,
      draftedBy:   msg.drafted_by,
      sentAt:      msg.occurred_at,
    })
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

  // ── Build left column (Contact tab) ───────────────────────────────────────
  const contactContent = (
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
          <Row label="Phone"   value={(inquiry as typeof inquiry & { angler_phone?: string | null }).angler_phone ?? null} />
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
          <Row label="Trip"        value={tripTitle ?? '—'} />
          <Row label="Guide"       value={guide?.full_name ?? '—'} />
          <Row label="Guide email" value={guide?.invite_email ?? '—'} />
          <RequestedDatesEditor
            inquiryId={inquiry.id}
            initialDates={requestedDates ?? []}
          />
          <Row label="Party size" value={`${inquiry.party_size} ${inquiry.party_size === 1 ? 'person' : 'people'}`} />
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

              if (item.kind === 'angler_inquiry') return (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold f-body"
                    style={{ background: 'rgba(10,46,77,0.1)', color: '#0A2E4D' }}>
                    {inquiry.angler_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{inquiry.angler_name}</span>
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{fmtDateTime(item.sentAt)}</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body"
                        style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)' }}>Inquiry</span>
                    </div>
                    <div className="px-3 py-2.5 rounded-xl text-sm f-body leading-relaxed italic"
                      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)', color: '#374151' }}>
                      &ldquo;{item.body}&rdquo;
                    </div>
                  </div>
                </div>
              )

              if (item.kind === 'offer_sent') return (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                    style={{ background: '#E67E50', color: '#fff' }}>FA</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>FjordAnglers</span>
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{fmtDateTime(item.sentAt)}</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body"
                        style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.25)' }}>
                        Offer sent</span>
                    </div>
                    <div className="px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.18)' }}>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-1">
                        <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>Total: <strong>€{item.totalEur.toFixed(2)}</strong></span>
                        <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>Deposit: <strong>€{item.depositEur.toFixed(2)}</strong></span>
                        <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>Balance to guide: <strong>€{(item.totalEur - item.depositEur).toFixed(2)}</strong></span>
                      </div>
                      {item.notes != null && item.notes.trim() !== '' && (
                        <p className="text-xs f-body italic mt-1.5" style={{ color: 'rgba(10,46,77,0.55)' }}>&ldquo;{item.notes}&rdquo;</p>
                      )}
                    </div>
                  </div>
                </div>
              )

              if (item.kind === 'message') {
                const isInbound = item.direction === 'inbound'
                const channelLabel = item.channel.charAt(0).toUpperCase() + item.channel.slice(1)
                const senderLabel = isInbound
                  ? (item.counterpart === 'guide' ? 'Guide' : inquiry.angler_name)
                  : (item.draftedBy === 'agent' ? 'AI Agent' : 'FjordAnglers')
                const avatarBg = isInbound ? 'rgba(10,46,77,0.1)' : (item.draftedBy === 'agent' ? '#6366F1' : '#0A2E4D')
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold f-body"
                      style={{ background: avatarBg, color: '#fff' }}>
                      {isInbound ? senderLabel.charAt(0).toUpperCase() : 'FA'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{senderLabel}</span>
                        <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{fmtDateTime(item.sentAt)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded f-body"
                          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}>
                          {channelLabel} · {item.direction}
                        </span>
                      </div>
                      <div className="px-3 py-2.5 rounded-xl"
                        style={{
                          background: isInbound ? 'rgba(10,46,77,0.04)' : 'rgba(10,46,77,0.06)',
                          border: '1px solid rgba(10,46,77,0.09)',
                        }}>
                        {item.subject != null && item.subject.trim() !== '' && (
                          <p className="text-xs font-bold f-body mb-1" style={{ color: '#0A2E4D' }}>{item.subject}</p>
                        )}
                        <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{item.body}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.kind === 'deposit_sent') return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <span className="text-[11px] f-body" style={{ color: '#1E40AF' }}>
                    🔗 Deposit link sent — €{item.depositEur.toFixed(2)} — awaiting payment
                  </span>
                </div>
              )

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

      {/* Internal deal summary */}
      {inquiry.internal_deal_total_eur != null && (
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(230,126,80,0.05)', border: '1px solid rgba(230,126,80,0.12)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1.5"
            style={{ color: 'rgba(10,46,77,0.38)' }}>Internal deal</p>
          <div className="flex flex-wrap gap-x-6 gap-y-0.5">
            <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
              Total: <strong>{inquiry.deal_currency === 'USD' ? '$' : '€'}{Number(inquiry.internal_deal_total_eur).toFixed(2)}</strong>
            </span>
            {inquiry.internal_commission_eur != null && (
              <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                Commission: <strong style={{ color: '#E67E50' }}>{inquiry.deal_currency === 'USD' ? '$' : '€'}{Number(inquiry.internal_commission_eur).toFixed(2)}</strong>
                {' '}<span style={{ color: 'rgba(10,46,77,0.45)' }}>
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

      {/* Lost reason */}
      {inquiry.status === 'lost' && inquiry.lost_reason != null && inquiry.lost_reason.trim() !== '' && (
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1" style={{ color: 'rgba(153,27,27,0.6)' }}>Lost reason</p>
          <p className="text-sm f-body" style={{ color: '#374151' }}>{inquiry.lost_reason}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="px-4 py-3 rounded-xl"
        style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
        <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
          ID: {inquiry.id} · Submitted: {new Date(inquiry.created_at).toLocaleString('en-GB')}
        </p>
      </div>
    </div>
  )

  // ── Build right sidebar (Contact tab) ──────────────────────────────────────
  const sidePanel = (
    <div className="space-y-3">
      <StatusChanger inquiryId={inquiry.id} currentStatus={inquiry.status} />

      <AgentToggle inquiryId={inquiry.id} initialStatus={inquiry.agent_status} />

      <QualifiedChanger
        inquiryId={inquiry.id}
        currentValue={(inquiry as unknown as { qualified: QualifiedValue }).qualified ?? 'unknown'}
        setBy={(inquiry as unknown as { qualified_set_by: string | null }).qualified_set_by ?? null}
      />

      <ThreadActionsPanel
        inquiryId={inquiry.id}
        inquiryStatus={inquiry.status}
        offer={panelOffer}
        latestInboundMsgId={latestInboundMsgId}
        latestOutboundAnglerId={latestOutboundAnglerId}
        latestOutboundGuideId={latestOutboundGuideId}
        guideId={inquiry.assigned_guide_id ?? null}
        depositAmountEur={inquiry.deposit_amount ?? null}
        guideNotifiedPaid={guideNotifiedPaid}
      />

      <div className="rounded-[20px] overflow-hidden"
        style={{ background: 'rgba(10,46,77,0.75)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(255,255,255,0.28)' }}>Anytime</p>
          <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>Send message</p>
        </div>
        <div className="px-5 py-4">
          <MessageComposer
            inquiryId={inquiry.id}
            guideAssigned={inquiry.assigned_guide_id != null}
            anglerHasPhone={anglerHasPhone}
            guideHasPhone={guideHasPhone}
            waLastInboundAt={waLastInboundAt}
            igEnabled={igEnabled}
          />
        </div>
      </div>

      <NextActionEditor inquiryId={inquiry.id} initialValue={inquiry.next_action} />

      <InternalDealTracker
        inquiryId={inquiry.id}
        initialTotal={inquiry.internal_deal_total_eur}
        initialCommission={inquiry.internal_commission_eur}
        initialNotes={inquiry.internal_notes}
        initialCurrency={(inquiry.deal_currency ?? 'EUR') as 'EUR' | 'USD'}
      />

      <ReviewLinkGenerator
        inquiryId={inquiry.id}
        existingToken={existingReview?.token ?? null}
        existingBaseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://fjordanglers.com'}
        submittedAt={existingReview?.submitted_at ?? null}
      />

      <div className="pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
        <DeleteInquiryButton inquiryId={inquiry.id} anglerName={inquiry.angler_name} />
      </div>
    </div>
  )

  // ── Guide attachment tab ───────────────────────────────────────────────────
  const guideContent = (
    <GuideAttachmentTab
      inquiryId={inquiry.id}
      currentAssignedGuideId={inquiry.assigned_guide_id ?? null}
      guides={countryGuides}
      requestedDates={requestedDates ?? []}
      tripCountry={tripLocationCountry}
      guideAcceptance={inquiry.guide_acceptance ?? null}
      guideDeclineReason={inquiry.guide_decline_reason ?? null}
      externalOfferSent={inquiry.external_offer_sent ?? false}
    />
  )

  // ── Trip setup tab ─────────────────────────────────────────────────────────
  const tripSetupContent = (
    <TripSetupTab
      inquiryId={inquiry.id}
      anglerName={inquiry.angler_name}
      requestedDates={requestedDates ?? []}
      partySize={inquiry.party_size ?? 1}
      experienceTitle={tripTitle}
      anglerMessage={inquiry.message ?? null}
      initialDetails={tripDetails}
    />
  )

  // ── Build initialOffer from saved draft ────────────────────────────────────
  const initialOffer: InitialOfferData | null = inquiry.offer_token != null ? {
    totalPriceEur:   inquiry.offer_total_eur ?? null,
    depositEur:      inquiry.offer_deposit_eur ?? null,
    notes:           inquiry.offer_notes ?? null,
    licenseInfo:     inquiry.offer_license_info ?? null,
    licenseHeading:  inquiry.offer_license_heading ?? null,
    inclusions:      (inquiry.offer_inclusions as string[] | null) ?? [],
    questions:       (inquiry.offer_questions as OfferQuestion[] | null) ?? [],
    refundReason:    inquiry.offer_refund_reason ?? null,
    photos:          (inquiry.offer_photos as string[] | null) ?? [],
    location:        inquiry.offer_location ?? null,
    whatToBring:     (inquiry.offer_what_to_bring as string[] | null) ?? [],
    schedule:        (inquiry.offer_schedule as ScheduleEntry[] | null) ?? [],
    locationLat:     inquiry.offer_location_lat != null ? Number(inquiry.offer_location_lat) : null,
    locationLng:     inquiry.offer_location_lng != null ? Number(inquiry.offer_location_lng) : null,
    locationZoom:    inquiry.offer_location_zoom != null ? Number(inquiry.offer_location_zoom) : 8,
    locationGeoJson: (inquiry.offer_location_geojson as object | null) ?? null,
    offerToken:      inquiry.offer_token,
    offerSentAt:     inquiry.offer_sent_at ?? null,
    options:         (inquiry.offer_options as OfferOptionInput[] | null) ?? null,
  } : null

  // ── Proposal tab ───────────────────────────────────────────────────────────
  const proposalContent = (
    <ProposalTab
      inquiryId={inquiry.id}
      anglerName={inquiry.angler_name}
      experienceTitle={tripTitle}
      guideOptions={tripDetails?.guide_options ?? []}
      guideFinalDates={tripDetails?.guide_final_dates ?? null}
      existingToken={inquiry.offer_token ?? null}
      existingTotalEur={inquiry.offer_total_eur ?? null}
      existingDepositEur={inquiry.offer_deposit_eur ?? null}
      existingSentAt={inquiry.offer_sent_at ?? null}
      depositPaidAt={inquiry.deposit_paid_at ?? null}
      baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://fjordanglers.com'}
      initialOffer={initialOffer}
      availableGuides={countryGuides.map(g => ({ id: g.id, full_name: g.full_name, avatar_url: g.avatar_url }))}
      currentGuideId={inquiry.assigned_guide_id ?? null}
    />
  )

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/inquiries" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Inquiries</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>{inquiry.angler_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold f-display text-[#0A2E4D]">{inquiry.angler_name}</h1>
          <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {tripTitle ?? inquiry.trip_id}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-sm font-semibold f-body flex-shrink-0"
          style={{ background: st.bg, color: st.color, border: st.border }}>
          {STATUS_LABEL[inquiry.status] ?? inquiry.status}
        </span>
      </div>

      {/* Tabbed layout */}
      <InquiryDetailTabs
        contactContent={contactContent}
        sidePanel={sidePanel}
        guideContent={guideContent}
        tripSetupContent={tripSetupContent}
        proposalContent={proposalContent}
      />

    </div>
  )
}
