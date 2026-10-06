/**
 * matchInquiryByRecipient — address validation and wildcard escaping. FA-1.49.
 *
 * A recipient address like anna_k@example.test contains a SQL ILIKE wildcard (`_`
 * matches any single character) which, without escaping, would allow it to match
 * annaXk@example.test. This file proves:
 *
 *  1. The pattern passed to .ilike() has wildcards escaped (red on old code, green after fix).
 *  2. An address that fails email validation is skipped before any DB call.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByRecipient } from '@/lib/inquiry-matcher'

function setupDb(capturedPatterns: string[]) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({
        ilike: (_col: string, pattern: string) => {
          capturedPatterns.push(pattern)
          return {
            not: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: 'inq-1' }, error: null }),
                }),
              }),
            }),
          }
        },
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('matchInquiryByRecipient — wildcard escaping, FA-1.49', () => {
  it('escapes _ in recipient address before DB call so anna_k cannot match annaXk', async () => {
    const patterns: string[] = []
    setupDb(patterns)

    await matchInquiryByRecipient(['anna_k@example.test'])

    expect(patterns).toHaveLength(1)
    // Must be escaped: anna\_k@example.test (not anna_k@example.test)
    expect(patterns[0]).toBe('anna\\_k@example.test')
  })

  it('skips an address with % because % makes it invalid per Zod email schema', async () => {
    // a%b@example.test fails z.string().email() → skipped before DB call
    const patterns: string[] = []
    setupDb(patterns)

    await matchInquiryByRecipient(['a%b@example.test'])

    expect(patterns).toHaveLength(0)
  })

  it('skips an address that fails email validation without calling DB ilike', async () => {
    const patterns: string[] = []
    setupDb(patterns)

    // 'not-an-email' has no domain — invalid per Zod email schema
    await matchInquiryByRecipient(['not-an-email'])

    // ilike must not have been called for this address
    expect(patterns).toHaveLength(0)
  })

  it('skips malformed address and still matches a valid one in the same list', async () => {
    const patterns: string[] = []
    setupDb(patterns)

    const result = await matchInquiryByRecipient(['bad@@address', 'good@example.test'])

    expect(patterns).toHaveLength(1)
    expect(patterns[0]).toBe('good@example.test')
    expect(result).toBe('inq-1')
  })
})
