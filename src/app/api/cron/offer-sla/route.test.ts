import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Unit test: Supabase and Resend are never reached. The API key is a dummy.
const OWNER = 'ops.owner@example.com'

vi.mock('@/lib/env', () => ({
  env: {
    CRON_SECRET: 'cron-secret',
    OWNER_EMAIL: 'ops.owner@example.com',
    NEXT_PUBLIC_APP_URL: 'https://fjordanglers.com',
    RESEND_API_KEY: 'test-dummy-key',
    FA_FROM_EMAIL: 'FjordAnglers <contact@fjordanglers.com>',
  },
}))

// One overdue inquiry; the query chain ends in order(), which resolves the rows.
const overdueRows = [
  {
    id: 'inq-1',
    angler_name: 'Jan Kowalski',
    trip_country: 'Iceland',
    status: 'pending',
    created_at: new Date(Date.now() - 72 * 3_600_000).toISOString(),
  },
]
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'is', 'eq', 'not', 'lt']) chain[m] = () => chain
  chain.order = async () => ({ data: overdueRows, error: null })
  return { createServiceClient: () => ({ from: () => chain }) }
})

import { GET } from './route'

const req = () =>
  new NextRequest('http://localhost/api/cron/offer-sla', {
    headers: { authorization: 'Bearer cron-secret' },
  })

let fetchMock: ReturnType<typeof vi.fn>
let infoSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  delete process.env.RESEND_DEV_FAKE
  fetchMock = vi.fn(async () => new Response('{"id":"re_test"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.RESEND_DEV_FAKE
})

describe('cron offer-sla with RESEND_DEV_FAKE=1', () => {
  it('does not call Resend, reports faked, logs masked owner address only', async () => {
    process.env.RESEND_DEV_FAKE = '1'

    const res = await GET(req())
    const json = (await res.json()) as Record<string, unknown>

    expect(fetchMock).not.toHaveBeenCalled()
    expect(json).toEqual({ overdue: 1, mailed: false, faked: true })
    const line = String(infoSpy.mock.calls[0]?.[0])
    expect(line).toContain('type=offer-sla digest')
    expect(line).toContain('o***@example.com')
    expect(line).not.toContain(OWNER)
    expect(line).not.toContain('Jan Kowalski')
  })
})

describe('cron offer-sla without RESEND_DEV_FAKE', () => {
  it('calls Resend once with the digest addressed to OWNER_EMAIL', async () => {
    const res = await GET(req())
    const json = (await res.json()) as Record<string, unknown>

    expect(json).toEqual({ overdue: 1, mailed: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.to).toBe(OWNER)
    expect(body.subject).toBe('⏱ SLA alert — 1 inquiry without offer')
    expect(infoSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })
})
