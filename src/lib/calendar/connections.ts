/**
 * Calendar connections — the data layer of FA-M.09. Every write goes through the database
 * functions of `20261120000000_add_guide_calendar_sync.sql` (service_role only), each of which
 * writes its audit_log row in the same transaction (tj D4 a).
 *
 * Who may call what:
 *   * `issueConnectLink` — after requireAdmin() (src/actions/calendar.ts);
 *   * `connectLinkRefusal`, `connectWithLink` — the token is the credential; the database checks it
 *     (hash, revoked, used, expired) in the same call that writes;
 *   * `syncAllCalendars` — the cron route, after CRON_SECRET;
 *   * readers — admin (after requireAdmin) and the guide's own availability actions (requireGuide).
 *
 * The calendar link is a secret: it is decrypted only inside `syncOne` / validated inside
 * `connectWithLink`, and never logged, returned or put into an error.
 *
 * FA-M.10: a connection is an Apple link (`apple_ics`) or a Google account (`google`, encrypted
 * refresh token). The sync handles both; Google refusing the token (`invalid_grant`) marks the row
 * 'disconnected' and the cron stops reading it. Connecting Apple over Google revokes the Google
 * grant (best effort, tj STOP 3). The Google connect / disconnect flows live in ./google-connect.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { generateCalendarConnectToken, hashCalendarConnectToken, isCalendarConnectToken } from './connect-token'
import { calendarLinkHost, fetchCalendar, normalizeCalendarLink, type CalendarFetchError, type FetchOptions } from './fetch'
import { busyDaysFromIcs, NotACalendarError } from './ics'
import { googleBusyDays, googleClientFromEnv, refreshGoogleAccess, revokeGoogleToken, type GoogleClientConfig, type GoogleError, type GoogleHttp } from './google'
import { calendarLinkKey, decryptCalendarLink, decryptGoogleToken, encryptCalendarLink } from './link-crypto'

type Client = SupabaseClient<Database>

/** Error codes stored on a connection (CHECK in the migration). */
type SyncErrorCode = Exclude<CalendarFetchError, 'invalid_url'> | 'not_a_calendar' | 'decrypt_failed' | GoogleError

export type ConnectLinkRefusal = 'not_found' | 'revoked' | 'used' | 'expired'

const REFUSALS: readonly ConnectLinkRefusal[] = ['not_found', 'revoked', 'used', 'expired']

function asRefusal(value: unknown): ConnectLinkRefusal | null {
  return REFUSALS.find(r => r === value) ?? null
}

// ─── signed link ─────────────────────────────────────────────────────────────

export interface IssuedConnectLink {
  /** Goes into `/connect-calendar/<token>`. Shown once, never stored or logged. */
  token: string
  expiresAt: string
}

export async function issueConnectLink(client: Client, guideId: string, adminId: string): Promise<IssuedConnectLink> {
  const { token, tokenHash } = generateCalendarConnectToken()
  const { data, error } = await client
    .rpc('issue_calendar_connect_link', { p_guide_id: guideId, p_token_hash: tokenHash, p_admin_id: adminId })
    .single()
  if (error != null || data == null) throw new Error(`issue_calendar_connect_link failed: ${error?.message ?? 'no row'}`)
  return { token, expiresAt: data.expires_at }
}

/** Why the link cannot be used, or null when it can. A malformed token is `not_found`. */
export async function connectLinkRefusal(client: Client, token: string): Promise<ConnectLinkRefusal | null> {
  if (!isCalendarConnectToken(token)) return 'not_found'
  const { data, error } = await client.rpc('calendar_connect_link_refusal', { p_token_hash: hashCalendarConnectToken(token) })
  if (error != null) throw new Error(`calendar_connect_link_refusal failed: ${error.message}`)
  return data == null ? null : (asRefusal(data) ?? 'not_found')
}

// ─── connect ─────────────────────────────────────────────────────────────────

