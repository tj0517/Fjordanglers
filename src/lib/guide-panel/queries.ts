/**
 * FA-M.13 — the guide panel's reads (`/dashboard/*`). Pages call these instead of `.from(...)`
 * (CLAUDE.md rule 3).
 *
 * Who is asking: `sessionGuide()` reads the signed-in user from the session cookie and finds their
 * own listing. Every other function takes that `guideId` and nothing else — the service client sees
 * every guide, so the only id that may be passed in is the one `sessionGuide()` returned.
 *
 * Server only: this module imports `@/lib/supabase/server` (next/headers), which a client component
 * cannot bundle. The calendar connection row is service_role-only (FA-M.09); its secrets (link,
 * token) are never selected — `calendarStatusByGuide` reads provider, host, status and sync times.
 */

import { availabilityWindow } from '@/lib/availability-window'
import { busyDaysByGuide, calendarStatusByGuide, type BusyDay, type CalendarStatus } from '@/lib/calendar/connections'
import { listGuideRequestsForGuide, type GuideRequestListItem } from '@/lib/guide-requests/requests'
import { getInquiryExperiences } from '@/lib/inquiries/experience-lookup'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export type SessionGuide =
  | { kind: 'signed_out' }
  /** A signed-in account with no guide listing bound to it (the layout shows a notice). */
  | { kind: 'no_listing' }
  | { kind: 'guide'; userId: string; guideId: string }

export async function sessionGuide(): Promise<SessionGuide> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return { kind: 'signed_out' }
  const { data: guide, error } = await createServiceClient()
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error != null) throw new Error(`guide lookup failed: ${error.message}`)
  if (guide == null) return { kind: 'no_listing' }
  return { kind: 'guide', userId: user.id, guideId: guide.id }
}

export interface GuidePanelRequest extends GuideRequestListItem {
  experienceName: string | null
}

/** The guide's requests, newest first, with the experience name when the trip has one. */
export async function guideRequestList(guideId: string): Promise<GuidePanelRequest[]> {
  const items = await listGuideRequestsForGuide(createServiceClient(), guideId)
  const experiences = await getInquiryExperiences(
    items.map(i => ({ id: i.inquiryId, trip_id: i.tripId, experience_page_id: i.experiencePageId })),
  )
  return items.map(i => ({ ...i, experienceName: experiences.get(i.inquiryId)?.name ?? null }))
}

export interface GuideCalendarPreview {
  /** Busy days from today for a year, each with every source that blocks it. */
  busyDays: BusyDay[]
  /** null when no calendar is connected. */
  connection: CalendarStatus | null
}

export async function guideCalendarPreview(guideId: string): Promise<GuideCalendarPreview> {
  const svc = createServiceClient()
  const { from, to } = availabilityWindow()
  const [busy, status] = await Promise.all([
    busyDaysByGuide(svc, [guideId], from, to),
    calendarStatusByGuide(svc, [guideId]),
  ])
  return { busyDays: busy.get(guideId) ?? [], connection: status.get(guideId) ?? null }
}

export async function guideCalendarConnection(guideId: string): Promise<CalendarStatus | null> {
  const status = await calendarStatusByGuide(createServiceClient(), [guideId])
  return status.get(guideId) ?? null
}
