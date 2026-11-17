'use server'

/**
 * Admin side of the guide calendar (FA-M.09): issue the one-time "Connect with your calendar" link
 * for a guide, to copy and send on WhatsApp. The plain link is returned once, here, and is never
 * stored or logged; issuing a new one revokes the guide's unused one (tj D5). The audit_log rows
 * are written by the database function in the same transaction.
 */

import { getAppUrl } from '@/lib/app-url'
import { requireAdmin } from '@/lib/auth/guards'
import { issueConnectLink } from '@/lib/calendar/connections'
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
