/**
 * "Connect with Google" (FA-M.10) — the data layer of the OAuth flow and of disconnecting.
 * Server-only. Every write goes through the database functions of
 * `20261121000000_google_calendar_connect.sql` (service_role only), each with its audit_log row.
 *
 * Who may call what:
 *   * `startGoogleConnect` from the signed link — the link is the credential, checked by the database
 *     in the call that stores the state; from a session — after requireGuide(), with that guide's id;
 *   * `finishGoogleConnect` — the callback route, after it compared the `state` query value with the
 *     cookie set at the start (same browser); the state is used up first, so a tampered, missing,
 *     replayed or expired state stores nothing. A session start also needs the same guide signed in;
 *   * `disconnectGuideCalendar` — after requireGuide(), for that guide's own id only.
 *
 * The OAuth state, the authorisation code and the tokens are never logged or returned to a page.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { revokeStoredGoogleToken, type GoogleDeps } from './connections'
import { generateCalendarConnectToken, hashCalendarConnectToken, isCalendarConnectToken } from './connect-token'
import { exchangeGoogleCode, googleAuthUrl, googleBusyDays, googleClientFromEnv, type GoogleError } from './google'
import { calendarLinkKey, encryptGoogleToken } from './link-crypto'

type Client = SupabaseClient<Database>

export type GoogleConnectEntry = 'link' | 'session'

export type GoogleStartOutcome =
  | { kind: 'redirect'; url: string; state: string }
  | { kind: 'refused' }
  | { kind: 'disabled' }

export type GoogleFinishOutcome =
  | { kind: 'connected'; entry: GoogleConnectEntry; busyDays: number }
  | { kind: 'denied'; entry: GoogleConnectEntry }
  | { kind: 'failed'; entry: GoogleConnectEntry; error: GoogleError }
  | { kind: 'disabled'; entry: GoogleConnectEntry }
  /** Wrong / missing / used / expired state, another guide's session, or the link died meanwhile. Nothing stored. */
  | { kind: 'refused'; entry: GoogleConnectEntry | null }

function googleClient(deps: GoogleDeps) {
  return deps.client !== undefined ? deps.client : googleClientFromEnv()
}

/**
 * Stores a fresh OAuth state (sha256 only, 10 minutes) for the guide and returns Google's consent URL.
 * The plain state goes to the caller once — into the URL and the browser cookie — and nowhere else.
 */
export async function startGoogleConnect(
  client: Client,
  from: { linkToken: string } | { guideId: string },
  deps: GoogleDeps = {},
): Promise<GoogleStartOutcome> {
  const google = googleClient(deps)
  if (google == null || !calendarLinkKey().ok) return { kind: 'disabled' }
  if ('linkToken' in from && !isCalendarConnectToken(from.linkToken)) return { kind: 'refused' }

  // Same shape as the connect token: 32 CSPRNG bytes base64url, stored as sha256 hex.
  const { token: state, tokenHash: stateHash } = generateCalendarConnectToken()
  const { data, error } = await client
    .rpc('begin_google_calendar_connect', {
      p_guide_id: 'guideId' in from ? from.guideId : undefined,
      p_link_token_hash: 'linkToken' in from ? hashCalendarConnectToken(from.linkToken) : undefined,
      p_state_hash: stateHash,
    })
    .single()
  if (error != null || data == null) throw new Error(`begin_google_calendar_connect failed: ${error?.message ?? 'no row'}`)
  if (data.refusal != null) return { kind: 'refused' }
  return { kind: 'redirect', url: googleAuthUrl(google, state), state }
}

export interface GoogleCallbackInput {
  state: string
  code?: string
  /** Google's `error` parameter, e.g. `access_denied` when the guide pressed Cancel. */
  error?: string
}

export interface FinishDeps extends GoogleDeps {
  now?: Date
  /** The guide signed in on this request (null if none) — a session start must finish as the same guide. */
  sessionGuideId: string | null
}

