/**
 * Google Calendar over plain HTTPS (FA-M.10; no SDK — tj STOP 1, 2026-11-18). Server-only: it handles
 * the OAuth client secret and refresh tokens. Never import from a client component.
 *
 * Every call goes through one `GoogleHttp` function, so tests script Google and nothing real is ever
 * called from tests or CI. Results are values, not exceptions: a code from `GoogleError`. Tokens,
 * authorisation codes and calendar contents never reach a log, an error or a return value other than
 * the one that hands the token to its caller.
 */

import { z } from 'zod'
import { env } from '@/lib/env'
import { busyDaysFromGoogleEvents, googleWindow, type GoogleEvent } from './google-events'

/** The narrowest scope that gives all-day events with their busy/free flag (tj STOP 1, option B). */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.freebusy'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/**
 * The only things FA asks Google for (tj STOP 1): per event start, end (date = all-day, or dateTime)
 * and busy/free (transparency); for the calendar its time zone (FA-M.09 D3 zone fallback). Never
 * titles, descriptions, attendees or locations.
 */
export const GOOGLE_EVENT_FIELDS = 'nextPageToken,timeZone,items(start(date,dateTime),end(date,dateTime),transparency)'

/** Where Google sends the guide back. Registered in Google Cloud for localhost:3000 and www (tj). */
export const GOOGLE_CALLBACK_PATH = '/api/calendar/google/callback'

const TIMEOUT_MS = 10_000
const PAGE_SIZE = 2500
const MAX_PAGES = 8

export type GoogleError = 'invalid_grant' | 'insufficient_scope' | 'http_error' | 'timeout' | 'network' | 'bad_response'

export type GoogleHttp = (url: string, init: RequestInit) => Promise<Response>

export interface GoogleClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

const defaultHttp: GoogleHttp = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' })

/** The redirect URI, from the configured app URL — never from a request header. */
export function googleRedirectUri(appUrl: string = env.NEXT_PUBLIC_APP_URL): string {
  return new URL(GOOGLE_CALLBACK_PATH, appUrl).toString()
}

/**
 * The OAuth client from the environment, or null when it is not set (the Google button then says
 * "unavailable" and the Apple path is unaffected).
 *
 * PENDING tj: the names of the client id / secret variables (asked at STOP 1 and STOP 3; the answers
 * still carried the `<NAME>` placeholder). Until they are given this returns null.
 */
export function googleClientFromEnv(): GoogleClientConfig | null {
  return null
}

type Fetched = { ok: true; status: number; json: unknown } | { ok: false; error: GoogleError }

async function call(http: GoogleHttp, url: string, init: RequestInit): Promise<Fetched> {
  let res: Response
  try {
    res = await http(url, init)
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    return { ok: false, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' }
  }
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { ok: true, status: res.status, json }
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  }
}

const tokenErrorSchema = z.object({ error: z.string() })

function tokenError(status: number, json: unknown): GoogleError {
  const parsed = tokenErrorSchema.safeParse(json)
  if (status === 400 && parsed.success && parsed.data.error === 'invalid_grant') return 'invalid_grant'
  return 'http_error'
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

/** Google's consent page. `prompt=consent` so Google always returns a refresh token. */
export function googleAuthUrl(client: GoogleClientConfig, state: string): string {
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString()
  return url.toString()
}

const exchangeSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string(),
})

export type ExchangeResult = { ok: true; refreshToken: string; accessToken: string } | { ok: false; error: GoogleError }

/** Code → tokens. Refuses when the guide unticked the calendar permission (granular consent). */
export async function exchangeGoogleCode(client: GoogleClientConfig, code: string, http: GoogleHttp = defaultHttp): Promise<ExchangeResult> {
  const r = await call(http, TOKEN_URL, form({
    grant_type: 'authorization_code',
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: client.redirectUri,
  }))
  if (!r.ok) return r
  if (r.status !== 200) return { ok: false, error: tokenError(r.status, r.json) }
  const parsed = exchangeSchema.safeParse(r.json)
  if (!parsed.success) return { ok: false, error: 'bad_response' }
  if (!parsed.data.scope.split(' ').includes(GOOGLE_CALENDAR_SCOPE)) return { ok: false, error: 'insufficient_scope' }
  if (parsed.data.refresh_token == null) return { ok: false, error: 'bad_response' }
  return { ok: true, refreshToken: parsed.data.refresh_token, accessToken: parsed.data.access_token }
}

