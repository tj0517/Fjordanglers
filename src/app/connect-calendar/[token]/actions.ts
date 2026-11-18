'use server'

/**
 * Server actions of the "Connect with your calendar" page (FA-M.09, FA-M.10). The token is the
 * credential: the database checks it (hash, revoked, used, expired) in the same call that writes.
 * Neither the token, the pasted calendar link nor the OAuth state is ever logged.
 */

import { connectWithLink, type ConnectOutcome } from '@/lib/calendar/connections'
import { startGoogleConnect } from '@/lib/calendar/google-connect'
import { setGoogleStateCookie } from '@/lib/calendar/google-state-cookie'
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

export type GoogleStartResult = { kind: 'redirect'; url: string } | { kind: 'refused' } | { kind: 'disabled' } | { kind: 'error' }

/** "Connect Google Calendar" from the signed link: stores the state, sets its cookie, returns Google's URL. */
export async function startGoogleFromLink(token: unknown): Promise<GoogleStartResult> {
  if (typeof token !== 'string') return { kind: 'refused' }
  try {
    const started = await startGoogleConnect(createServiceClient(), { linkToken: token })
    if (started.kind !== 'redirect') return started
    await setGoogleStateCookie(started.state)
    return { kind: 'redirect', url: started.url }
  } catch (e) {
    console.error('[connect-calendar] google start failed:', e instanceof Error ? e.message : 'unknown error')
    return { kind: 'error' }
  }
}
