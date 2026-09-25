/**
 * /admin/inquiries/[id] — FA inquiry detail.
 *
 * 5 tabs: Overview · Conversation · Brief · Guide · Offer & payment
 * Active tab from URL ?tab=; defaults per inquiry status (defaultTabForStatus).
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
import { ReviewLinkGenerator } from './ReviewLinkGenerator'
import { QualifiedChanger } from './QualifiedChanger'
import type { QualifiedValue } from '@/lib/inquiries/qualified'
import { RequestedDatesEditor } from './RequestedDatesEditor'
import { DeleteInquiryButton } from './DeleteInquiryButton'
import type { TripDetails } from '@/actions/inquiries'
import { availabilityWindow } from '@/lib/availability-window'
import { ExternalOfferToggle } from '../ExternalOfferToggle'
import { StatusStepper } from '@/components/admin/inquiry/StatusStepper'
import { EventTimeline } from '@/components/admin/inquiry/EventTimeline'
import { STATUS_LABELS, isInquiryStatus, type InquiryStatus } from '@/lib/inquiries/state'
import { ThreadView } from './ThreadView'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Inquiry Detail — Admin' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground flex-shrink-0 f-body min-w-[110px]">
        {label}
      </span>
      <span className="text-sm text-foreground text-right f-body">{value}</span>
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

  // ── Fetch inquiry ─────────────────────────────────────────────────────────
  const { data: rawInquiry } = await svc
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .single()

  if (rawInquiry == null) notFound()

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
  }

  // ── Fetch messages thread ─────────────────────────────────────────────────
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
      .neq('status', 'draft')
      .order('occurred_at', { ascending: true })
    if (!error && data != null) threadMessages = data as MessageRow[]
  } catch {
    // Table not yet migrated — graceful fallback
  }

  // Latest agent draft for the composer — pre-fills body after deposit link creation (FA-1.30)
  let latestAnglerDraft: { id: string; body: string } | null = null
  try {
    const { data: draftRow } = await svc
      .from('messages')
      .select('id, body')
      .eq('inquiry_id', id)
      .eq('status', 'draft')
      .eq('direction', 'outbound')
      .eq('counterpart', 'angler')
      .eq('drafted_by', 'agent')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (draftRow != null) latestAnglerDraft = draftRow as { id: string; body: string }
  } catch {
    // graceful fallback
  }

  // ── Fetch inquiry events ──────────────────────────────────────────────────
  let inquiryEvents: Array<{
    id:          string
    type:        string
    actor_kind:  string
    actor_id:    string | null
    occurred_at: string
    payload:     Record<string, unknown>
  }> = []
  try {
    const { data: evtRows } = await svc
      .from('inquiry_events')
      .select('id, type, actor_kind, actor_id, occurred_at, payload')
      .eq('inquiry_id', id)
      .order('occurred_at', { ascending: true })
    if (evtRows != null) inquiryEvents = evtRows as typeof inquiryEvents
  } catch {
    // graceful fallback
  }

  const experience = await getInquiryExperience({
    experience_page_id: inquiry.experience_page_id,
    trip_id:            inquiry.trip_id,
  })
  const tripTitle: string | null = experience?.name ?? null
  const tripLocationCountry: string | null = experience?.country ?? null

  // ── Fetch assigned guide ──────────────────────────────────────────────────
  const { data: guide } = inquiry.assigned_guide_id != null
    ? await svc.from('guides').select('full_name, invite_email').eq('id', inquiry.assigned_guide_id).single()
    : { data: null }

  // ── Fetch active guides with blocked dates ────────────────────────────────
  let countryGuides: GuideWithCalendar[] = []
  try {
    const { from: today, to: yearAhead } = availabilityWindow()
    const { data: guideRows } = await svc
      .from('guides')
      .select('id, full_name, avatar_url, country')
      .eq('status', 'active')
      .order('full_name')

    const guideIds = (guideRows ?? []).map(g => g.id)

    if (guideIds.length > 0) {
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

  // ── Fetch review link ─────────────────────────────────────────────────────
  let existingReview: { token: string; submitted_at: string | null } | null = null
  try {
    const { data: reviewRow } = await svc
      .from('reviews')
      .select('token, submitted_at')
      .eq('inquiry_id', id)
      .maybeSingle()
    if (reviewRow != null) existingReview = reviewRow as { token: string; submitted_at: string | null }
  } catch {
    // Table not yet created
  }

  // ── Fetch trip brief ──────────────────────────────────────────────────────
  let tripDetails: TripDetails | null = null
  try {
    const { data: tdData } = await svc
      .from('inquiry_trip_details')
      .select('confirmed_date,confirmed_party_size,price_range,date_flexibility,target_species,accommodation,guide_notes,guide_final_dates,guide_options')
      .eq('inquiry_id', id)
      .maybeSingle()
    if (tdData != null) tripDetails = tdData as unknown as TripDetails
  } catch {
    // Table not yet migrated
  }

  // ── Fetch offer + panel data ──────────────────────────────────────────────
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
        .select('id, label, price_cents, currency, is_accepted')
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
          is_accepted: o.is_accepted ?? false,
        })),
      }
    }

    const inbound = threadMessages.filter(m => m.direction === 'inbound')
    latestInboundMsgId = inbound.length > 0 ? inbound[inbound.length - 1].id : null

    const outboundAngler = threadMessages.filter(m => m.direction === 'outbound' && m.counterpart === 'angler')
    latestOutboundAnglerId = outboundAngler.length > 0 ? outboundAngler[outboundAngler.length - 1].id : null

    const outboundGuide = threadMessages.filter(m => m.direction === 'outbound' && m.counterpart === 'guide')
    latestOutboundGuideId = outboundGuide.length > 0 ? outboundGuide[outboundGuide.length - 1].id : null

    const { data: notifyEvt } = await svc
      .from('inquiry_events')
      .select('id')
      .eq('inquiry_id', id)
      .eq('type', 'guide.notified_paid')
      .maybeSingle()
    guideNotifiedPaid = notifyEvt != null
  } catch {
    // Non-fatal
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
    // Non-fatal
  }

  const igEnabled = Boolean(env.INSTAGRAM_ACCESS_TOKEN)

  const requestedDates = inquiry.requested_dates as string[] | null

  // ── Build correspondence thread ───────────────────────────────────────────
  const thread: ThreadItem[] = []

  if (inquiry.message != null && inquiry.message.trim() !== '') {
    thread.push({ kind: 'angler_inquiry', body: inquiry.message, sentAt: inquiry.created_at })
  }

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

  if (inquiry.offer_sent_at != null && inquiry.offer_total_eur != null && inquiry.offer_deposit_eur != null) {
    thread.push({
      kind:       'offer_sent',
      totalEur:   inquiry.offer_total_eur,
      depositEur: inquiry.offer_deposit_eur,
      notes:      inquiry.offer_notes,
      sentAt:     inquiry.offer_sent_at,
    })
  }

  if (inquiry.deposit_stripe_session_id != null && inquiry.deposit_paid_at == null) {
    thread.push({ kind: 'deposit_sent', depositEur: inquiry.deposit_amount ?? 0, sentAt: inquiry.updated_at ?? inquiry.created_at })
  }

  if (inquiry.deposit_paid_at != null) {
    thread.push({ kind: 'deposit_paid', depositEur: inquiry.deposit_amount ?? 0, paidAt: inquiry.deposit_paid_at })
  }

  thread.sort((a, b) => {
    const ta = 'sentAt' in a ? a.sentAt : a.paidAt
    const tb = 'sentAt' in b ? b.sentAt : b.paidAt
    return new Date(ta).getTime() - new Date(tb).getTime()
  })

  // ── Status badge ──────────────────────────────────────────────────────────
  const safeStatus: InquiryStatus = isInquiryStatus(inquiry.status)
    ? (inquiry.status as InquiryStatus)
    : 'new'

  // ── Tab: Overview ─────────────────────────────────────────────────────────
  const overviewContent = (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Left: contact info */}
      <div className="flex flex-col gap-4">

        {/* Angler */}
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-bold f-display text-foreground">Angler</h2>
          </div>
          <div className="px-5 pb-2">
            <Row label="Name"    value={inquiry.angler_name} />
            <Row label="Email"   value={inquiry.angler_email} />
            <Row label="Phone"   value={(inquiry as typeof inquiry & { angler_phone?: string | null }).angler_phone ?? null} />
            <Row label="Country" value={inquiry.angler_country} />
          </div>
        </div>

        {/* Booking request */}
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-bold f-display text-foreground">Booking Request</h2>
          </div>
          <div className="px-5 pb-2">
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

        {/* Internal deal summary */}
        {inquiry.internal_deal_total_eur != null && (
          <div className="px-4 py-3 rounded-xl border border-accent/20 bg-accent/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1.5 text-muted-foreground">Internal deal</p>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5">
              <span className="text-xs f-body text-foreground">
                Total: <strong>{inquiry.deal_currency === 'USD' ? '$' : '€'}{Number(inquiry.internal_deal_total_eur).toFixed(2)}</strong>
              </span>
              {inquiry.internal_commission_eur != null && (
                <span className="text-xs f-body text-foreground">
                  Commission: <strong className="text-accent">{inquiry.deal_currency === 'USD' ? '$' : '€'}{Number(inquiry.internal_commission_eur).toFixed(2)}</strong>
                  {' '}<span className="text-muted-foreground">
                    ({((Number(inquiry.internal_commission_eur) / Number(inquiry.internal_deal_total_eur)) * 100).toFixed(1)}%)
                  </span>
                </span>
              )}
            </div>
            {inquiry.internal_notes != null && inquiry.internal_notes.trim() !== '' && (
              <p className="text-[11px] f-body italic mt-1.5 text-muted-foreground">
                {inquiry.internal_notes}
              </p>
            )}
          </div>
        )}

        {/* Lost reason */}
        {inquiry.status === 'lost' && inquiry.lost_reason != null && inquiry.lost_reason.trim() !== '' && (
          <div className="px-4 py-3 rounded-xl border border-destructive/20 bg-destructive/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1 text-destructive/70">Lost reason</p>
            <p className="text-sm f-body text-foreground">{inquiry.lost_reason}</p>
          </div>
        )}

        {/* Event timeline */}
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-bold f-display text-foreground">Event timeline</h2>
          </div>
          <div className="px-5 py-4">
            <EventTimeline events={inquiryEvents} />
          </div>
        </div>

        {/* Metadata */}
        <div className="px-4 py-3 rounded-xl border border-border/50 bg-muted/20">
          <p className="text-[10px] f-body text-muted-foreground">
            ID: {inquiry.id} · Submitted: {new Date(inquiry.created_at).toLocaleString('en-GB')}
          </p>
        </div>
      </div>

      {/* Right: actions sidebar */}
      <div className="lg:sticky lg:top-6 space-y-3">
        <StatusChanger inquiryId={inquiry.id} currentStatus={inquiry.status} />

        <QualifiedChanger
          inquiryId={inquiry.id}
          currentValue={(inquiry as unknown as { qualified: QualifiedValue }).qualified ?? 'unknown'}
          setBy={(inquiry as unknown as { qualified_set_by: string | null }).qualified_set_by ?? null}
        />

        <NextActionEditor inquiryId={inquiry.id} initialValue={inquiry.next_action} />

        <div className="pt-2 border-t border-border/40">
          <DeleteInquiryButton inquiryId={inquiry.id} anglerName={inquiry.angler_name} />
        </div>
      </div>
    </div>
  )

  // ── Tab: Conversation ─────────────────────────────────────────────────────
  const conversationContent = (
    <div className="flex flex-col gap-4">
      {/* Correspondence thread — full width, client component handles expand/collapse */}
      {thread.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-bold f-display text-foreground">Correspondence</h2>
          </div>
          <div className="px-5 py-4">
            <ThreadView thread={thread} anglerName={inquiry.angler_name} />
          </div>
        </div>
      )}

      {/* Message composer — full width */}
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-muted-foreground">Anytime</p>
          <p className="text-sm font-bold f-body mt-0.5 text-foreground">Send message</p>
        </div>
        <div className="px-5 py-4">
          <MessageComposer
            key={latestAnglerDraft?.id ?? 'no-draft'}
            inquiryId={inquiry.id}
            guideAssigned={inquiry.assigned_guide_id != null}
            anglerHasPhone={anglerHasPhone}
            guideHasPhone={guideHasPhone}
            waLastInboundAt={waLastInboundAt}
            igEnabled={igEnabled}
            initialDraftId={latestAnglerDraft?.id ?? null}
            initialDraftText={latestAnglerDraft?.body ?? null}
          />
        </div>
      </div>
    </div>
  )


  // ── Tab: Brief ────────────────────────────────────────────────────────────
  const briefContent = (
    <div className="flex flex-col gap-4">
      <TripSetupTab
        inquiryId={inquiry.id}
        anglerName={inquiry.angler_name}
        requestedDates={requestedDates ?? []}
        partySize={inquiry.party_size ?? 1}
        experienceTitle={tripTitle}
        anglerMessage={inquiry.message ?? null}
        initialDetails={tripDetails}
      />
    </div>
  )

  // ── Tab: Guide ────────────────────────────────────────────────────────────
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

  // ── FA-1.29: extract active link event for D2 warning ───────────────────
  // Find the latest payment.link_sent event whose payload.link_id matches the stored link id
  const activeLinkId = (inquiry as typeof inquiry & { deposit_payment_link_id?: string | null }).deposit_payment_link_id ?? null
  const activeLinkUrl = (inquiry as typeof inquiry & { deposit_payment_link_url?: string | null }).deposit_payment_link_url ?? null
  let activeLinkAmountCents: number | null = null
  let activeLinkCurrency:    string | null = null
  if (activeLinkId != null) {
    const linkEvt = [...inquiryEvents]
      .reverse()
      .find(e => e.type === 'payment.link_sent' && (e.payload as { link_id?: string }).link_id === activeLinkId)
    if (linkEvt != null) {
      const p = linkEvt.payload as { amount_cents?: number; currency?: string }
      activeLinkAmountCents = p.amount_cents ?? null
      activeLinkCurrency    = p.currency    ?? null
    }
  }

  // ── Tab: Offer & payment ──────────────────────────────────────────────────
  const offerContent = (
    <div className="flex flex-col gap-4 max-w-xl">
      <ThreadActionsPanel
        inquiryId={inquiry.id}
        inquiryStatus={inquiry.status}
        offer={panelOffer}
        latestInboundMsgId={latestInboundMsgId}
        latestOutboundAnglerId={latestOutboundAnglerId}
        latestOutboundGuideId={latestOutboundGuideId}
        guideId={inquiry.assigned_guide_id ?? null}
        depositAmountCents={inquiry.deposit_amount_cents ?? null}
        depositCurrency={inquiry.deposit_currency ?? null}
        depositPaymentLinkId={activeLinkId}
        depositPaymentLinkUrl={activeLinkUrl}
        depositPaymentLinkAmountCents={activeLinkAmountCents}
        depositPaymentLinkCurrency={activeLinkCurrency}
        guideNotifiedPaid={guideNotifiedPaid}
      />

      <InternalDealTracker
        inquiryId={inquiry.id}
        initialTotal={inquiry.internal_deal_total_eur}
        initialCommission={inquiry.internal_commission_eur}
        initialNotes={inquiry.internal_notes}
        initialCurrency={(inquiry.deal_currency ?? 'EUR') as 'EUR' | 'USD'}
      />

      <ExternalOfferToggle
        inquiryId={inquiry.id}
        initial={inquiry.external_offer_sent ?? false}
      />

      <ReviewLinkGenerator
        inquiryId={inquiry.id}
        existingToken={existingReview?.token ?? null}
        existingBaseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://fjordanglers.com'}
        submittedAt={existingReview?.submitted_at ?? null}
      />
    </div>
  )

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1200px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Link href="/admin" className="text-xs f-body text-muted-foreground hover:text-foreground transition-colors">Admin</Link>
        <span className="text-muted-foreground/50">›</span>
        <Link href="/admin/inquiries" className="text-xs f-body text-muted-foreground hover:text-foreground transition-colors">Inquiries</Link>
        <span className="text-muted-foreground/50">›</span>
        <span className="text-xs f-body font-semibold text-accent">{inquiry.angler_name}</span>
      </div>

      {/* Key facts card */}
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg f-display flex-shrink-0">
                {inquiry.angler_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold f-display text-foreground leading-tight">{inquiry.angler_name}</h1>
                <p className="text-sm f-body text-muted-foreground mt-0.5">
                  {inquiry.angler_email}
                  {(inquiry as typeof inquiry & { angler_phone?: string | null }).angler_phone && (
                    <> · {(inquiry as typeof inquiry & { angler_phone?: string | null }).angler_phone}</>
                  )}
                </p>
              </div>
            </div>
            <Badge data-status={safeStatus} className="status-badge text-sm px-3 py-1 flex-shrink-0" variant="outline">
              {STATUS_LABELS[safeStatus]}
            </Badge>
          </div>

          <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-x-6 gap-y-1 text-sm f-body text-muted-foreground">
            {tripTitle && <span>🎣 {tripTitle}</span>}
            {tripLocationCountry && <span>📍 {tripLocationCountry}</span>}
            {inquiry.party_size > 0 && (
              <span>👥 {inquiry.party_size} {inquiry.party_size === 1 ? 'person' : 'people'}</span>
            )}
            {requestedDates != null && requestedDates.length > 0 && (
              <span>
                📅 {new Date(requestedDates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {requestedDates.length > 1 ? ` +${requestedDates.length - 1}` : ''}
              </span>
            )}
            {guide?.full_name && <span>🗺 {guide.full_name}</span>}
            {inquiry.internal_commission_eur != null && (
              <span className="text-accent font-semibold">
                💰 {inquiry.deal_currency === 'USD' ? '$' : '€'}{Number(inquiry.internal_commission_eur).toFixed(0)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status stepper */}
      <StatusStepper current={safeStatus} />

      {/* Tabbed layout */}
      <InquiryDetailTabs
        status={safeStatus}
        overviewContent={overviewContent}
        conversationContent={conversationContent}
        briefContent={briefContent}
        guideContent={guideContent}
        offerContent={offerContent}
      />

    </div>
  )
}
