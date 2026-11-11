import { describe, it, expect } from 'vitest'
import { hubContentFromRow, type HubContentRow } from './content'

const row: HubContentRow = {
  id: 'id', slug: 'norway', created_at: '', updated_at: '',
  h1: 'Norway', intro: 'Intro.', meta_title: 'Norway', meta_description: 'Desc.',
  season_months: [5, 6], peak_months: [6], season_note: 'Note.', species: ['Brown trout'],
  faq: [{ question: 'Q?', answer: 'A.' }],
  hero_quote_text: null, hero_quote_author: null, hero_quote_country: null, proof_note: null,
  contact_name: null, contact_email: null, contact_whatsapp: null,
}

describe('hubContentFromRow (FA-1.85)', () => {
  it('maps the columns to the fields the page reads, leaving absent optionals out', () => {
    expect(hubContentFromRow(row)).toEqual({
      h1: 'Norway', intro: 'Intro.', metaTitle: 'Norway', metaDescription: 'Desc.',
      seasonMonths: [5, 6], peakMonths: [6], seasonNote: 'Note.', species: ['Brown trout'],
      faq: [{ question: 'Q?', answer: 'A.' }],
    })
  })

  it('carries a complete quote, proof note and contact', () => {
    const c = hubContentFromRow({
      ...row, proof_note: 'gear included',
      hero_quote_text: 'Great.', hero_quote_author: 'A. Angler', hero_quote_country: 'NZ',
      contact_name: 'K', contact_email: 'k@example.com', contact_whatsapp: '48123456789',
    })
    expect(c.heroQuote).toEqual({ text: 'Great.', author: 'A. Angler', country: 'NZ' })
    expect(c.proofNote).toBe('gear included')
    expect(c.contact).toEqual({ name: 'K', email: 'k@example.com', whatsapp: '48123456789' })
  })

  it('drops a FAQ entry that has only one half, as the offer pages do', () => {
    const c = hubContentFromRow({ ...row, faq: [{ question: 'Q?', answer: '' }, { question: 'Q2?', answer: 'A2.' }] })
    expect(c.faq).toEqual([{ question: 'Q2?', answer: 'A2.' }])
  })
})
