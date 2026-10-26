/**
 * FA-1.21 / FA-1.23 — buildDraftPrompt draft-context block.
 *
 * Verifies the `=== DRAFT CONTEXT ===` header carries addressee, channel,
 * inquiry status and assigned guide, ahead of the knowledge section.
 */

import { describe, it, expect } from 'vitest'
import { buildDraftPrompt, extractEmail } from './draft-reply-prompt'

const STUB_INSTRUCTIONS = 'You are the FA assistant.'

describe('buildDraftPrompt — draft context (FA-1.21)', () => {
  it('context block contains counterpart, channel, status and guide name', () => {
    const prompt = buildDraftPrompt(
      { counterpart: 'guide', channel: 'whatsapp', status: 'waiting_guide', guideName: 'Siggi Thorvaldsson' },
      STUB_INSTRUCTIONS,
      [],
      'conversation',
    )

    expect(prompt).toContain('=== DRAFT CONTEXT ===')
    expect(prompt).toContain('Addressee: guide')
    expect(prompt).toContain('Channel: whatsapp')
    expect(prompt).toContain('Inquiry status: waiting_guide')
    expect(prompt).toContain('Assigned guide: Siggi Thorvaldsson')
  })

  it('draft context precedes the knowledge and conversation sections', () => {
    const prompt = buildDraftPrompt(
      { counterpart: 'angler', channel: 'email', status: 'qualifying', guideName: null },
      STUB_INSTRUCTIONS,
      [],
      'conversation',
    )

    const contextIdx      = prompt.indexOf('=== DRAFT CONTEXT ===')
    const conversationIdx = prompt.indexOf('=== CONVERSATION ===')
    expect(contextIdx).toBeGreaterThanOrEqual(0)
    expect(conversationIdx).toBeGreaterThan(contextIdx)
  })

  it('shows "none" for assigned guide when no guide is resolved', () => {
    const prompt = buildDraftPrompt(
      { counterpart: 'angler', channel: 'email', status: 'new', guideName: null },
      STUB_INSTRUCTIONS,
      [],
      'conversation',
    )

    expect(prompt).toContain('Assigned guide: none')
  })
})

// ─── FA-1.73: rules that hold whatever the Instructions entry says ───────────────

