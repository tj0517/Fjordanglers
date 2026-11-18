'use server'

/**
 * Admin side of the guide calendar (FA-M.09): issue the one-time "Connect with your calendar" link
 * for a guide, to copy and send on WhatsApp. The plain link is returned once, here, and is never
 * stored or logged; issuing a new one revokes the guide's unused one (tj D5). The audit_log rows
 * are written by the database function in the same transaction.
 *
 * Guide side (FA-M.10): start "Connect with Google" from the guide's own session, and disconnect the
 * guide's calendar. Both check the session (requireGuide()) and act only on that guide; the buttons
 * in the account panel come with FA-M.13 (tj 2026-11-18).
 */

import { revalidatePath } from 'next/cache'
import { getAppUrl } from '@/lib/app-url'
import { requireAdmin, requireGuide, UnauthorizedError } from '@/lib/auth/guards'
import { issueConnectLink } from '@/lib/calendar/connections'
import { disconnectGuideCalendar, startGoogleConnect } from '@/lib/calendar/google-connect'
import { setGoogleStateCookie } from '@/lib/calendar/google-state-cookie'
import { CALENDAR_DISABLED_MESSAGE, calendarLinkKey } from '@/lib/calendar/link-crypto'
import { createServiceClient } from '@/lib/supabase/server'

export type IssueCalendarLinkResult =
  | { success: true; link: string; expiresAt: string }
  | { success: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function issueCalendarConnectLink(guideId: unknown): Promise<IssueCalendarLinkResult> {
  const { userId } = await requireAdmin()
  if (typeof guideId !== 'string' || !UUID_RE.test(guideId)) return { success: false, error: 'Unknown guide.' }
  // A link the guide could not use would only confuse them.
  if (!calendarLinkKey().ok) return { success: false, error: CALENDAR_DISABLED_MESSAGE }
  try {
    const { token, expiresAt } = await issueConnectLink(createServiceClient(), guideId, userId)
    return { success: true, link: `${await getAppUrl()}/connect-calendar/${token}`, expiresAt }
  } catch (e) {
    console.error('[calendar] issue link failed:', e instanceof Error ? e.message : 'unknown error')
    return { success: false, error: 'Could not create the link — try again.' }
  }
}

export type GoogleSessionStartResult = { success: true; url: string } | { success: false; error: string }

/** "Connect Google Calendar" from the guide's account: Google's URL to send the browser to. */
export async function startGoogleCalendarConnect(): Promise<GoogleSessionStartResult> {
  const { guide } = await requireGuide()
  try {
    const started = await startGoogleConnect(createServiceClient(), { guideId: guide.id })
    if (started.kind === 'disabled') return { success: false, error: 'Connecting Google Calendar isn’t available right now.' }
    if (started.kind === 'refused') return { success: false, error: 'Unknown guide.' }
    await setGoogleStateCookie(started.state)
    return { success: true, url: started.url }
  } catch (e) {
    console.error('[calendar] google start failed:', e instanceof Error ? e.message : 'unknown error')
    return { success: false, error: 'Could not start — try again.' }
  }
}

export type DisconnectCalendarResult =
  | { success: true; provider: 'apple_ics' | 'google' | null; busyDaysRemoved: number }
  | { success: false; error: string }

/**
 * The guide disconnects their calendar. `guideId` must be the signed-in guide's own: anything else is
 * refused before a read or a write (a hidden button is not protection).
 */
export async function disconnectCalendar(guideId: unknown): Promise<DisconnectCalendarResult> {
  const { userId, guide } = await requireGuide()
  if (typeof guideId !== 'string' || guideId !== guide.id) throw new UnauthorizedError('Not your calendar')
  try {
    const result = await disconnectGuideCalendar(createServiceClient(), guide.id, userId)
    revalidatePath('/dashboard/calendar')
    return { success: true, ...result }
  } catch (e) {
    console.error('[calendar] disconnect failed:', e instanceof Error ? e.message : 'unknown error')
    return { success: false, error: 'Could not disconnect — try again.' }
  }
}
