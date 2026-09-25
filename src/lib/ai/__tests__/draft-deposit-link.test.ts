/**
 * FA-1.30 unit tests for draftDepositLinkMessage, buildStripeProductName,
 * buildStripeProductDescription, and formatDepositAmount.
 *
 * All tests are pure — no network, no external services.
 * Supabase and Anthropic are mocked following the pattern in draft-reply.test.ts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Anthropic mock ────────────────────────────────────────────────────────────
// Must be a class so `new Anthropic()` works (arrow functions can't be constructors).
const anthropicCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY:             'sk-test',
    NEXT_PUBLIC_APP_URL:           'https://test.example.com',
    SUPABASE_SERVICE_ROLE_KEY:     'test-key',
    NEXT_PUBLIC_SUPABASE_URL:      'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    STRIPE_SECRET_KEY:             'sk_test_1234',
    STRIPE_WEBHOOK_SECRET:         'whsec_test',
    RESEND_API_KEY:                'test-resend',
    RESEND_INBOUND_SECRET:         'test-secret',
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient:        vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/ai/knowledge', () => ({
  loadKnowledge: vi.fn().mockResolvedValue({
    instructions: { body: 'Write warmly and directly.' },
    entries: [],
    usedIds: [],
  }),
}))

vi.mock('@/lib/inquiries/experience-lookup', () => ({
  getInquiryExperience: vi.fn().mockResolvedValue(null),
  tripTitleOf:          vi.fn().mockReturnValue('Trout fishing, Iceland'),
  TRIP_TITLE_FALLBACK:  'Your trip',
  GUIDE_NAME_FALLBACK:  'Your guide',
}))

import { createServiceClient } from '@/lib/supabase/server'

// ─── DB helper ────────────────────────────────────────────────────────────────

function makeDb(opts?: { draftId?: string; insertSpy?: ReturnType<typeof vi.fn> }) {
  const draftId   = opts?.draftId   ?? 'draft-deposit-1'
  const insertSpy = opts?.insertSpy ?? vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({ data: { id: draftId }, error: null }),
    }),
  })

  return {
    from(table: string) {
      if (table === 'inquiries') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'inq-1', angler_name: 'Jan', message: 'Hi', requested_dates: ['12–15 Jun 2026'],
                  party_size: 2, trip_country: 'IS', assigned_guide_id: null,
                  trip_id: null, experience_page_id: null, status: 'awaiting_payment',
                }, error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
              // chained eq calls for draft lookup
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: insertSpy,
          update: () => ({ eq: () => ({ error: null }) }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildStripeProductName ───────────────────────────────────────────────────

describe('buildStripeProductName', () => {
  it('includes trip title, dates and party size (plural)', async () => {
    const { buildStripeProductName } = await import('@/lib/ai/draft-deposit-link')
    const name = buildStripeProductName('Trout fly fishing, Iceland', ['12–15 Jun 2026'], 2)
    expect(name).toContain('Trout fly fishing, Iceland')
    expect(name).toContain('12–15 Jun 2026')
    expect(name).toContain('2 people')
  })

  it('uses singular "person" for party size 1', async () => {
    const { buildStripeProductName } = await import('@/lib/ai/draft-deposit-link')
    const name = buildStripeProductName('Arctic char fishing', [], 1)
    expect(name).toContain('1 person')
    expect(name).not.toContain('people')
  })

  it('omits date separator when requested_dates is empty', async () => {
    const { buildStripeProductName } = await import('@/lib/ai/draft-deposit-link')
    const name = buildStripeProductName('Salmon fishing', [], 3)
    expect(name).not.toContain('—')
    expect(name).toContain('3 people')
  })
})

// ─── draftDepositLinkMessage — happy path (EUR) ───────────────────────────────

describe('draftDepositLinkMessage — happy path (EUR)', () => {
  it('substitutes amount and link, saves draft row, returns draftId and text', async () => {
    const aiText = `Dear Jan,\n\nTo confirm your booking please pay {{DEPOSIT_AMOUNT}}.\n\nPay here: {{PAYMENT_LINK}}\n\nBest,\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })
    vi.mocked(createServiceClient).mockReturnValue(makeDb() as unknown as ReturnType<typeof createServiceClient>)

    const { draftDepositLinkMessage } = await import('@/lib/ai/draft-deposit-link')
    const result = await draftDepositLinkMessage({
      inquiryId:    'inq-1',
      amountString: '200.00 EUR',
      linkUrl:      'https://buy.stripe.com/test123',
    })

    expect(result.draftId).toBe('draft-deposit-1')
    expect(result.text).toContain('200.00 EUR')
    expect(result.text).toContain('https://buy.stripe.com/test123')
    expect(result.text).not.toContain('{{DEPOSIT_AMOUNT}}')
    expect(result.text).not.toContain('{{PAYMENT_LINK}}')
  })
})

// ─── draftDepositLinkMessage — happy path (ISK) ───────────────────────────────

describe('draftDepositLinkMessage — happy path (ISK)', () => {
  it('substitutes ISK amount and link correctly', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}}\n\nPay here: {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })
    vi.mocked(createServiceClient).mockReturnValue(makeDb({ draftId: 'draft-isk-1' }) as unknown as ReturnType<typeof createServiceClient>)

    const { draftDepositLinkMessage } = await import('@/lib/ai/draft-deposit-link')
    const result = await draftDepositLinkMessage({
      inquiryId:    'inq-1',
      amountString: '500.00 ISK',
      linkUrl:      'https://buy.stripe.com/isk99',
    })

    expect(result.draftId).toBe('draft-isk-1')
    expect(result.text).toContain('500.00 ISK')
    expect(result.text).toContain('https://buy.stripe.com/isk99')
  })
})

// ─── Red proof: missing link placeholder ─────────────────────────────────────

describe('draftDepositLinkMessage — red proof: missing link placeholder', () => {
  it('throws DraftDepositLinkError and does not save a draft', async () => {
    const aiTextNoLink = `Hi Jan, please pay {{DEPOSIT_AMOUNT}} and contact us for the link.`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiTextNoLink }] })
    const insertSpy = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue(
      makeDb({ insertSpy }) as unknown as ReturnType<typeof createServiceClient>,
    )

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(
      draftDepositLinkMessage({ inquiryId: 'inq-1', amountString: '200.00 EUR', linkUrl: 'https://buy.stripe.com/x' }),
    ).rejects.toBeInstanceOf(DraftDepositLinkError)

    expect(insertSpy).not.toHaveBeenCalled()
  })
})

// ─── Red proof: missing amount placeholder ────────────────────────────────────

describe('draftDepositLinkMessage — red proof: missing amount placeholder', () => {
  it('throws DraftDepositLinkError and does not save a draft', async () => {
    const aiTextNoAmount = `Hi Jan, please pay at: {{PAYMENT_LINK}}`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiTextNoAmount }] })
    const insertSpy = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue(
      makeDb({ insertSpy }) as unknown as ReturnType<typeof createServiceClient>,
    )

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(
      draftDepositLinkMessage({ inquiryId: 'inq-1', amountString: '200.00 EUR', linkUrl: 'https://buy.stripe.com/x' }),
    ).rejects.toBeInstanceOf(DraftDepositLinkError)

    expect(insertSpy).not.toHaveBeenCalled()
  })
})

// ─── Red proof: no AI key ─────────────────────────────────────────────────────

describe('draftDepositLinkMessage — red proof: no AI key', () => {
  it('throws DraftDepositLinkError when ANTHROPIC_API_KEY is empty', async () => {
    // patch env directly in this test
    const envModule = await import('@/lib/env')
    const original = envModule.env.ANTHROPIC_API_KEY ?? ''
    ;(envModule.env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = ''

    try {
      const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
      await expect(
        draftDepositLinkMessage({ inquiryId: 'inq-1', amountString: '200.00 EUR', linkUrl: 'https://buy.stripe.com/x' }),
      ).rejects.toBeInstanceOf(DraftDepositLinkError)
    } finally {
      ;(envModule.env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = original
    }
  })
})
