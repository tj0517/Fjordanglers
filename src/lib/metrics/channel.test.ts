/**
 * FA-1.87 — the `inquiry_acquisition_channel` view against the local Supabase stack.
 * Env and safety fuse: src/tests/setup.ts (local URL only).
 *
 *   rules    — every rule of the view (tj decisions 2026-11-12), one synthetic inquiry per case
 *   parity   — the view's `ads` agrees with isPaidAttributed (src/lib/metrics/weekly.ts) on the
 *              same (gclid, utm) cases, including the trim/case/non-string edges
 *   guards   — the two CHECK constraints refuse a malformed host / path (23514)
 *   access   — anon cannot read the view (42501)
 *
 * Every inquiry is inserted here under fixed ids and deleted in afterAll; seed rows are untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import { isPaidAttributed } from './weekly'

type InquiryInsert = Database['public']['Tables']['inquiries']['Insert']

const svc = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)
const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const TOUCHED = '2026-11-01T10:00:00+00:00'
const id = (n: number): string => `f1870000-0000-4000-8000-${String(n).padStart(12, '0')}`

type Case = { name: string; row: Partial<InquiryInsert>; channel: string | null }

const RULES: Case[] = [
  // ads — first, wins over any referrer
  { name: 'gclid only',                          row: { gclid: 'Cj0KCQ' },                                                  channel: 'ads' },
  { name: 'gclid + google referrer → not organic', row: { gclid: 'Cj0KCQ', first_referrer_host: 'www.google.com', first_touch_at: TOUCHED }, channel: 'ads' },
  { name: 'utm cpc + instagram referrer',        row: { utm: { utm_medium: 'cpc' }, first_referrer_host: 'l.instagram.com', first_touch_at: TOUCHED }, channel: 'ads' },
  { name: 'utm " Paid "',                        row: { utm: { utm_medium: ' Paid ' } },                                    channel: 'ads' },
  // organic — the search engines tj listed
  ...['www.google.com', 'google.co.uk', 'www.google.com.au', 'www.bing.com', 'cn.bing.com', 'duckduckgo.com',
      'search.yahoo.com', 'yahoo.co.jp', 'www.ecosia.org', 'www.baidu.com'].map((h): Case => (
    { name: `referrer ${h}`, row: { first_referrer_host: h, first_touch_at: TOUCHED, landing_path: '/norway' }, channel: 'organic' })),
  { name: 'google referrer + utm social → organic (rule order)', row: { first_referrer_host: 'www.google.com', utm: { utm_source: 'ig', utm_medium: 'social' }, first_touch_at: TOUCHED }, channel: 'organic' },
  // look-alikes are not search engines
  { name: 'notgoogle.com',                       row: { first_referrer_host: 'notgoogle.com', first_touch_at: TOUCHED },     channel: 'referral' },
  { name: 'google.evil.example',                 row: { first_referrer_host: 'google.evil.example', first_touch_at: TOUCHED }, channel: 'referral' },
  // social
  { name: 'l.instagram.com',                     row: { first_referrer_host: 'l.instagram.com', first_touch_at: TOUCHED },   channel: 'social' },
  { name: 'm.facebook.com',                      row: { first_referrer_host: 'm.facebook.com', first_touch_at: TOUCHED },    channel: 'social' },
  { name: 'utm ig/social, no referrer',          row: { utm: { utm_source: 'ig', utm_medium: 'social' }, first_touch_at: TOUCHED }, channel: 'social' },
  // direct vs unknown
  { name: 'first touch, no referrer, no utm',    row: { first_touch_at: TOUCHED, landing_path: '/' },                        channel: 'direct' },
  { name: 'nothing at all',                      row: {},                                                                     channel: 'unknown' },
  { name: 'utm: {} and no first touch',          row: { utm: {} },                                                            channel: 'unknown' },
  // referral
  { name: 'other referrer',                      row: { first_referrer_host: 'www.fishingforum.example', first_touch_at: TOUCHED }, channel: 'referral' },
  { name: 'utm newsletter, no referrer',         row: { utm: { utm_source: 'newsletter', utm_medium: 'email' } },             channel: 'referral' },
  // not a web form → no channel
  { name: 'source manual',                       row: { source: 'manual', gclid: 'Cj0KCQ' },                                  channel: null },
  { name: 'source null',                         row: { source: null },                                                       channel: null },
]

/** (gclid, utm) pairs: the view's `ads` must equal isPaidAttributed on each. */
const PARITY: { gclid: string | null; utm: Json | null }[] = [
  { gclid: null, utm: null },
  { gclid: 'Cj0KCQ', utm: null },
  { gclid: '', utm: null },
  { gclid: '   ', utm: null },
  { gclid: '\t\n', utm: null },
  { gclid: null, utm: { utm_medium: 'cpc' } },
  { gclid: null, utm: { utm_medium: 'CPC' } },
  { gclid: null, utm: { utm_medium: ' paid ' } },
  { gclid: null, utm: { utm_medium: '\tcpc\n' } },
  { gclid: null, utm: { utm_medium: 'ppc' } },
  { gclid: null, utm: { utm_medium: 'social' } },
  { gclid: null, utm: { utm_medium: 'cpc-test' } },
  { gclid: null, utm: { utm_medium: '' } },
  { gclid: null, utm: { utm_medium: 5 } },
  { gclid: null, utm: { utm_medium: ['cpc'] } },
  { gclid: null, utm: { utm_medium: null } },
  { gclid: null, utm: { utm_source: 'google' } },
  { gclid: null, utm: ['cpc'] },
  { gclid: null, utm: 'cpc' },
  { gclid: null, utm: {} },
  { gclid: 'Cj0KCQ', utm: { utm_medium: 'social' } },
]

