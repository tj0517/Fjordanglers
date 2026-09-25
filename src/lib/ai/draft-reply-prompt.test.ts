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
