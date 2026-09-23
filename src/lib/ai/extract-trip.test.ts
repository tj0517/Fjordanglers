/**
 * FA-1.21 — assembleConversation speaker-label tests.
 *
 * Verifies that every message in the assembled thread is labelled by side
 * (angler / guide / FA) when `counterpart` is present on the message, and
 * that the output is byte-identical to today's when it is absent (so
 * inquiry-agent.ts and src/actions/ai.ts, which never select `counterpart`,
 * keep their behaviour unchanged).
 */

import { describe, it, expect } from 'vitest'
import { assembleConversation, type ConversationMessage } from './extract-trip'

const BASE_ARGS: [string, string | null, string[], number, string | null] = [
  'Jan Kowalski',
  'I want to fish for salmon',
  ['2026-07-15'],
  2,
  'Iceland Salmon Week',
]

describe('assembleConversation — speaker labels (FA-1.21)', () => {
  it('labels an inbound message from the guide as the guide, not "Angler"', () => {
    const messages: ConversationMessage[] = [
      { direction: 'inbound', channel: 'whatsapp', body: 'I can do 15 July, 800 EUR/day', occurred_at: '2026-07-02T10:00:00Z', counterpart: 'guide' },
    ]

    const conversation = assembleConversation(...BASE_ARGS, messages, 'Siggi Thorvaldsson')

    expect(conversation).toContain('Guide Siggi Thorvaldsson')
    expect(conversation).not.toMatch(/^\[.*\] Angler \(inbound/m)
  })

  it('labels an inbound message from the angler as "Angler"', () => {
    const messages: ConversationMessage[] = [
      { direction: 'inbound', channel: 'email', body: 'Any availability in July?', occurred_at: '2026-07-02T10:00:00Z', counterpart: 'angler' },
    ]

    const conversation = assembleConversation(...BASE_ARGS, messages, null)

    expect(conversation).toMatch(/\] Angler \(inbound via email\):/)
  })

  it('labels an outbound message to the guide as "FA → guide"', () => {
    const messages: ConversationMessage[] = [
      { direction: 'outbound', channel: 'whatsapp', body: 'Do you have availability 15 July?', occurred_at: '2026-07-02T09:00:00Z', counterpart: 'guide' },
    ]

    const conversation = assembleConversation(...BASE_ARGS, messages, 'Siggi Thorvaldsson')

    expect(conversation).toMatch(/\] FA → guide \(outbound via whatsapp\):/)
  })

  it('labels an outbound message to the angler as "FA → angler"', () => {
    const messages: ConversationMessage[] = [
      { direction: 'outbound', channel: 'email', body: 'What species are you after?', occurred_at: '2026-07-02T09:00:00Z', counterpart: 'angler' },
    ]

    const conversation = assembleConversation(...BASE_ARGS, messages, null)

    expect(conversation).toMatch(/\] FA → angler \(outbound via email\):/)
  })

  it('is byte-identical to plain Angler/FA labelling when counterpart is absent (inquiry-agent.ts, src/actions/ai.ts)', () => {
    const withoutCounterpart: ConversationMessage[] = [
      { direction: 'inbound', channel: 'email', body: 'Hello', occurred_at: '2026-07-01T10:00:00Z' },
      { direction: 'outbound', channel: 'email', body: 'What species?', occurred_at: '2026-07-01T11:00:00Z' },
    ]

    const conversation = assembleConversation(...BASE_ARGS, withoutCounterpart)

    expect(conversation).toContain('] Angler (inbound via email):')
    expect(conversation).toContain('] FA (outbound via email):')
    expect(conversation).not.toContain('FA →')
  })

  it('labels a guide message "Guide (unassigned)" instead of guessing a name, and does not throw', () => {
    const messages: ConversationMessage[] = [
      { direction: 'inbound', channel: 'whatsapp', body: 'I can do it', occurred_at: '2026-07-02T10:00:00Z', counterpart: 'guide' },
    ]

    let conversation = ''
    expect(() => { conversation = assembleConversation(...BASE_ARGS, messages, null) }).not.toThrow()
    expect(conversation).toContain('Guide (unassigned)')
  })
})
