/**
 * FA-1.42 — data-layer queries behind the repeat-submission and daily-cap guards.
 *
 *   hasRecentInquiryFromEmail  — same e-mail (trim + case-insensitive, wildcards escaped),
 *                                inside the window, not the inquiry just created
 *   countAutoSendsSince        — agent.auto_send_decided events with sent=true since a moment
 *
 * Both throw on a database error: the caller decides whether to fail open (repeat lookup)
 * or hold (cap), so a swallowed error would hide the failure.
 */

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { hasRecentInquiryFromEmail, countAutoSendsSince } from '@/lib/supabase/queries'

type Call = { method: string; args: unknown[] }

/** Records every chained call and resolves the chain with `result` when awaited. */
function fakeClient(result: unknown) {
  const calls: Call[] = []
  let usedTable = ''
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'ilike', 'neq', 'eq', 'gte', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  const client = {
    from: (t: string) => {
      usedTable = t
      return builder
    },
  } as unknown as SupabaseClient<Database>
  return { client, calls, table: () => usedTable }
}

const SINCE = new Date('2026-10-02T12:00:00.000Z')

describe('hasRecentInquiryFromEmail', () => {
  it('matches case-insensitively on the trimmed, lower-cased address, inside the window, excluding the current inquiry', async () => {
    const f = fakeClient({ data: [{ angler_email: 'Test@Angler.COM' }], error: null })

    const result = await hasRecentInquiryFromEmail(f.client, {
      email:            '  Test@Angler.com ',
      excludeInquiryId: 'inq-new',
      since:            SINCE,
    })

    expect(result).toBe(true)
    expect(f.table()).toBe('inquiries')
    expect(f.calls).toContainEqual({ method: 'ilike', args: ['angler_email', 'test@angler.com'] })
    expect(f.calls).toContainEqual({ method: 'neq',   args: ['id', 'inq-new'] })
    expect(f.calls).toContainEqual({ method: 'gte',   args: ['created_at', '2026-10-02T12:00:00.000Z'] })
  })

  it('escapes % _ and \\ so that they match literally, never as wildcards', async () => {
    const f = fakeClient({ data: [], error: null })

    await hasRecentInquiryFromEmail(f.client, {
      email:            'a_b%c\\d@x.com',
      excludeInquiryId: 'inq-new',
      since:            SINCE,
    })

    expect(f.calls).toContainEqual({ method: 'ilike', args: ['angler_email', 'a\\_b\\%c\\\\d@x.com'] })
  })

  it('does not count a row the database returned only because of a wildcard — the address must be equal after normalising', async () => {
    const f = fakeClient({ data: [{ angler_email: 'axb@x.com' }], error: null })

    const result = await hasRecentInquiryFromEmail(f.client, {
      email:            'a_b@x.com',
      excludeInquiryId: 'inq-new',
      since:            SINCE,
    })

    expect(result).toBe(false)
  })

  it('is false when there is no earlier inquiry', async () => {
    const f = fakeClient({ data: [], error: null })

    expect(await hasRecentInquiryFromEmail(f.client, {
      email: 'new@angler.com', excludeInquiryId: 'inq-new', since: SINCE,
    })).toBe(false)
  })

  it('throws on a database error, so the caller can choose to fail open', async () => {
    const f = fakeClient({ data: null, error: { message: 'connection reset' } })

    await expect(hasRecentInquiryFromEmail(f.client, {
      email: 'x@y.com', excludeInquiryId: 'inq-new', since: SINCE,
    })).rejects.toThrow('connection reset')
  })
})

describe('countAutoSendsSince', () => {
  it('counts agent.auto_send_decided events with sent=true since the given moment', async () => {
    const f = fakeClient({ count: 3, error: null })

    const count = await countAutoSendsSince(f.client, SINCE)

    expect(count).toBe(3)
    expect(f.table()).toBe('inquiry_events')
    expect(f.calls).toContainEqual({ method: 'select', args: ['id', { count: 'exact', head: true }] })
    expect(f.calls).toContainEqual({ method: 'eq',     args: ['type', 'agent.auto_send_decided'] })
    expect(f.calls).toContainEqual({ method: 'eq',     args: ['payload->>sent', 'true'] })
    expect(f.calls).toContainEqual({ method: 'gte',    args: ['occurred_at', '2026-10-02T12:00:00.000Z'] })
  })

  it('throws on a database error instead of reporting zero', async () => {
    const f = fakeClient({ count: null, error: { message: 'timeout' } })

    await expect(countAutoSendsSince(f.client, SINCE)).rejects.toThrow('timeout')
  })
})