export type ConnectOutcome =
  | { kind: 'connected'; busyDays: number }
  | { kind: 'refused'; reason: ConnectLinkRefusal }
  | { kind: 'invalid_link' }
  | { kind: 'fetch_failed'; error: CalendarFetchError }
  | { kind: 'not_a_calendar' }
  | { kind: 'disabled' }

/** How FA reaches Google; tests script it. `client` undefined → from the environment. */
export interface GoogleDeps {
  client?: GoogleClientConfig | null
  http?: GoogleHttp
}

export interface ConnectDeps {
  fetch?: FetchOptions
  now?: Date
  google?: GoogleDeps
}

/**
 * Best-effort revoke of a Google grant whose ciphertext the caller read before replacing or deleting
 * the connection. A failure is logged with the guide id only and never blocks the caller (tj STOP 1, 4).
 */
export async function revokeStoredGoogleToken(guideId: string, ciphertext: string | null, deps: GoogleDeps = {}): Promise<boolean> {
  const key = calendarLinkKey()
  const token = key.ok && ciphertext != null ? decryptGoogleToken(ciphertext, key.key) : null
  const ok = token != null && await revokeGoogleToken(token, deps.http)
  if (!ok) console.error('[calendar] google revoke failed for guide', guideId)
  return ok
}

/** Apple: validate the pasted link, fetch it once, store it encrypted with the busy days found. */
export async function connectWithLink(
  client: Client,
  token: string,
  rawLink: unknown,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  const key = calendarLinkKey()
  if (!key.ok) return { kind: 'disabled' }

  const refusal = await connectLinkRefusal(client, token)
  if (refusal != null) return { kind: 'refused', reason: refusal }

  const url = normalizeCalendarLink(rawLink)
  if (url == null) return { kind: 'invalid_link' }

  const tokenHash = hashCalendarConnectToken(token)
  const { data: link, error: linkError } = await client
    .from('guide_calendar_connect_links')
    .select('guide_id, guides(country)')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (linkError != null) throw new Error(`connect link read failed: ${linkError.message}`)
  if (link == null) return { kind: 'refused', reason: 'not_found' }

  const fetched = await fetchCalendar(url.toString(), deps.fetch)
  if (!fetched.ok) return { kind: 'fetch_failed', error: fetched.error }

  // One calendar per guide (D5): if this replaces a Google connection, its grant is revoked afterwards.
  const { data: previous, error: previousError } = await client
    .from('guide_calendar_connections')
    .select('provider, token_ciphertext')
    .eq('guide_id', link.guide_id)
    .maybeSingle()
  if (previousError != null) throw new Error(`calendar connection read failed: ${previousError.message}`)

  let dates: string[]
  try {
    dates = busyDaysForCalendar(fetched.body, link.guides?.country ?? null, deps.now ?? new Date())
  } catch (e) {
    if (e instanceof NotACalendarError) return { kind: 'not_a_calendar' }
    throw e
  }

  const { data, error } = await client
    .rpc('connect_calendar_with_link', {
      p_token_hash: tokenHash,
      p_provider: 'apple_ics',
      p_ciphertext: encryptCalendarLink(url.toString(), key.key),
      p_host: calendarLinkHost(url),
      p_dates: dates,
    })
    .single()
  if (error != null || data == null) throw new Error(`connect_calendar_with_link failed: ${error?.message ?? 'no row'}`)
  const lateRefusal = asRefusal(data.refusal)
  if (lateRefusal != null) return { kind: 'refused', reason: lateRefusal }
  if (previous?.provider === 'google') await revokeStoredGoogleToken(link.guide_id, previous.token_ciphertext, deps.google)
  return { kind: 'connected', busyDays: data.busy_days ?? 0 }
}

/** Busy days of one calendar body for a guide, 12 months from today in their zone. Throws NotACalendarError. */
function busyDaysForCalendar(ics: string, country: string | null, now: Date): string[] {
  return busyDaysFromIcs({ ics, guideCountry: country, now }).dates
}

// ─── sync ────────────────────────────────────────────────────────────────────

type SyncResult = 'ok' | 'failed' | 'stale' | 'no_connection' | 'disconnected'

