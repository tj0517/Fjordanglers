/**
 * FA-1.87 — POST /api/events stores the referrer host the page sends, not the beacon
 * request's own Referer header (which is always our site).
 *
 *   • a payload with referrer_host → that host, reduced (lower-case, no path)
 *   • a payload without it (a page cached before FA-1.87) → still 204, NULL
 *   • an odd value → still 204, NULL — a measurement never costs an event
 *   • unknown fields are still refused (the schema stays strict)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (table: string) => ({ insert: (row: unknown) => insertMock(table, row) }) }),
}))

import { POST } from './route'

let n = 0
function beacon(body: unknown, referer = 'https://www.fjordanglers.com/norway'): NextRequest {
  return new NextRequest('http://localhost/api/events', {
    method:  'POST',
    headers: { 'content-type': 'application/json', referer },
    body:    JSON.stringify(body),
  })
}
/** A distinct path per request so the per-path rate limit never interferes. */
const path = (): string => `/t/${++n}`

beforeEach(() => {
  insertMock.mockReset()
  insertMock.mockResolvedValue({ error: null })
})

function stored(): Record<string, unknown> {
  expect(insertMock).toHaveBeenCalledTimes(1)
  const [table, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>]
  expect(table).toBe('web_events')
  return row
}

describe('POST /api/events — referrer_host', () => {
  it('stores the host the page sends, not the beacon\'s own Referer', async () => {
    const res = await POST(beacon({ event: 'page_view', path: path(), referrer_host: 'www.google.com' }))
    expect(res.status).toBe(204)
    expect(stored().referrer_host).toBe('www.google.com')
  })

  it('reduces a full URL to its host', async () => {
    const res = await POST(beacon({ event: 'page_view', path: path(), referrer_host: 'https://WWW.Google.com/search?q=x' }))
    expect(res.status).toBe(204)
    expect(stored().referrer_host).toBe('www.google.com')
  })

  it('a payload without the field (page cached before FA-1.87) is accepted, referrer NULL', async () => {
    const res = await POST(beacon({ event: 'page_view', path: path(), utm_campaign: 'c' }))
    expect(res.status).toBe(204)
    expect(stored()).toMatchObject({ referrer_host: null, utm_campaign: 'c' })
  })

  it.each([
    ['javascript URL', 'javascript:alert(1)'],
    ['over-long', 'https://x.example/' + 'a'.repeat(5000)],
    ['object', { host: 'www.google.com' }],
    ['number', 7],
    ['null', null],
  ])('an odd value (%s) is stored as NULL, the event still recorded', async (_name, value) => {
    const res = await POST(beacon({ event: 'form_open', path: path(), referrer_host: value }))
    expect(res.status).toBe(204)
    expect(stored().referrer_host).toBeNull()
  })

  it('an unknown field is still refused with 400 (strict schema kept)', async () => {
    const res = await POST(beacon({ event: 'page_view', path: path(), referrer: 'https://www.google.com/' }))
    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