describe('buildDraftPrompt — code-added drafting rules (FA-1.73)', () => {
  const ANGLER = { counterpart: 'angler', channel: 'email', status: 'qualifying', guideName: 'Kristina' } as const

  function rulesBlock(prompt: string): string {
    const start = prompt.indexOf('=== DRAFTING RULES ===')
    expect(start).toBeGreaterThanOrEqual(0)
    const end = prompt.indexOf('=== CONVERSATION ===')
    expect(end).toBeGreaterThan(start)
    return prompt.slice(start, end)
  }

  it('an angler draft carries the availability rule, the trip-page-is-a-hint rule and the do-not-re-ask rule — RED on main: no rules block', () => {
    const rules = rulesBlock(buildDraftPrompt(ANGLER, STUB_INSTRUCTIONS, [], 'conversation'))

    expect(rules).toContain("we'll check whether <guide> is free on <date>")
    expect(rules).toContain('Never state or imply that a guide or a date is available')
    expect(rules).toContain('Trip page the client came from')
    expect(rules).toContain('"South Island" is not "Southland"')
    expect(rules).toContain('Never ask for something the client already gave')
  })

  it('the gap rules: near gap offers the covered area with a question and no guide name; far gap promises to check and quotes nothing — RED on main', () => {
    const rules = rulesBlock(buildDraftPrompt(ANGLER, STUB_INSTRUCTIONS, [], 'conversation'))

    expect(rules).toContain("we don't run day trips from there")
    expect(rules).toContain('Do not name a guide')
    expect(rules).toContain("we'll check what our available guides can offer in that area and come back to you")
    expect(rules).toContain('Do not write "gap", "not covered", "unfortunately" or that we have no guide there or that nobody works there')
    expect(rules).toContain('Do not mention any other region, place or drive, and quote no price')
  })

  it('no place named: one question must be about where or what kind of trip, asked before dates or species', () => {
    const rules = rulesBlock(buildDraftPrompt(ANGLER, STUB_INSTRUCTIONS, [], 'conversation'))

    expect(rules).toContain('quote no regional price')
    expect(rules).toContain('One of your questions must be about where they would like to fish or what kind of trip they prefer')
    expect(rules).toContain('asked before dates or species')
  })

  it('the code rules allow the guide name — the name ban lives only in the Instructions entry, never in code', () => {
    const rules = rulesBlock(buildDraftPrompt(ANGLER, STUB_INSTRUCTIONS, [], 'conversation'))

    expect(rules).toContain("You may name the assigned guide")
    expect(rules).toContain('phone number')
    expect(rules).not.toMatch(/never (write|use|give|mention|name)[^.]*guide'?s? name/i)
    expect(rules).not.toMatch(/do not (write|name|mention)[^.]*guide'?s? name/i)
  })

  it('the rules come after the knowledge, so no knowledge entry sits below them', () => {
    const prompt = buildDraftPrompt(
      ANGLER, STUB_INSTRUCTIONS,
      [{ id: 'k', kind: 'tone', country: null, guide_id: null, title: 'Tone', body: 'Warm.' } as never],
      'conversation',
    )
    expect(prompt.indexOf('=== DRAFTING RULES ===')).toBeGreaterThan(prompt.indexOf('--- Tone'))
  })

  it('a draft to the guide gets no client rules', () => {
    const prompt = buildDraftPrompt(
      { counterpart: 'guide', channel: 'whatsapp', status: 'waiting_guide', guideName: 'Kristina' },
      STUB_INSTRUCTIONS, [], 'conversation',
    )
    expect(prompt).not.toContain('=== DRAFTING RULES ===')
  })
})

// ─── FA-1.73 step 1: the e-mail travels inside <email> tags, and nothing else is ever sent ─────

describe('extractEmail — fails closed (FA-1.73)', () => {
  it('one block, nothing around it: the body is the content, trimmed', () => {
    expect(extractEmail('<email>\nHi Anna,\n\nThanks.\n</email>')).toEqual({ body: 'Hi Anna,\n\nThanks.', issue: null })
  })

  it('whitespace around the block is fine', () => {
    expect(extractEmail('  \n<email>Hi</email>\n\n')).toEqual({ body: 'Hi', issue: null })
  })

  it('no tags at all: issue no_tags, the raw text is kept for the admin', () => {
    expect(extractEmail('Hi Anna,\n\nThanks.')).toEqual({ body: 'Hi Anna,\n\nThanks.', issue: 'no_tags' })
  })

  it('reasoning before the block: issue text_outside — the leak in the 2026-10-26 proof', () => {
    const raw = 'Anna told us everything.\n\n---\n\n<email>Hi Anna</email>'
    expect(extractEmail(raw)).toEqual({ body: raw, issue: 'text_outside' })
  })

  it('a note after the block: issue text_outside', () => {
    const raw = '<email>Hi Anna</email>\n(I kept it short.)'
    expect(extractEmail(raw)).toEqual({ body: raw, issue: 'text_outside' })
  })

  it('two blocks: issue multiple_blocks', () => {
    const raw = '<email>Hi Anna</email>\n<email>Hello Anna</email>'
    expect(extractEmail(raw)).toEqual({ body: raw, issue: 'multiple_blocks' })
  })

  it('an empty block: issue empty', () => {
    expect(extractEmail('<email>  </email>')).toEqual({ body: '<email>  </email>', issue: 'empty' })
  })

  it('an opening tag with no closing tag: issue no_tags', () => {
    expect(extractEmail('<email>Hi Anna')).toEqual({ body: '<email>Hi Anna', issue: 'no_tags' })
  })
})

describe('buildDraftPrompt — output format (FA-1.73)', () => {
  it.each(['angler', 'guide'] as const)('asks for the e-mail inside <email> tags, last, for a %s draft', counterpart => {
    const prompt = buildDraftPrompt(
      { counterpart, channel: 'email', status: 'qualifying', guideName: null },
      STUB_INSTRUCTIONS, [], 'conversation',
    )
    expect(prompt).toContain('=== OUTPUT FORMAT ===')
    expect(prompt).toContain('<email>')
    expect(prompt).toContain('Nothing before <email> and nothing after </email>')
    expect(prompt.indexOf('=== OUTPUT FORMAT ===')).toBeGreaterThan(prompt.indexOf('=== CONVERSATION ==='))
  })
})
