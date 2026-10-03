/**
 * FA-1.41 — POST /api/inquiries is rate limited per client IP and per e-mail.
 *
 * A rejected request must cause no database lookup, no save, no AI call and no
 * e-mail. The limiter runs on an in-memory adapter with a frozen clock; the real
 * Upstash is never contacted.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  createInquiry:       vi.fn(),
  classifyInquiry:     vi.fn(),
  autoSendReply:       vi.fn(),
  sendFaEmail:         vi.fn(),
  sendAnglerEmail:     vi.fn(),
  getRateLimiter:      vi.fn(),
}))

const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:     'test-key',
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: true as boolean,
  RESEND_API_KEY:        'test-resend',
  RATE_LIMIT_SALT:       'test-salt' as string | undefined,
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/inquiries/create', () => ({ createInquiry: mocks.createInquiry }))
vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: mocks.classifyInquiry }))
vi.mock('@/lib/ai/auto-send', () => ({
  autoSendReply:     mocks.autoSendReply,
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     mocks.sendFaEmail,
  sendInquiryReceivedAnglerEmail: mocks.sendAnglerEmail,
}))
vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-01',
}))
vi.mock('@/lib/rate-limit/factory', () => ({ getRateLimiter: mocks.getRateLimiter }))

import { createMemoryLimiter } from '@/lib/rate-limit/memory'
import type { RateLimiter } from '@/lib/rate-limit/types'

const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/
const IPV6_PATTERN = /(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}|::/i

const FROZEN_NOW = 1_800_000_000_000

function body(email: string) {
  return {
    experience_page_id: '550e8400-e29b-41d4-a716-446655440000',
    angler_name:        'Test Angler',
    angler_email:       email,
    requested_dates:    ['2026-08-01'],
    party_size:         2,
    message:            'I want to fish New Zealand rivers.',
  }
}

async function post(email: string, ip: string | null): Promise<Response> {
  const { POST } = await import('@/app/api/inquiries/route')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ip != null) headers['cf-connecting-ip'] = ip
  return POST(new NextRequest('http://localhost/api/inquiries', {
    method: 'POST',
    headers,
    body:   JSON.stringify(body(email)),
  }))
}

function expectNothingHappened() {
  expect(mocks.createServiceClient).not.toHaveBeenCalled()
  expect(mocks.createInquiry).not.toHaveBeenCalled()
  expect(mocks.classifyInquiry).not.toHaveBeenCalled()
  expect(mocks.autoSendReply).not.toHaveBeenCalled()
  expect(mocks.sendFaEmail).not.toHaveBeenCalled()
  expect(mocks.sendAnglerEmail).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = true
  mockEnv.RATE_LIMIT_SALT = 'test-salt'

  mocks.getRateLimiter.mockReturnValue(createMemoryLimiter(() => FROZEN_NOW))
  mocks.createInquiry.mockResolvedValue({ id: 'inq-rl', status: 'new' })
  mocks.sendFaEmail.mockResolvedValue(undefined)
  mocks.sendAnglerEmail.mockResolvedValue(undefined)
  mocks.classifyInquiry.mockResolvedValue(undefined)
  mocks.autoSendReply.mockResolvedValue(undefined)

  const page = {
    id:              '11111111-1111-1111-1111-111111111111',
    guide_id:        'guide-1',
    experience_name: 'NZ Trout Fly Fishing',
    country:         'New Zealand',
  }
  mocks.createServiceClient.mockReturnValue({
    from: () => {
      const b = { select: () => b, eq: () => b, single: async () => ({ data: page, error: null }) }
      return b
    },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/inquiries — rate limit per IP', () => {
  it('6th request from the same IP in the window → 429 + Retry-After, nothing runs', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await post(`angler${i}@example.com`, '203.0.113.7')).status).toBe(201)
    }
    vi.clearAllMocks()

    const res = await post('angler6@example.com', '203.0.113.7')

    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(600)
    const json = await res.json()
    expect(Object.keys(json)).toEqual(['error'])
    expectNothingHappened()
  })

  it('another IP is not affected by the first one being blocked', async () => {
    for (let i = 1; i <= 6; i++) await post(`angler${i}@example.com`, '203.0.113.7')
    expect((await post('other@example.com', '203.0.113.8')).status).toBe(201)
  })
})

describe('POST /api/inquiries — rate limit per e-mail', () => {
  it('4th request for the same e-mail from different IPs → 429 + Retry-After, nothing runs', async () => {
    expect((await post('Anna@Example.com', '203.0.113.1')).status).toBe(201)
    expect((await post('anna@example.com', '203.0.113.2')).status).toBe(201)
    expect((await post('ANNA@EXAMPLE.COM', '203.0.113.3')).status).toBe(201)
    vi.clearAllMocks()

    const res = await post('anna@Example.com', '203.0.113.4')

    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(3600)
    const json = await res.json()
    expect(Object.keys(json)).toEqual(['error'])
    expectNothingHappened()
  })
})

describe('POST /api/inquiries — below the thresholds nothing changes', () => {
  it('5 requests from one IP (different e-mails) and 3 for one e-mail (different IPs) all pass', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await post(`ok${i}@example.com`, '198.51.100.5')).status).toBe(201)
    }
    for (let i = 1; i <= 3; i++) {
      expect((await post('same@example.com', `198.51.100.${10 + i}`)).status).toBe(201)
    }
    expect(mocks.createInquiry).toHaveBeenCalledTimes(8)
    expect(mocks.classifyInquiry).toHaveBeenCalledTimes(8)
    expect(mocks.autoSendReply).toHaveBeenCalledTimes(8)
  })
})

describe('POST /api/inquiries — counter keys', () => {
  it('keys handed to the adapter contain no @, no IPv4/IPv6 pattern, nothing from the raw values', async () => {
    const inner = createMemoryLimiter(() => FROZEN_NOW)
    const limit = vi.fn(inner.limit)
    mocks.getRateLimiter.mockReturnValue({ limit } satisfies RateLimiter)

    await post('Anna.Test@Example.com', '203.0.113.42')
    await post('anna.other@example.com', '2001:db8:85a3::8a2e:370:7334')

    expect(limit.mock.calls.length).toBeGreaterThanOrEqual(4)
    for (const [key] of limit.mock.calls) {
      expect(key).not.toContain('@')
      expect(key).not.toMatch(IPV4_PATTERN)
      expect(key).not.toMatch(IPV6_PATTERN)
      expect(key.toLowerCase()).not.toContain('anna')
    }
  })
})

describe('POST /api/inquiries — missing client IP (decision 2)', () => {
  it('skips only the IP check: unlimited per IP, still limited per e-mail', async () => {
    for (let i = 1; i <= 8; i++) {
      expect((await post(`free${i}@example.com`, null)).status).toBe(201)
    }
    for (let i = 1; i <= 3; i++) {
      expect((await post('burst@example.com', null)).status).toBe(201)
    }
    vi.clearAllMocks()
    const res = await post('burst@example.com', null)
    expect(res.status).toBe(429)
    expectNothingHappened()
  })

  it('in production a missing header logs a warning without personal data', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await post('prod@example.com', null)).status).toBe(201)

    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('prod@example.com')
  })
})

describe('POST /api/inquiries — limiter failure (O-29 a, fail-open)', () => {
  it('adapter throws → the request passes like without a limit; the error log has no IP or e-mail', async () => {
    mocks.getRateLimiter.mockReturnValue({
      limit: vi.fn().mockRejectedValue(new Error('upstash unreachable')),
    } satisfies RateLimiter)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await post('fail.open@example.com', '203.0.113.99')

    expect(res.status).toBe(201)
    expect(mocks.createInquiry).toHaveBeenCalledTimes(1)
    expect(mocks.autoSendReply).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(error.mock.calls)
    expect(logged).toContain('upstash unreachable')
    expect(logged).not.toContain('203.0.113.99')
    expect(logged).not.toContain('fail.open')
  })

  it('limiter not configured (local, no variables) → behaves exactly as before', async () => {
    mocks.getRateLimiter.mockReturnValue(null)

    for (let i = 1; i <= 8; i++) {
      expect((await post('same@example.com', '203.0.113.50')).status).toBe(201)
    }
    expect(mocks.createInquiry).toHaveBeenCalledTimes(8)
  })
})