const RULE_BASE = 1
const PARITY_BASE = 500
const ALL_IDS = [...RULES.map((_, i) => id(RULE_BASE + i)), ...PARITY.map((_, i) => id(PARITY_BASE + i)), id(999)]

function base(n: number): InquiryInsert {
  return { id: id(n), angler_name: 'FA-1.87 test', angler_email: 'fa187@test.invalid', party_size: 1, source: 'web_form' }
}

async function cleanup(): Promise<void> {
  const { error } = await svc.from('inquiries').delete().in('id', ALL_IDS)
  if (error != null) throw new Error(`cleanup: ${error.message}`)
}

async function channels(ids: string[]): Promise<Map<string, string | null>> {
  const { data, error } = await svc.from('inquiry_acquisition_channel').select('inquiry_id, channel').in('inquiry_id', ids)
  if (error != null) throw new Error(error.message)
  return new Map(data.map(r => [r.inquiry_id ?? '', r.channel]))
}

beforeAll(async () => {
  await cleanup()
  const rows: InquiryInsert[] = [
    ...RULES.map((c, i) => ({ ...base(RULE_BASE + i), ...c.row })),
    ...PARITY.map((p, i) => ({ ...base(PARITY_BASE + i), gclid: p.gclid, utm: p.utm })),
  ]
  const { error } = await svc.from('inquiries').insert(rows)
  if (error != null) throw new Error(`insert: ${error.message}`)
})

afterAll(cleanup)

describe('inquiry_acquisition_channel — channel rules', () => {
  it.each(RULES.map((c, i) => [c.name, i] as const))('%s', async (_name, i) => {
    const got = (await channels([id(RULE_BASE + i)])).get(id(RULE_BASE + i))
    expect(got).toBe(RULES[i].channel)
  })
})

describe('inquiry_acquisition_channel — ads parity with isPaidAttributed', () => {
  it('the view says ads exactly when isPaidAttributed says paid, on every case', async () => {
    const got = await channels(PARITY.map((_, i) => id(PARITY_BASE + i)))
    const mismatches = PARITY
      .map((p, i) => ({ ...p, view: got.get(id(PARITY_BASE + i)) === 'ads', ts: isPaidAttributed(p) }))
      .filter(r => r.view !== r.ts)
    expect(mismatches).toEqual([])
    // the set is not trivially one-sided
    expect(PARITY.filter(p => isPaidAttributed(p)).length).toBeGreaterThanOrEqual(5)
    expect(PARITY.filter(p => !isPaidAttributed(p)).length).toBeGreaterThanOrEqual(5)
  })
})

describe('inquiries first-touch CHECK constraints', () => {
  it.each([
    ['first_referrer_host', 'https://www.google.com/'],
    ['first_referrer_host', 'WWW.GOOGLE.COM'],
    ['first_referrer_host', 'google.com:443'],
    ['first_referrer_host', 'a'.repeat(254)],
    ['landing_path', '//evil.example/x'],
    ['landing_path', 'https://evil.example/'],
    ['landing_path', '/a b'],
    ['landing_path', '/' + 'a'.repeat(500)],
  ] as const)('%s = %j is refused (23514)', async (column, value) => {
    const { error } = await svc.from('inquiries').insert({ ...base(999), [column]: value })
    expect(error?.code).toBe('23514')
  })
})

describe('inquiry_acquisition_channel — access', () => {
  it('anon cannot read the view', async () => {
    const { error } = await anon.from('inquiry_acquisition_channel').select('inquiry_id').limit(1)
    expect(error?.code).toBe('42501')
  })
})
