/**
 * FA-1.47 — judgeReply input tests.
 *
 * The judge receives the knowledge entries the draft was built from:
 *   ‣ with knowledge → userContent has a "KNOWLEDGE BASE (source of truth)" section with every entry
 *   RED proof: on main's judge-reply.ts the knowledge argument is ignored → test fails
 *   ‣ without knowledge (undefined or []) → userContent identical to the pre-change format
 *
 * Anthropic and @/lib/env are mocked; no network.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const anthropicCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('@/lib/env', () => ({ env: { ANTHROPIC_API_KEY: 'test-key' } }))

import { judgeReply, JUDGE_THRESHOLD } from './judge-reply'
import type { KnowledgeEntry } from './knowledge'

const CONVERSATION = '[ANGLER] Hi, two of us want to fish NZ rivers in February.'
const DRAFT        = 'Thanks! The guided day is 1 440 NZD plus 60 NZD for the licence.'

const KNOWLEDGE: KnowledgeEntry[] = [
  { id: 'k-inst', kind: 'instructions', country: null,          guide_id: null,    title: 'Instructions',  body: 'Never promise a specific day.' },
  { id: 'k-tone', kind: 'tone',         country: null,          guide_id: null,    title: 'Tone',          body: 'Warm, direct.' },
  { id: 'k-dest', kind: 'destination',  country: 'New Zealand', guide_id: null,    title: 'NZ pricing',    body: 'Guided day 1 440 NZD + 60 NZD licence. Full days only.' },
  { id: 'k-guide', kind: 'guide',       country: null,          guide_id: 'g-42',  title: 'Guide Sam',     body: 'Sam guides South Island rivers.' },
]

/** The literal the model received before FA-1.47 for these two arguments (prompt text up to the first section). */
function expectedLegacyInput(userContent: string): string {
  const head = userContent.slice(0, userContent.indexOf('\n\n=== CONVERSATION ==='))
  return [head, '', '=== CONVERSATION ===', CONVERSATION, '', '=== DRAFT REPLY ===', DRAFT].join('\n')
}

function sentUserContent(): string {
  const args = anthropicCreate.mock.calls[0][0] as { messages: { role: string; content: string }[] }
  return args.messages[0].content
}

beforeEach(() => {
  anthropicCreate.mockReset()
  anthropicCreate.mockResolvedValue({
    content: [{ type: 'text', text: '{"score": 0.95, "send": true, "reasons": ["ok"]}' }],
  })
})

describe('judgeReply — knowledge in the input (FA-1.47)', () => {
  it('puts every knowledge entry (kind label, title, body) in a "KNOWLEDGE BASE (source of truth)" section — RED on main', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)

    const content = sentUserContent()
    expect(content).toContain('=== KNOWLEDGE BASE (source of truth) ===')
    for (const e of KNOWLEDGE) {
      expect(content).toContain(e.title)
      expect(content).toContain(e.body)
    }
    expect(content).toContain('Destination: New Zealand')
    expect(content).toContain('Guide (g-42)')
  })

  it('places the knowledge before the conversation and the draft, and states the new rule', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)

    const content = sentUserContent()
    const kb   = content.indexOf('=== KNOWLEDGE BASE (source of truth) ===')
    const conv = content.indexOf('=== CONVERSATION ===')
    const draft = content.indexOf('=== DRAFT REPLY ===')
    expect(kb).toBeGreaterThan(-1)
    expect(kb).toBeLessThan(conv)
    expect(conv).toBeLessThan(draft)
    expect(content).toMatch(/consistent with the knowledge base/i)
    expect(content).toMatch(/contradicts the knowledge base/i)
  })

  it('keeps every existing "never auto" rule when knowledge is passed', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)

    const content = sentUserContent()
    for (const rule of [
      'The message contains a complaint, accusation or negative sentiment toward the agency',
      'The message compares FjordAnglers with a competitor',
      "The message asks for a guide's direct contact, phone or email",
      'Something has gone wrong (booking issue, refund, error, overcharge)',
      'The message is vague, unclear or doesn\'t fit any known stage of the booking process',
      'The draft proposes something that needs admin review before committing (pricing, exceptions, custom terms)',
    ]) {
      expect(content).toContain(rule)
    }
  })

  it('without knowledge the input is the pre-change format — no knowledge section, no new rule', async () => {
    await judgeReply(CONVERSATION, DRAFT)

    const content = sentUserContent()
    expect(content).toBe(expectedLegacyInput(content))
    expect(content).not.toContain('KNOWLEDGE BASE')
    expect(content).not.toMatch(/consistent with the knowledge base/i)
  })

  it('an empty knowledge array gives the same input as no argument', async () => {
    await judgeReply(CONVERSATION, DRAFT)
    const without = sentUserContent()

    anthropicCreate.mockClear()
    await judgeReply(CONVERSATION, DRAFT, [])
    expect(sentUserContent()).toBe(without)
  })

  it('still returns the parsed verdict and keeps the threshold at 0.9', async () => {
    const result = await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    expect(result).toEqual({ score: 0.95, send: true, reasons: ['ok'] })
    expect(JUDGE_THRESHOLD).toBe(0.9)
  })
})
