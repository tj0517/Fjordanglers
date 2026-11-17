/**
 * FA-M.09 — calendar sync against the LOCAL database (src/tests/setup.ts aborts on anything else).
 * The calendar server is scripted (fixtures in ./fixtures); the database functions, constraints and
 * audit rows are real.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { connectWithLink, issueConnectLink, syncAllCalendars, CalendarSyncDisabledError } from '../connections'
import type { HopFn } from '../fetch'
import { encryptCalendarLink } from '../link-crypto'
import { TEST_CALENDAR_LINK_KEY } from './test-key'

type Db = SupabaseClient<Database>

const GUIDE = 'ca1e0000-0000-4000-8000-0000000000a1'
const ADMIN_UID = 'ca1e0000-0000-4000-8000-00000000ad01'
const LINK = 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-SYNC-SECRET'
const FETCHED = 'https://p00-caldav.icloud.example/published/2/SYNTHETIC-SYNC-SECRET'
const NOW = new Date('2026-12-15T12:00:00Z')          // horizon in Oslo: 2026-12-15 → 2027-12-14

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')
/** One calendar with every VEVENT of the named fixtures. */
function calendar(...names: string[]): string {
  const events = names.flatMap(n => fixture(n).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [])
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FjordAnglers//Synthetic//EN', ...events, 'END:VCALENDAR'].join('\n')
}
const withoutEvent = (ics: string, uid: string) =>
  ics.replace(new RegExp(`BEGIN:VEVENT\\nUID:${uid.replace(/[.@]/g, '\\$&')}[\\s\\S]*?END:VEVENT\\n?`, 'g'), '')

/** The calendar server: what FETCHED answers right now. */
let answer: { status: number; body?: string } | 'hang' = { status: 200, body: '' }
const hop: HopFn = async url => {
  if (url.toString() !== FETCHED) throw new Error('unexpected url')
  if (answer === 'hang') return new Promise(() => {})
  return { status: answer.status, location: null, body: Buffer.from(answer.body ?? '') }
}
// Test files run in parallel on one database: every sync here is limited to this file's guide.
const deps = { fetch: { hop, timeoutMs: 100 }, now: NOW, guideIds: [GUIDE] }