const refreshSchema = z.object({ access_token: z.string().min(1) })

/** Refresh token → access token. `invalid_grant` = consent revoked or token expired. */
export async function refreshGoogleAccess(
  client: GoogleClientConfig,
  refreshToken: string,
  http: GoogleHttp = defaultHttp,
): Promise<{ ok: true; accessToken: string } | { ok: false; error: GoogleError }> {
  const r = await call(http, TOKEN_URL, form({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
  }))
  if (!r.ok) return r
  if (r.status !== 200) return { ok: false, error: tokenError(r.status, r.json) }
  const parsed = refreshSchema.safeParse(r.json)
  return parsed.success ? { ok: true, accessToken: parsed.data.access_token } : { ok: false, error: 'bad_response' }
}

/**
 * Revokes the guide's grant at Google (FA-M.10 decision 4). Google revokes the whole grant for the
 * account and project, so this is called on disconnect and when Apple replaces Google — never when
 * Google replaces Google (tj STOP 3). Best effort: false on any failure.
 */
export async function revokeGoogleToken(token: string, http: GoogleHttp = defaultHttp): Promise<boolean> {
  const r = await call(http, REVOKE_URL, form({ token }))
  return r.ok && r.status === 200
}

// ─── events ─────────────────────────────────────────────────────────────────

const timeSchema = z.object({ date: z.string().optional(), dateTime: z.string().optional() })
const eventsPageSchema = z.object({
  nextPageToken: z.string().optional(),
  timeZone: z.string().optional(),
  items: z.array(z.object({
    start: timeSchema.optional(),
    end: timeSchema.optional(),
    transparency: z.string().optional(),
  })).optional(),
})

/** The guide's primary calendar between two instants, recurring events expanded. */
export async function listGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  http: GoogleHttp = defaultHttp,
): Promise<{ ok: true; events: GoogleEvent[]; timeZone: string | null } | { ok: false; error: GoogleError }> {
  const events: GoogleEvent[] = []
  let timeZone: string | null = null
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(EVENTS_URL)
    url.search = new URLSearchParams({
      singleEvents: 'true',
      timeMin,
      timeMax,
      maxResults: String(PAGE_SIZE),
      fields: GOOGLE_EVENT_FIELDS,
      ...(pageToken != null ? { pageToken } : {}),
    }).toString()
    const r = await call(http, url.toString(), { method: 'GET', headers: { authorization: `Bearer ${accessToken}` } })
    if (!r.ok) return r
    if (r.status === 403) return { ok: false, error: 'insufficient_scope' }
    if (r.status !== 200) return { ok: false, error: 'http_error' }
    const parsed = eventsPageSchema.safeParse(r.json)
    if (!parsed.success) return { ok: false, error: 'bad_response' }
    events.push(...(parsed.data.items ?? []))
    timeZone ??= parsed.data.timeZone ?? null
    pageToken = parsed.data.nextPageToken
    if (pageToken == null) break
  }
  return { ok: true, events, timeZone }
}

/** Access token → the guide's busy days for the 12-month horizon. */
export async function googleBusyDays(
  accessToken: string,
  guideCountry: string | null,
  now: Date,
  http: GoogleHttp = defaultHttp,
): Promise<{ ok: true; dates: string[] } | { ok: false; error: GoogleError }> {
  // The window is computed from the guide's country first; Google's own zone is known only after the
  // first page, and a zone difference is covered by the window's day of slack on each side.
  const window = googleWindow(guideCountry, null, now)
  const listed = await listGoogleEvents(accessToken, window.timeMin, window.timeMax, http)
  if (!listed.ok) return listed
  const { dates } = busyDaysFromGoogleEvents({ events: listed.events, guideCountry, calendarZone: listed.timeZone, now })
  return { ok: true, dates }
}
