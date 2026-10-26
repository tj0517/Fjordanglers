/**
 * FA-1.21 / FA-1.23 — buildDraftPrompt draft-context block.
 *
 * Verifies the `=== DRAFT CONTEXT ===` header carries addressee, channel,
 * inquiry status and assigned guide, ahead of the knowledge section.
 */

import { describe, it, expect } from 'vitest'
import { buildDraftPrompt } from './draft-reply-prompt'

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
    expect(rules).toContain('No price')
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
