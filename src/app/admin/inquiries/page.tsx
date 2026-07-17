/**
 * /admin/inquiries — server component: fetches all data once, delegates
 * all filtering/tabs/search to InquiriesClient (client-side, instant).
 */

import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { InquiriesClient } from './InquiriesClient'
import type { InquiryRow } from './InquiriesClient'

export const metadata = {
  title: 'Inquiries — Admin',
}

export default async function AdminInquiriesPage() {
  const svc = createServiceClient()

  // ── Fetch all inquiries ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawAll } = await (svc as any)
    .from('inquiries')
    .select('id, status, angler_name, angler_email, angler_phone, requested_dates, party_size, created_at, trip_id, internal_commission_eur, deal_currency, lost_reason, last_contact_at, next_action, assigned_guide_id, guide_acceptance, guide_decline_reason, external_offer_sent')
    .order('created_at', { ascending: false })

  const allRows = (rawAll ?? []) as InquiryRow[]

  // ── Trip titles ─────────────────────────────────────────────────────────────
  const tripIds = [...new Set(allRows.map(r => r.trip_id).filter(Boolean))] as string[]
  const { data: trips } = tripIds.length > 0
    ? await svc.from('experiences').select('id, title').in('id', tripIds)
    : { data: [] as Array<{ id: string; title: string }> }
  const tripMap = Object.fromEntries((trips ?? []).map(t => [t.id, t.title]))

  // ── Guide names ─────────────────────────────────────────────────────────────
  const guideIds = [...new Set(allRows.map(r => r.assigned_guide_id).filter(Boolean))] as string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: guidesData } = guideIds.length > 0
    ? await (svc as any).from('guides').select('id, full_name').in('id', guideIds)
    : { data: [] as Array<{ id: string; full_name: string }> }
  const guideMap = Object.fromEntries(
    ((guidesData ?? []) as Array<{ id: string; full_name: string }>).map(g => [g.id, g.full_name])
  )

  // ── Offer status ────────────────────────────────────────────────────────────
  const assignedInquiryIds = allRows.filter(r => r.assigned_guide_id != null).map(r => r.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tripDetailsData } = assignedInquiryIds.length > 0
    ? await (svc as any)
        .from('inquiry_trip_details')
        .select('inquiry_id, guide_options')
        .in('inquiry_id', assignedInquiryIds)
    : { data: [] as Array<{ inquiry_id: string; guide_options: unknown }> }
  const offerSentIds = ((tripDetailsData ?? []) as Array<{ inquiry_id: string; guide_options: unknown }>)
    .filter(d => Array.isArray(d.guide_options) && (d.guide_options as unknown[]).length > 0)
    .map(d => d.inquiry_id)

  return (
    <Suspense>
      <InquiriesClient
        allRows={allRows}
        tripMap={tripMap}
        guideMap={guideMap}
        offerSentIds={offerSentIds}
      />
    </Suspense>
  )
}
