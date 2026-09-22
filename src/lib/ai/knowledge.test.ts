/**
 * FA-1.14 — loadKnowledge fixture test.
 *
 * Verifies that the loader:
 *   - always includes tone files
 *   - includes a destination file when country matches
 *   - includes a guide file when guide name matches (case-insensitive)
 *   - excludes destination files for a different country
 *   - excludes guide files for a different guide
 *   - skips destination files when country is not provided
 *   - skips guide files when guide is not provided
 *   - includes used files in the assembled draft prompt
 *
 * Uses fixtures from src/lib/ai/__fixtures__/knowledge/ — no real docs/knowledge/.
 */

import path from 'path'
import { describe, it, expect } from 'vitest'
import { loadKnowledge } from './knowledge'
import { buildDraftPrompt } from './draft-reply-prompt'

const FIXTURE_DIR = path.resolve(__dirname, '__fixtures__/knowledge')

describe('loadKnowledge', () => {
  it('always loads tone files', () => {
    const files = loadKnowledge({ knowledgeDir: FIXTURE_DIR })
    expect(files.some(f => f.kind === 'tone')).toBe(true)
  })

  it('loads destination file when country matches', () => {
    const files = loadKnowledge({ country: 'Iceland', knowledgeDir: FIXTURE_DIR })
    const destinations = files.filter(f => f.kind === 'destination')
    expect(destinations).toHaveLength(1)
    expect(destinations[0].country).toBe('Iceland')
  })

  it('skips destination file for different country', () => {
    const files = loadKnowledge({ country: 'Norway', knowledgeDir: FIXTURE_DIR })
    expect(files.filter(f => f.kind === 'destination')).toHaveLength(0)
  })

  it('skips destination files when country is not provided', () => {
    const files = loadKnowledge({ knowledgeDir: FIXTURE_DIR })
    expect(files.filter(f => f.kind === 'destination')).toHaveLength(0)
  })

  it('loads guide file when guide_name matches (case-insensitive)', () => {
    const files = loadKnowledge({ guide: 'josh hart', knowledgeDir: FIXTURE_DIR })
    const guides = files.filter(f => f.kind === 'guide')
    expect(guides).toHaveLength(1)
    expect(guides[0].guide_name).toBe('Josh Hart')
  })

  it('skips guide file for different guide', () => {
    const files = loadKnowledge({ guide: 'Unknown Guide', knowledgeDir: FIXTURE_DIR })
    expect(files.filter(f => f.kind === 'guide')).toHaveLength(0)
  })

  it('skips guide files when guide is not provided', () => {
    const files = loadKnowledge({ knowledgeDir: FIXTURE_DIR })
    expect(files.filter(f => f.kind === 'guide')).toHaveLength(0)
  })

  it('loads tone + destination + guide for fully matched inquiry', () => {
    const files = loadKnowledge({
      country:      'New Zealand',
      guide:        'Josh Hart',
      knowledgeDir: FIXTURE_DIR,
    })
    expect(files.some(f => f.kind === 'tone')).toBe(true)
    expect(files.some(f => f.kind === 'destination' && f.country === 'New Zealand')).toBe(true)
    expect(files.some(f => f.kind === 'guide' && f.guide_name === 'Josh Hart')).toBe(true)
    expect(files).toHaveLength(3)
  })

  it('loaded files appear in the assembled draft prompt', () => {
    const files = loadKnowledge({
      country:      'Iceland',
      guide:        'Siggi Thorvaldsson',
      knowledgeDir: FIXTURE_DIR,
    })
    const prompt = buildDraftPrompt(
      { counterpart: 'angler', channel: 'email', status: 'qualifying', guideName: 'Siggi Thorvaldsson' },
      files,
      'test conversation',
    )
    // Tone content is referenced
    expect(prompt).toContain('brand-voice')
    // Destination content is referenced
    expect(prompt).toContain('iceland')
    // Guide content is referenced
    expect(prompt).toContain('siggi-thorvaldsson')
    // Conversation is included
    expect(prompt).toContain('test conversation')
  })
})