export interface SyncSummary {
  total: number
  ok: number
  failed: number
  stale: number
  /** Google refused the token this run (`invalid_grant`) → the row is now 'disconnected'. */
  disconnected: number
  /** Google rows not read because the Google OAuth client is not configured. */
  skipped: number
  /** Error code per failure, for the cron log. Guide ids only — never a link. */
  failures: { guideId: string; error: SyncErrorCode }[]
}

export interface SyncDeps extends ConnectDeps {
  concurrency?: number
  /** Sync only these guides (default: every connected calendar). */
  guideIds?: string[]
}

export class CalendarSyncDisabledError extends Error {
  constructor() {
    super('calendar sync disabled: CALENDAR_LINK_KEY missing or malformed')
    this.name = 'CalendarSyncDisabledError'
  }
}

interface ConnectionRow {
  guide_id: string
  provider: string
  link_ciphertext: string | null
  token_ciphertext: string | null
  connected_at: string
  guides: { country: string | null } | null
}

async function recordSync(
  client: Client,
  row: ConnectionRow,
  outcome: { dates: string[] } | { error: SyncErrorCode },
): Promise<SyncResult> {
  const { data, error } = await client.rpc('record_calendar_sync', {
    p_guide_id: row.guide_id,
    p_connected_at: row.connected_at,
    p_dates: 'dates' in outcome ? outcome.dates : [],
    // Omitted on success: the function's p_error defaults to NULL.
    ...('error' in outcome ? { p_error: outcome.error } : {}),
  })
  if (error != null) throw new Error(`record_calendar_sync failed: ${error.message}`)
  return (['ok', 'failed', 'stale', 'no_connection', 'disconnected'] as const).find(r => r === data) ?? 'failed'
}

async function syncGoogle(
  client: Client,
  row: ConnectionRow,
  key: Buffer,
  google: GoogleClientConfig,
  deps: SyncDeps,
): Promise<{ result: SyncResult; error?: SyncErrorCode }> {
  const fail = async (code: SyncErrorCode) => ({ result: await recordSync(client, row, { error: code }), error: code })
  const refreshToken = row.token_ciphertext != null ? decryptGoogleToken(row.token_ciphertext, key) : null
  if (refreshToken == null) return fail('decrypt_failed')
  const access = await refreshGoogleAccess(google, refreshToken, deps.google?.http)
  if (!access.ok) return fail(access.error)
  const days = await googleBusyDays(access.accessToken, row.guides?.country ?? null, deps.now ?? new Date(), deps.google?.http)
  if (!days.ok) return fail(days.error)
  return { result: await recordSync(client, row, { dates: days.dates }) }
}

async function syncOne(client: Client, row: ConnectionRow, key: Buffer, deps: SyncDeps): Promise<{ result: SyncResult; error?: SyncErrorCode }> {
  const link = row.link_ciphertext != null ? decryptCalendarLink(row.link_ciphertext, key) : null
  if (link == null) return { result: await recordSync(client, row, { error: 'decrypt_failed' }), error: 'decrypt_failed' }

  const fetched = await fetchCalendar(link, deps.fetch)
  if (!fetched.ok) {
    // A stored link was valid when connected; if it no longer parses as one, treat it as refused.
    const code: SyncErrorCode = fetched.error === 'invalid_url' ? 'blocked_address' : fetched.error
    return { result: await recordSync(client, row, { error: code }), error: code }
  }

  try {
    const dates = busyDaysForCalendar(fetched.body, row.guides?.country ?? null, deps.now ?? new Date())
    return { result: await recordSync(client, row, { dates }) }
  } catch (e) {
    if (!(e instanceof NotACalendarError)) throw e
    return { result: await recordSync(client, row, { error: 'not_a_calendar' }), error: 'not_a_calendar' }
  }
}

