'use server'

/**
 * Server action of the "Connect with your calendar" page (FA-M.09). The token is the credential:
 * the database checks it (hash, revoked, used, expired) in the same call that stores the calendar
 * and writes the audit row. Neither the token nor the pasted calendar link is ever logged.
 */

import { connectWithLink, type ConnectOutcome } from '@/lib/calendar/connections'
import { createServiceClient } from '@/lib/supabase/server'

export type ConnectPageOutcome = ConnectOutcome | { kind: 'error' }

export async function connectCalendar(token: unknown, link: unknown): Promise<ConnectPageOutcome> {
  if (typeof token !== 'string') return { kind: 'refused', reason: 'not_found' }
  try {
    return await connectWithLink(createServiceClient(), token, link)
  } catch (e) {
    console.error('[connect-calendar] connect failed:', e instanceof Error ? e.message : 'unknown error')
    return { kind: 'error' }
  }
}
