/**
 * FA-1.47 / FA-1.72 — judgeReply input and parsing tests.
 *
 * The judge receives the knowledge entries the draft was built from (FA-1.47):
 *   ‣ with knowledge → userContent has a "KNOWLEDGE BASE (source of truth)" section with every entry
 *   ‣ without knowledge (undefined or []) → no knowledge section
 *
 * FA-1.72: the judge answers "is there a critical reason NOT to send" — default send, five STOP
 * groups, an explicit list of non-reasons, no threshold wording; a reply cut off mid-JSON throws
 * (fail-safe: the caller does not send) and the call leaves room for it (max_tokens >= 512).
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

import { judgeReply } from './judge-reply'
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

  it('states the default (send), the five STOP groups and the list of non-reasons — RED on main: "be strict" prompt', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)

    const content = sentUserContent()
    expect(content).toMatch(/default verdict: send/i)
    for (const group of [
      'STOP GROUP 1',
      'STOP GROUP 2',
      'STOP GROUP 3',
      'STOP GROUP 4',
      'STOP GROUP 5',
    ]) {
      expect(content).toContain(group)
    }
    expect(content).toMatch(/NOT reasons to stop/i)
    expect(content).toMatch(/at most 3 reasons/i)
  })

  it('has no threshold wording and no "be strict" instruction — RED on main', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    const withKnowledge = sentUserContent()
    anthropicCreate.mockClear()
    await judgeReply(CONVERSATION, DRAFT)
    const without = sentUserContent()

    for (const content of [withKnowledge, without]) {
      expect(content).not.toMatch(/when in doubt/i)
      expect(content).not.toContain('0.9')
      expect(content).not.toMatch(/threshold/i)
      expect(content).not.toMatch(/be strict/i)
    }
  })

  it('describes score as information only', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    expect(sentUserContent()).toMatch(/score[^\n]*(statistics|information)[^\n]*(does not|no effect)/i)
  })

  it('without knowledge the input has no knowledge section and no knowledge rule', async () => {
    await judgeReply(CONVERSATION, DRAFT)

    const content = sentUserContent()
    expect(content).toBe(expectedLegacyInput(content))
    expect(content).not.toContain('=== KNOWLEDGE BASE')
    expect(content).not.toContain('KNOWLEDGE BASE RULE')
    expect(content).not.toMatch(/consistent with the knowledge base/i)
  })

  it('an empty knowledge array gives the same input as no argument', async () => {
    await judgeReply(CONVERSATION, DRAFT)
    const without = sentUserContent()

    anthropicCreate.mockClear()
    await judgeReply(CONVERSATION, DRAFT, [])
    expect(sentUserContent()).toBe(without)
  })

  it('returns the verdict the model gave, whatever the score', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"score": 0.55, "send": true, "reasons": ["minor tone slip"]}' }],
    })
    expect(await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).toEqual({ score: 0.55, send: true, reasons: ['minor tone slip'] })

    const result = await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    expect(result.send).toBe(true)
  })
})

describe('judgeReply — a reply that is cut off (FA-1.72, closes deferred FA-1.61)', () => {
  it('asks for at least 512 tokens — RED on main: 256', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    const args = anthropicCreate.mock.calls[0][0] as { max_tokens: number }
    expect(args.max_tokens).toBeGreaterThanOrEqual(512)
  })

  it('throws when the JSON stops mid-sentence — the caller must not send on it', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"score": 0.95, "send": true, "reasons": ["The draft quotes the price from the knowl' }],
    })
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Could not parse judge response/)
  })

  it('throws on a verdict with a missing field', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: '{"score": 0.95, "reasons": []}' }] })
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Malformed judge response/)
  })
})
