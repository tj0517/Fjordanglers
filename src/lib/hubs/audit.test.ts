import { describe, it, expect } from 'vitest'
import { hubAuditDiff, type AuditedHub } from './audit'

const base: AuditedHub = {
  h1: 'Norway', intro: 'Intro.', meta_title: 'Norway', meta_description: 'Desc.',
  season_months: [5, 6], peak_months: [6], season_note: null, species: [],
  faq: [{ question: 'Q?', answer: 'A.' }],
  hero_quote_text: null, hero_quote_author: null, hero_quote_country: null, proof_note: null,
  contact_name: null, contact_email: null, contact_whatsapp: null,
}

describe('hubAuditDiff (FA-1.85, tj decision 1)', () => {
  it('nothing changed → null, so the action writes no row', () => {
    expect(hubAuditDiff(base, { ...base })).toBeNull()
    expect(hubAuditDiff(base, { ...base, faq: [{ question: 'Q?', answer: 'A.' }], season_months: [5, 6] })).toBeNull()
  })

  it('only the changed fields, each in full, before and after', () => {
    const after = { ...base, h1: 'Norway, Properly', faq: [{ question: 'Q?', answer: 'A new answer.' }] }
    expect(hubAuditDiff(base, after)).toEqual({
      old_data: { h1: 'Norway', faq: [{ question: 'Q?', answer: 'A.' }] },
      new_data: { h1: 'Norway, Properly', faq: [{ question: 'Q?', answer: 'A new answer.' }] },
    })
  })

  it('a field that becomes NULL, and one that was NULL, are both recorded', () => {
    const diff = hubAuditDiff({ ...base, season_note: 'Note.' }, { ...base, proof_note: 'gear included' })
    expect(diff?.old_data).toEqual({ season_note: 'Note.', proof_note: null })
    expect(diff?.new_data).toEqual({ season_note: null, proof_note: 'gear included' })
  })

  it('the same FAQ with its keys in another order is not a change (jsonb reorders keys)', () => {
    const reordered = { ...base, faq: [{ answer: 'A.', question: 'Q?' }] }
    expect(hubAuditDiff(base, reordered)).toBeNull()
    expect(hubAuditDiff(base, { ...reordered, faq: [{ answer: 'A!', question: 'Q?' }] })).not.toBeNull()
  })

  it('a change of month order counts as a change', () => {
    expect(hubAuditDiff(base, { ...base, season_months: [6, 5] })).not.toBeNull()
  })
})
