/**
 * FA-1.13 fix — a failed guide_contacts query is not "no number on file".
 *
 * Both helpers used to read only `data`, so a database error came back as null / []:
 * the composer greyed out WhatsApp and an inbound message went to `unmatched`, with
 * nothing in the logs. Now they log with the [guide-contacts] prefix and throw.
 *
 * Pure unit test: the service client is mocked to return an error.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// vi.mock is hoisted above plain consts — the error object must be hoisted with it.
const { DB_ERROR } = vi.hoisted(() => ({ DB_ERROR: { message: 'connection refused', code: '08006' } }))

vi.mock('@/lib/supabase/server', () => {
  // Every builder method returns the same chain; awaiting / maybeSingle() yields the error.
  const result = { data: null, error: DB_ERROR }
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'eq']) chain[m] = () => chain
  chain.maybeSingle = () => Promise.resolve(result)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return { createServiceClient: () => chain }
})

import { getGuidePhone, findGuideIdsByPhone } from '@/lib/guide-contacts'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('guide-contacts — query errors are loud', () => {
  it('getGuidePhone throws and logs with the [guide-contacts] prefix', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getGuidePhone('g-1')).rejects.toThrow(/guide_contacts read failed/)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[guide-contacts]'), DB_ERROR)
  })

  it('findGuideIdsByPhone throws and logs with the [guide-contacts] prefix', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(findGuideIdsByPhone('+3547770001')).rejects.toThrow(/guide_contacts lookup failed/)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[guide-contacts]'), DB_ERROR)
  })
})
