/**
 * FA-1.47 / FA-1.72 — judgeReply input and parsing tests.
 *
 * The judge receives the knowledge entries the draft was built from (FA-1.47):
 *   ‣ with knowledge → userContent has a "KNOWLEDGE BASE (source of truth)" section with every entry
 *   ‣ without knowledge (undefined or []) → no knowledge section
 *
 * FA-1.72: the judge answers "is there a critical reason NOT to send" — default send. Round 3 (tj):
 * the angler-side STOP groups 1–3 are reported as `client_flags` read from what the ANGLER wrote
 * (the code acts on them); `send` covers groups 4–5 only and a block carries `evidence` quotes.
 * A reply that is cut off, holds two JSON objects, text outside the JSON, or a missing / wrongly
 * shaped `client_flags` throws (fail-safe: the caller does not send); the call leaves room for the
 * answer (max_tokens >= 512).
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

const NO_FLAGS = '{"complaint": false, "competitor": false, "guide_contact": false}'
const reply = (text: string) => ({ content: [{ type: 'text', text }] })

beforeEach(() => {
  anthropicCreate.mockReset()
  anthropicCreate.mockResolvedValue(reply(`{"client_flags": ${NO_FLAGS}, "score": 0.95, "send": true, "reasons": ["ok"], "evidence": []}`))
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

  it('states the default (send), client flags, STOP groups 4 and 5 and the list of non-reasons — RED before round 3: groups 1–3 sat in the send rules', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)

    const content = sentUserContent()
    expect(content).toMatch(/default verdict: send/i)
    for (const needle of ['client_flags', 'complaint', 'competitor', 'guide_contact', 'STOP GROUP 4', 'STOP GROUP 5']) {
      expect(content).toContain(needle)
    }
    expect(content).toMatch(/NOT reasons to stop/i)
    expect(content).toMatch(/at most 3 reasons/i)
  })

  it('has one source for the angler-side rules: groups 1–3 are flags only, not send rules — RED before round 3', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    const content = sentUserContent()
    for (const group of ['STOP GROUP 1', 'STOP GROUP 2', 'STOP GROUP 3']) expect(content).not.toContain(group)

    // the flags section comes first and names the angler as its only input
    const flags = content.indexOf('CLIENT FLAGS')
    const sendPart = content.indexOf('STOP GROUP 4')
    expect(flags).toBeGreaterThan(-1)
    expect(flags).toBeLessThan(sendPart)
    expect(content).toMatch(/only what the angler wrote/i)
    expect(content).toMatch(/do not look at the draft/i)
    expect(content).toMatch(/flags have no effect on "send"/i)
  })

  it('asks for a literal quote from the draft with every block — RED before round 3', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    const content = sentUserContent()
    expect(content).toContain('"evidence"')
    expect(content).toContain('draft_quote')
    expect(content).toMatch(/copied character for character from the DRAFT REPLY/i)
    expect(content).toMatch(/cannot quote a sentence of the draft[^\n]*set "send" to true/i)
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

  it('says a price is verified only when the same amount is literally in a knowledge entry', async () => {
    await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)
    const content = sentUserContent()
    expect(content).toMatch(/counts as verified ONLY when the same amount appears literally/i)
    expect(content).toMatch(/every price in the draft is outside the knowledge base/i)
  })

  it('carries no concrete price or amount in the prompt text (it can leak into the verdict)', async () => {
    await judgeReply('', '')
    const prompt = sentUserContent().split('=== CONVERSATION ===')[0]
    expect(prompt).not.toMatch(/\d[\d ]*\s?(NZD|EUR|USD|ISK|NOK|SEK|PLN|CLP|ARS|€|\$)/)
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

  it('returns the verdict the model gave, whatever the score, with flags and evidence', async () => {
    anthropicCreate.mockResolvedValue(reply(
      `{"client_flags": {"complaint": false, "competitor": true, "guide_contact": false}, "score": 0.55, "send": false, ` +
      `"reasons": ["STOP GROUP 4: price differs"], "evidence": [{"group": 4, "draft_quote": "The guided day is 900 NZD.", "conflict": "KB says another amount"}]}`,
    ))
    expect(await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).toEqual({
      client_flags: { complaint: false, competitor: true, guide_contact: false },
      score: 0.55,
      send: false,
      reasons: ['STOP GROUP 4: price differs'],
      evidence: [{ group: 4, draft_quote: 'The guided day is 900 NZD.', conflict: 'KB says another amount' }],
    })
  })

  it('a reply without "evidence" is accepted as an empty list — the caller decides what a block without evidence means', async () => {
    anthropicCreate.mockResolvedValue(reply(`{"client_flags": ${NO_FLAGS}, "score": 0.9, "send": false, "reasons": ["x"]}`))
    expect((await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).evidence).toEqual([])
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
    anthropicCreate.mockResolvedValue(reply(`{"client_flags": ${NO_FLAGS}, "score": 0.95, "reasons": []}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Malformed judge response/)
  })
})

describe('judgeReply — strict reply shape (FA-1.72 round 3)', () => {
  const GOOD = `{"client_flags": ${NO_FLAGS}, "score": 0.9, "send": true, "reasons": ["ok"], "evidence": []}`

  it('throws when client_flags is missing — fail-safe, nothing is sent on it — RED before round 3: accepted', async () => {
    anthropicCreate.mockResolvedValue(reply('{"score": 0.95, "send": true, "reasons": ["ok"], "evidence": []}'))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Malformed judge response/)
  })

  it.each([
    ['not an object',           '"client_flags": true'],
    ['a flag missing',          '"client_flags": {"complaint": false, "competitor": false}'],
    ['a flag that is a string', '"client_flags": {"complaint": "false", "competitor": false, "guide_contact": false}'],
    ['a flag that is null',     '"client_flags": {"complaint": false, "competitor": null, "guide_contact": false}'],
  ])('throws when client_flags is wrongly shaped (%s)', async (_label, flags) => {
    anthropicCreate.mockResolvedValue(reply(`{${flags}, "score": 0.9, "send": true, "reasons": ["ok"], "evidence": []}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Malformed judge response/)
  })

  it.each([
    ['not an array',           '"evidence": "quote"'],
    ['an entry without quote', '"evidence": [{"group": 4, "conflict": "x"}]'],
    ['a group other than 4/5', '"evidence": [{"group": 2, "draft_quote": "q", "conflict": "x"}]'],
    ['a non-string conflict',  '"evidence": [{"group": 5, "draft_quote": "q", "conflict": 3}]'],
  ])('throws when evidence is wrongly shaped (%s)', async (_label, evidence) => {
    anthropicCreate.mockResolvedValue(reply(`{"client_flags": ${NO_FLAGS}, "score": 0.9, "send": false, "reasons": ["x"], ${evidence}}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Malformed judge response/)
  })

  it('throws on two JSON objects — the model contradicted itself; the last one is NOT read (guard test: already strict)', async () => {
    const second = GOOD.replace('"send": true', '"send": false')
    anthropicCreate.mockResolvedValue(reply(`${GOOD}\n\nWait, let me reconsider.\n\n${second}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Could not parse judge response/)

    anthropicCreate.mockResolvedValue(reply(`${GOOD}\n${second}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Could not parse judge response/)
  })

  it('throws on text outside the JSON, before or after it', async () => {
    anthropicCreate.mockResolvedValue(reply(`Here is my verdict: ${GOOD}`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Could not parse judge response/)

    anthropicCreate.mockResolvedValue(reply(`${GOOD}\n\nHope that helps.`))
    await expect(judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).rejects.toThrow(/Could not parse judge response/)
  })

  it('still accepts one object inside a markdown fence (as before)', async () => {
    anthropicCreate.mockResolvedValue(reply('```json\n' + GOOD + '\n```'))
    expect((await judgeReply(CONVERSATION, DRAFT, KNOWLEDGE)).send).toBe(true)
  })
})
