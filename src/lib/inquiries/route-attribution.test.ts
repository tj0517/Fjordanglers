/**
 * FA-1.87 — first-touch attribution through POST /api/inquiries into the real local database.
 * (Lives in src/lib, not next to the route: it reads fixtures with .from(), which src/app must not contain.)
 * Env and safety fuse: src/tests/setup.ts (local URL only).
 *
 * The insert is real (createInquiry → inquiries, CHECK constraints included) and the channel
 * is read back from `inquiry_acquisition_channel`. Mocked: e-mail, the AI agent, the rate
 * limiter (Upstash) and env — nothing leaves the machine.
 *
 *   • hostile values are reduced or become NULL — the inquiry is always created (201),
 *     never refused by the route (400) or by a CHECK constraint (500)
 *   • google referrer + first touch → organic, landing path stored
 *   • no attribution fields at all → 201, channel `unknown` (tj decision 2026-11-12)
 *   • first touch without a referrer → `direct`
 *
 * Every inquiry is created with the e-mail below and deleted in afterAll.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:     'test-key',
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: false as boolean,
  RESEND_API_KEY:        'test-resend',
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))
vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: vi.fn() }))
vi.mock('@/lib/ai/auto-send', () => ({ autoSendReply: vi.fn(), hasAgentAutoReply: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     vi.fn().mockResolvedValue(undefined),
  sendInquiryReceivedAnglerEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/rate-limit/inquiries', () => ({
  clientIpFromHeaders: () => null,
  checkIpLimit:        vi.fn().mockResolvedValue({ blocked: false }),
  checkEmailLimit:     vi.fn().mockResolvedValue({ blocked: false }),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/inquiries/route'

const EMAIL = 'fa187-route@test.invalid'
const svc = createServiceClient()
let pageId = ''

async function cleanup(): Promise<void> {
  const { error } = await svc.from('inquiries').delete().eq('angler_email', EMAIL)
  if (error != null) throw new Error(`cleanup: ${error.message}`)
}

beforeAll(async () => {
  await cleanup()
  const { data, error } = await svc.from('experience_pages').select('id').eq('status', 'active').limit(1).single()
  if (error != null || data == null) throw new Error(`no active experience page in the local seed: ${error?.message}`)
  pageId = data.id
})

afterAll(cleanup)

const RECENT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

async function submit(extra: Record<string, unknown>): Promise<{ status: number; id: string | null }> {
  const req = new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({
      experience_page_id: pageId,
      angler_name:        'FA-1.87 Synthetic',
      angler_email:       EMAIL,
      requested_dates:    ['2027-06-01'],
      party_size:         2,
      form_elapsed_ms:    10_000,
      ...extra,
    }),
  })
  const res = await POST(req)
  const body = await res.json() as { id?: string }
  return { status: res.status, id: body.id ?? null }
}

async function readBack(id: string) {
  const { data, error } = await svc
    .from('inquiry_acquisition_channel')
    .select('first_referrer_host, landing_path, first_touch_at, channel')
    .eq('inquiry_id', id)
    .single()
  if (error != null) throw new Error(error.message)
  return data
}

describe('POST /api/inquiries — first-touch attribution (real insert)', () => {
  it('google referrer + landing path → 201, channel organic, path stored', async () => {
    const r = await submit({ first_referrer_host: 'www.google.com', landing_path: '/norway', first_touch_at: RECENT })
    expect(r.status).toBe(201)
    expect(await readBack(r.id!)).toMatchObject({
      first_referrer_host: 'www.google.com', landing_path: '/norway', channel: 'organic',
    })
  })

  it('no attribution fields at all → 201, channel unknown', async () => {
    const r = await submit({})
    expect(r.status).toBe(201)
    expect(await readBack(r.id!)).toEqual({ first_referrer_host: null, landing_path: null, first_touch_at: null, channel: 'unknown' })
  })

  it('first touch without a referrer → direct', async () => {
    const r = await submit({ first_referrer_host: null, landing_path: '/', first_touch_at: RECENT })
    expect(r.status).toBe(201)
    expect((await readBack(r.id!)).channel).toBe('direct')
  })

  it.each([
    ['full URL with query and credentials', { first_referrer_host: 'https://u:p@WWW.Google.com:8443/search?q=x' }, { first_referrer_host: 'www.google.com' }],
    ['javascript: referrer',                { first_referrer_host: 'javascript:alert(1)' },                    { first_referrer_host: null }],
    ['markup as referrer',                  { first_referrer_host: '<img src=x onerror=alert(1)>' },           { first_referrer_host: null }],
    ['over-long referrer',                  { first_referrer_host: 'a'.repeat(300) + '.com' },                 { first_referrer_host: null }],
    ['referrer as an object',               { first_referrer_host: { host: 'www.google.com' } },               { first_referrer_host: null }],
    ['protocol-relative landing path',      { landing_path: '//evil.example/x' },                              { landing_path: null }],
    ['absolute URL as landing path',        { landing_path: 'https://evil.example/' },                         { landing_path: null }],
    ['landing path with query',             { landing_path: '/norway?gclid=abc&email=a@b.c' },                 { landing_path: '/norway' }],
    ['landing path with a newline',         { landing_path: '/a\nb' },                                         { landing_path: null }],
    ['over-long landing path',              { landing_path: '/' + 'a'.repeat(600) },                           { landing_path: null }],
    ['landing path as a number',            { landing_path: 42 },                                              { landing_path: null }],
    ['first_touch_at not a date',           { first_touch_at: 'yesterday' },                                   { first_touch_at: null }],
    ['first_touch_at in the future',        { first_touch_at: '2099-01-01T00:00:00Z' },                        { first_touch_at: null }],
  ])('%s → 201, stored reduced or NULL', async (_name, extra, expected) => {
    const r = await submit(extra)
    expect(r.status).toBe(201)
    expect(await readBack(r.id!)).toMatchObject(expected)
  })
})