/** One pass over every connected calendar. A failure of one guide never stops the others. */
export async function syncAllCalendars(client: Client, deps: SyncDeps = {}): Promise<SyncSummary> {
  const key = calendarLinkKey()
  if (!key.ok) throw new CalendarSyncDisabledError()

  let query = client
    .from('guide_calendar_connections')
    .select('guide_id, provider, link_ciphertext, token_ciphertext, connected_at, guides(country)')
    .neq('status', 'disconnected')
    .order('last_attempt_at', { ascending: true, nullsFirst: true })
  if (deps.guideIds != null) query = query.in('guide_id', deps.guideIds)
  const { data, error } = await query
  if (error != null) throw new Error(`calendar connections read failed: ${error.message}`)

  const rows: ConnectionRow[] = data ?? []
  const google = deps.google?.client !== undefined ? deps.google.client : googleClientFromEnv()
  const summary: SyncSummary = { total: rows.length, ok: 0, failed: 0, stale: 0, disconnected: 0, skipped: 0, failures: [] }
  const queue = [...rows]
  const worker = async () => {
    for (let row = queue.shift(); row != null; row = queue.shift()) {
      if (row.provider === 'google' && google == null) {
        summary.skipped++
        continue
      }
      let outcome: { result: SyncResult; error?: SyncErrorCode }
      try {
        outcome = row.provider === 'google' && google != null
          ? await syncGoogle(client, row, key.key, google, deps)
          : await syncOne(client, row, key.key, deps)
      } catch (e) {
        console.error('[calendar-sync] guide', row.guide_id, 'failed:', e instanceof Error ? e.message : 'unknown error')
        summary.failed++
        continue
      }
      if (outcome.result === 'ok') summary.ok++
      else if (outcome.result === 'stale' || outcome.result === 'no_connection') summary.stale++
      else if (outcome.result === 'disconnected') summary.disconnected++
      else {
        summary.failed++
        if (outcome.error != null) summary.failures.push({ guideId: row.guide_id, error: outcome.error })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, deps.concurrency ?? 4) }, worker))
  return summary
}

// ─── readers ─────────────────────────────────────────────────────────────────

type BusySource = 'manual' | 'calendar'

export interface BusyDay {
  date: string
  sources: BusySource[]
}

export interface CalendarStatus {
  provider: 'apple_ics' | 'google'
  host: string
  /** 'disconnected': Google refused the token (consent revoked); busy days stay until the guide disconnects. */
  status: 'ok' | 'error' | 'disconnected'
  lastSyncedAt: string | null
  lastError: string | null
}

/** Busy days per guide between `from` and `to`, each date once with every source that blocks it. */
export async function busyDaysByGuide(
  client: Client,
  guideIds: string[],
  from: string,
  to: string,
): Promise<Map<string, BusyDay[]>> {
  const out = new Map<string, BusyDay[]>()
  if (guideIds.length === 0) return out
  const { data, error } = await client
    .from('guide_unavailable_dates')
    .select('guide_id, date, source')
    .in('guide_id', guideIds)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  if (error != null) throw new Error(`busy days read failed: ${error.message}`)
  for (const row of data ?? []) {
    const days = out.get(row.guide_id) ?? []
    const last = days[days.length - 1]
    const source: BusySource = row.source === 'calendar' ? 'calendar' : 'manual'
    if (last != null && last.date === row.date) {
      if (!last.sources.includes(source)) last.sources.push(source)
    } else {
      days.push({ date: row.date, sources: [source] })
    }
    out.set(row.guide_id, days)
  }
  return out
}

/** Calendar connection status per guide (admin). Host only — never the link. */
export async function calendarStatusByGuide(client: Client, guideIds: string[]): Promise<Map<string, CalendarStatus>> {
  const out = new Map<string, CalendarStatus>()
  if (guideIds.length === 0) return out
  const { data, error } = await client
    .from('guide_calendar_connections')
    .select('guide_id, provider, link_host, status, last_synced_at, last_error')
    .in('guide_id', guideIds)
  if (error != null) throw new Error(`calendar status read failed: ${error.message}`)
  for (const row of data ?? []) {
    out.set(row.guide_id, {
      provider: row.provider === 'google' ? 'google' : 'apple_ics',
      host: row.link_host,
      status: row.status === 'error' || row.status === 'disconnected' ? row.status : 'ok',
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
    })
  }
  return out
}