function svc(): Db {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function busy(source: 'manual' | 'calendar'): Promise<string[]> {
  const { data, error } = await svc().from('guide_unavailable_dates').select('date')
    .eq('guide_id', GUIDE).eq('source', source).order('date')
  if (error != null) throw new Error(error.message)
  return (data ?? []).map(r => r.date)
}

async function connection() {
  const { data } = await svc().from('guide_calendar_connections')
    .select('status, last_error, failure_count, last_synced_at, last_attempt_at, connected_at, link_host, link_ciphertext')
    .eq('guide_id', GUIDE).single()
  return data
}

async function audit(operation: string) {
  const { data } = await svc().from('audit_log').select('operation, new_data')
    .eq('table_name', 'guide_calendar_connections').eq('record_id', GUIDE).eq('operation', operation)
  return data ?? []
}

async function sweep() {
  const s = svc()
  const { data: links } = await s.from('guide_calendar_connect_links').select('id').eq('guide_id', GUIDE)
  const ids = (links ?? []).map(l => l.id)
  if (ids.length > 0) await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connect_links').in('record_id', ids)
  await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connections').eq('record_id', GUIDE)
  await s.from('guides').delete().eq('id', GUIDE)
}

/** Fresh guide, two manual blocks, calendar connected from `ics`. */
async function connected(ics: string) {
  await sweep()
  const ins = await svc().from('guides').insert({ id: GUIDE, full_name: 'Calendar Sync Test', country: 'Norway', is_beta_listing: true })
  if (ins.error != null) throw new Error(ins.error.message)
  await svc().from('guide_unavailable_dates').insert([
    { guide_id: GUIDE, date: '2027-01-05', source: 'manual' },    // also busy in the calendar
    { guide_id: GUIDE, date: '2027-04-01', source: 'manual' },
  ])
  const { token } = await issueConnectLink(svc(), GUIDE, ADMIN_UID)
  answer = { status: 200, body: ics }
  const outcome = await connectWithLink(svc(), token, LINK, deps)
  if (outcome.kind !== 'connected') throw new Error(`connect failed: ${JSON.stringify(outcome)}`)
}

const V1 = calendar('recurring.ics', 'all-day.ics')
const V1_DATES = [
  '2027-01-05', '2027-01-10', '2027-01-12', '2027-01-27',
  '2027-02-01', '2027-02-02', '2027-02-03',                  // multi-day all-day event
  '2027-02-09', '2027-02-20',
  '2027-03-01', '2027-03-02', '2027-03-03',                  // daily recurring all-day
  '2027-06-07',                                              // yearly since 2015
]

const savedKey = process.env.CALENDAR_LINK_KEY
beforeAll(() => { process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY })
afterAll(async () => {
  await sweep()
  if (savedKey == null) delete process.env.CALENDAR_LINK_KEY
  else process.env.CALENDAR_LINK_KEY = savedKey
})
beforeEach(async () => { await connected(V1) })

describe('sync from fixtures', () => {
  it('connect writes the busy days of the trial fetch — recurring and multi-day included', async () => {
    expect(await busy('calendar')).toEqual(V1_DATES)
  })

  it('a scheduled sync of the same calendar gives the same list of dates', async () => {
    const summary = await syncAllCalendars(svc(), deps)
    expect(summary.failures.filter(f => f.guideId === GUIDE)).toEqual([])
    expect(await busy('calendar')).toEqual(V1_DATES)
    expect((await connection())?.status).toBe('ok')
  })
})

describe('manual blocks and deleted events', () => {
  it('a manual block survives a sync, also on a day the calendar marks busy', async () => {
    await syncAllCalendars(svc(), deps)
    expect(await busy('manual')).toEqual(['2027-01-05', '2027-04-01'])
  })

  it('an event deleted from the calendar disappears from busy days at the next sync', async () => {
    answer = { status: 200, body: withoutEvent(V1, 'daily-allday@fixture.test') }
    await syncAllCalendars(svc(), deps)
    const after = await busy('calendar')
    expect(after).not.toContain('2027-03-01')
    expect(after).toEqual(V1_DATES.filter(d => !d.startsWith('2027-03-0')))
    expect(await busy('manual')).toEqual(['2027-01-05', '2027-04-01'])
  })
})

describe('RED: a failed fetch removes nothing and records the error', () => {
  for (const [label, failure, code] of [
    ['404', { status: 404 }, 'not_found'],
    ['timeout', 'hang', 'timeout'],
    ['an HTML page instead of a calendar', { status: 200, body: '<html>Sign in</html>' }, 'not_a_calendar'],
  ] as const) {
    it(`${label} → status error (${code}), calendar and manual days intact`, async () => {
      const before = await connection()
      answer = failure
      await syncAllCalendars(svc(), deps)
      expect(await busy('calendar')).toEqual(V1_DATES)
      expect(await busy('manual')).toEqual(['2027-01-05', '2027-04-01'])
      const after = await connection()
      expect(after?.status).toBe('error')
      expect(after?.last_error).toBe(code)
      expect(after?.failure_count).toBe(1)
      expect(after?.last_synced_at).toBe(before?.last_synced_at)   // last good sync kept
    })
  }

  it('audit: one SYNC_FAILED on the flip, none on a repeat, SYNC_RECOVERED on success — no link in payloads', async () => {
    answer = { status: 404 }
    await syncAllCalendars(svc(), deps)
    await syncAllCalendars(svc(), deps)
    expect((await connection())?.failure_count).toBe(2)
    expect(await audit('SYNC_FAILED')).toHaveLength(1)
    answer = { status: 200, body: V1 }
    await syncAllCalendars(svc(), deps)
    expect((await connection())?.status).toBe('ok')
    const recovered = await audit('SYNC_RECOVERED')
    expect(recovered).toHaveLength(1)
    const payloads = JSON.stringify([...(await audit('SYNC_FAILED')), ...recovered, ...(await audit('CONNECT'))])
    expect(payloads).not.toContain('SYNTHETIC-SYNC-SECRET')
    expect(payloads).toContain('p00-caldav.icloud.example')       // host only
  })
})

describe('the stored link', () => {
  it('is ciphertext only — no part of the link in the row', async () => {
    const row = await connection()
    expect(row?.link_ciphertext).toMatch(/^v1:/)
    expect(row?.link_ciphertext).not.toContain('SYNTHETIC')
    expect(row?.link_host).toBe('p00-caldav.icloud.example')
  })

  it('RED: a link encrypted with another key → decrypt_failed, days intact', async () => {
    const other = encryptCalendarLink(FETCHED, Buffer.alloc(32, 9))
    await svc().from('guide_calendar_connections').update({ link_ciphertext: other }).eq('guide_id', GUIDE)
    await syncAllCalendars(svc(), deps)
    expect((await connection())?.last_error).toBe('decrypt_failed')
    expect(await busy('calendar')).toEqual(V1_DATES)
  })
})

describe('races and configuration', () => {
  it('a result for a link replaced mid-sync is dropped (stale)', async () => {
    const { data } = await svc().rpc('record_calendar_sync', {
      p_guide_id: GUIDE, p_connected_at: '2000-01-01T00:00:00Z', p_dates: ['2027-09-09'],
    })
    expect(data).toBe('stale')
    expect(await busy('calendar')).toEqual(V1_DATES)
  })

  it('RED: no CALENDAR_LINK_KEY → sync refuses before reading anything, nothing written', async () => {
    const before = await connection()
    process.env.CALENDAR_LINK_KEY = ''
    try {
      answer = { status: 200, body: calendar('free.ics') }
      await expect(syncAllCalendars(svc(), deps)).rejects.toBeInstanceOf(CalendarSyncDisabledError)
    } finally {
      process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
    }
    expect(await connection()).toEqual(before)
    expect(await busy('calendar')).toEqual(V1_DATES)
  })

  it('RED: the database refuses nulls and more than 400 days', async () => {
    const tooMany = Array.from({ length: 401 }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))
    const { error } = await svc().rpc('replace_calendar_busy_days', { p_guide_id: GUIDE, p_dates: tooMany })
    expect(error?.message).toMatch(/too many busy days/)
    expect(await busy('calendar')).toEqual(V1_DATES)
  })
})