export async function finishGoogleConnect(client: Client, input: GoogleCallbackInput, deps: FinishDeps): Promise<GoogleFinishOutcome> {
  if (!isCalendarConnectToken(input.state)) return { kind: 'refused', entry: null }

  const { data: taken, error: takeError } = await client
    .rpc('take_google_calendar_state', { p_state_hash: hashCalendarConnectToken(input.state) })
    .single()
  if (takeError != null || taken == null) throw new Error(`take_google_calendar_state failed: ${takeError?.message ?? 'no row'}`)
  if (taken.refusal != null || taken.guide_id == null) return { kind: 'refused', entry: null }

  const entry: GoogleConnectEntry = taken.entry === 'session' ? 'session' : 'link'
  const guideId = taken.guide_id
  if (entry === 'session' && deps.sessionGuideId !== guideId) return { kind: 'refused', entry }

  if (input.error != null) return { kind: 'denied', entry }
  if (input.code == null) return { kind: 'refused', entry }

  const google = googleClient(deps)
  const key = calendarLinkKey()
  if (google == null || !key.ok) return { kind: 'disabled', entry }

  const exchanged = await exchangeGoogleCode(google, input.code, deps.http)
  if (!exchanged.ok) return { kind: 'failed', entry, error: exchanged.error }

  const { data: guide, error: guideError } = await client.from('guides').select('country').eq('id', guideId).maybeSingle()
  if (guideError != null) throw new Error(`guide read failed: ${guideError.message}`)

  const days = await googleBusyDays(exchanged.accessToken, guide?.country ?? null, deps.now ?? new Date(), deps.http)
  if (!days.ok) return { kind: 'failed', entry, error: days.error }

  const { data, error } = await client
    .rpc('connect_google_calendar', {
      p_guide_id: guideId,
      p_link_id: taken.link_id ?? undefined,
      p_ciphertext: encryptGoogleToken(exchanged.refreshToken, key.key),
      p_dates: days.dates,
    })
    .single()
  if (error != null || data == null) throw new Error(`connect_google_calendar failed: ${error?.message ?? 'no row'}`)
  if (data.refusal != null) return { kind: 'refused', entry }
  // Google replacing Google: the token is overwritten, never revoked — revoking would end the new
  // grant too, since Google revokes per account and project (tj STOP 3). Apple had nothing to revoke.
  return { kind: 'connected', entry, busyDays: data.busy_days ?? 0 }
}

export interface DisconnectResult {
  provider: 'apple_ics' | 'google' | null
  busyDaysRemoved: number
}

/**
 * The guide disconnects their own calendar: connection and calendar busy days deleted, manual blocks
 * kept, audit_log row (DISCONNECT). A Google grant is then revoked at Google, best effort.
 * The caller has checked that `guideId` is the signed-in guide's own (requireGuide()).
 */
export async function disconnectGuideCalendar(
  client: Client,
  guideId: string,
  actorUserId: string,
  deps: GoogleDeps = {},
): Promise<DisconnectResult> {
  const { data: current, error: readError } = await client
    .from('guide_calendar_connections')
    .select('provider, token_ciphertext')
    .eq('guide_id', guideId)
    .maybeSingle()
  if (readError != null) throw new Error(`calendar connection read failed: ${readError.message}`)

  const { data, error } = await client.rpc('disconnect_calendar', { p_guide_id: guideId, p_actor: actorUserId }).single()
  if (error != null || data == null) throw new Error(`disconnect_calendar failed: ${error?.message ?? 'no row'}`)

  if (data.provider === 'google' && current?.token_ciphertext != null) {
    await revokeStoredGoogleToken(guideId, current.token_ciphertext, deps)
  }
  const provider = data.provider === 'google' || data.provider === 'apple_ics' ? data.provider : null
  return { provider, busyDaysRemoved: data.busy_days_removed ?? 0 }
}
