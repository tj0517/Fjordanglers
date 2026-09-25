/**
 * FA-1.30 unit tests for draftDepositLinkMessage, buildStripeProductName,
 * buildStripeProductDescription.
 *
 * draftDepositLinkMessage is now a pure function — no Supabase access.
 * All tests use makeParams() to build the input and check the returned string.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Anthropic mock ────────────────────────────────────────────────────────────
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

vi.mock('@/lib/ai/extract-trip', () => ({
  assembleConversation: vi.fn().mockReturnValue('Assembled conversation text.'),
}))

// ─── makeParams helper ────────────────────────────────────────────────────────

import type { DraftDepositLinkParams } from '@/lib/ai/draft-deposit-link'

function makeParams(overrides?: Partial<DraftDepositLinkParams>): DraftDepositLinkParams {
  return {
    inquiryId:        'inq-1',
    anglerName:       'Jan',
    anglerMessage:    'Hi, interested in Iceland fishing.',
    requestedDates:   ['12–15 Jun 2026'],
    partySize:        2,
    status:           'awaiting_payment',
    guideName:        null,
    instructions:     { body: 'Write warmly and directly.' },
    knowledgeEntries: [],
    tripTitle:        'Trout fishing, Iceland',
    amountString:     '200.00 EUR',
    linkUrl:          'https://buy.stripe.com/test123',
    threadMessages:   [],
    ...overrides,
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
  it('substitutes amount and link, returns final text as string', async () => {
    const aiText = `Dear Jan,\n\nTo confirm your booking please pay {{DEPOSIT_AMOUNT}}.\n\nPay here: {{PAYMENT_LINK}}\n\nBest,\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage } = await import('@/lib/ai/draft-deposit-link')
    const result = await draftDepositLinkMessage(makeParams())

    expect(typeof result).toBe('string')
    expect(result).toContain('200.00 EUR')
    expect(result).toContain('https://buy.stripe.com/test123')
    expect(result).not.toContain('{{DEPOSIT_AMOUNT}}')
    expect(result).not.toContain('{{PAYMENT_LINK}}')
  })
})

// ─── draftDepositLinkMessage — happy path (ISK) ───────────────────────────────

describe('draftDepositLinkMessage — happy path (ISK)', () => {
  it('substitutes ISK amount and link correctly', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}}\n\nPay here: {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage } = await import('@/lib/ai/draft-deposit-link')
    const result = await draftDepositLinkMessage(makeParams({ amountString: '500.00 ISK', linkUrl: 'https://buy.stripe.com/isk99' }))

    expect(result).toContain('500.00 ISK')
    expect(result).toContain('https://buy.stripe.com/isk99')
  })
})

// ─── Fix 4: instructions body in prompt ──────────────────────────────────────

describe('draftDepositLinkMessage — Fix 4: instructions body in prompt', () => {
  it('includes the instructions body in the prompt sent to the model', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}}\n\nPay here: {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage } = await import('@/lib/ai/draft-deposit-link')
    await draftDepositLinkMessage(makeParams({ instructions: { body: 'Write warmly and directly.' } }))

    const call = anthropicCreate.mock.calls[0][0]
    const prompt: string = call.messages[0].content
    expect(prompt).toContain('Write warmly and directly.')
  })
})

// ─── Red proof: missing link placeholder ─────────────────────────────────────

describe('draftDepositLinkMessage — red proof: missing link placeholder', () => {
  it('throws DraftDepositLinkError when PAYMENT_LINK placeholder is absent', async () => {
    const aiTextNoLink = `Hi Jan, please pay {{DEPOSIT_AMOUNT}} and contact us for the link.`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiTextNoLink }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })
})

// ─── Red proof: missing amount placeholder ────────────────────────────────────

describe('draftDepositLinkMessage — red proof: missing amount placeholder', () => {
  it('throws DraftDepositLinkError when DEPOSIT_AMOUNT placeholder is absent', async () => {
    const aiTextNoAmount = `Hi Jan, please pay at: {{PAYMENT_LINK}}`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiTextNoAmount }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })
})

// ─── Red proof (Fix 3): model writes freeform amount in prose ─────────────────

describe('draftDepositLinkMessage — red proof: freeform amount in prose', () => {
  it('throws when model writes "200 EUR" alongside the placeholder (Fix 3)', async () => {
    const aiText = `Hi Jan,\n\nThe deposit is 200 EUR (see {{DEPOSIT_AMOUNT}}).\n\nPay here: {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })

  it('throws when model writes a € amount alongside the placeholder (Fix 3)', async () => {
    const aiText = `Hi Jan,\n\nPlease pay €200 using {{DEPOSIT_AMOUNT}} at {{PAYMENT_LINK}}.`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })
})

// ─── Red proof (Fix 3): model writes freeform URL in prose ────────────────────

describe('draftDepositLinkMessage — red proof: freeform URL in prose', () => {
  it('throws when model writes a URL alongside the placeholder (Fix 3)', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}}\n\nPay here https://buy.stripe.com/evil or {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })
})

// ─── Red proof (Fix 3): placeholder appears twice ────────────────────────────

describe('draftDepositLinkMessage — red proof: placeholder appears twice', () => {
  it('throws when DEPOSIT_AMOUNT appears twice (Fix 3)', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}} (total {{DEPOSIT_AMOUNT}}).\n\nPay here: {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })

  it('throws when PAYMENT_LINK appears twice (Fix 3)', async () => {
    const aiText = `Hi Jan,\n\nDeposit: {{DEPOSIT_AMOUNT}}\n\nPay here: {{PAYMENT_LINK}} or {{PAYMENT_LINK}}\n\nFA`
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: aiText }] })

    const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
    await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
  })
})

// ─── Red proof: no AI key ─────────────────────────────────────────────────────

describe('draftDepositLinkMessage — red proof: no AI key', () => {
  it('throws DraftDepositLinkError when ANTHROPIC_API_KEY is empty', async () => {
    const envModule = await import('@/lib/env')
    const original = envModule.env.ANTHROPIC_API_KEY ?? ''
    ;(envModule.env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = ''

    try {
      const { draftDepositLinkMessage, DraftDepositLinkError } = await import('@/lib/ai/draft-deposit-link')
      await expect(draftDepositLinkMessage(makeParams())).rejects.toBeInstanceOf(DraftDepositLinkError)
    } finally {
      ;(envModule.env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = original
    }
  })
})
