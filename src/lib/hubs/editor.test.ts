import { describe, it, expect } from 'vitest'
import {
  HubContentPayloadSchema,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  FAQ_MAX,
  hubConstraintMessage,
  type HubContentPayload,
} from './editor'

const valid = (over: Partial<HubContentPayload> = {}): HubContentPayload => ({
  h1: 'Norway Fly Fishing Trips',
  intro: 'Guides in Norway.',
  metaTitle: 'Norway Fly Fishing Trips',
  metaDescription: 'Fly fishing guides in Norway.',
  seasonMonths: [5, 6, 7, 8],
  peakMonths: [6, 7],
  seasonNote: null,
  species: ['Brown trout'],
  faq: [{ question: 'When?', answer: 'May to August.' }],
  heroQuoteText: null,
  heroQuoteAuthor: null,
  heroQuoteCountry: null,
  proofNote: null,
  contactName: null,
  contactEmail: null,
  contactWhatsapp: null,
  ...over,
})

const refused = (over: Partial<HubContentPayload>) => {
  const r = HubContentPayloadSchema.safeParse(valid(over))
  return r.success ? null : r.error.issues[0]
}

describe('HubContentPayloadSchema (FA-1.85)', () => {
  it('accepts a complete payload and turns blank optional text into null', () => {
    const r = HubContentPayloadSchema.safeParse(valid({ seasonNote: '  ', proofNote: '', contactWhatsapp: '' }))
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toMatchObject({ seasonNote: null, proofNote: null, contactWhatsapp: null })
  })

  it('limits: meta description 160 (the blog is 155), meta title 60', () => {
    expect(refused({ metaDescription: 'x'.repeat(META_DESCRIPTION_MAX) })).toBeNull()
    expect(refused({ metaDescription: 'x'.repeat(META_DESCRIPTION_MAX + 1) })?.path).toEqual(['metaDescription'])
    expect(refused({ metaTitle: 'x'.repeat(META_TITLE_MAX) })).toBeNull()
    expect(refused({ metaTitle: 'x'.repeat(META_TITLE_MAX + 1) })?.path).toEqual(['metaTitle'])
  })

  it('blank required text is refused, naming the field', () => {
    expect(refused({ h1: '   ' })?.message).toBe('Headline cannot be blank')
    expect(refused({ intro: '' })?.path).toEqual(['intro'])
    expect(refused({ metaDescription: '' })?.path).toEqual(['metaDescription'])
  })

  it('months: 1–12, whole numbers, listed once', () => {
    expect(refused({ seasonMonths: [1, 13] })?.path[0]).toBe('seasonMonths')
    expect(refused({ seasonMonths: [0, 5], peakMonths: [] })?.path[0]).toBe('seasonMonths')
    expect(refused({ seasonMonths: [5, 5], peakMonths: [] })?.message).toMatch(/listed twice/)
    expect(refused({ seasonMonths: [5.5 as number], peakMonths: [] })?.path[0]).toBe('seasonMonths')
    expect(refused({ seasonMonths: [], peakMonths: [] })).toBeNull() // no season bar is allowed
  })

  it('best months must be inside the season', () => {
    const issue = refused({ seasonMonths: [5, 6], peakMonths: [6, 9] })
    expect(issue?.path).toEqual(['peakMonths'])
    expect(issue?.message).toMatch(/Sep/)
  })

  it('FAQ: both halves, at most 12 entries', () => {
    expect(refused({ faq: [{ question: 'Q?', answer: '' }] })?.path).toEqual(['faq', 0, 'answer'])
    expect(refused({ faq: [{ question: ' ', answer: 'A' }] })?.path).toEqual(['faq', 0, 'question'])
    const many = Array.from({ length: FAQ_MAX + 1 }, (_, i) => ({ question: `Q${i}?`, answer: 'A' }))
    expect(refused({ faq: many })?.path).toEqual(['faq'])
    expect(refused({ faq: many.slice(0, FAQ_MAX) })).toBeNull()
  })

  it('species: no blank names, no repeats (case-insensitive), at most 20', () => {
    expect(refused({ species: ['Brown trout', 'brown TROUT'] })?.message).toMatch(/twice/)
    expect(refused({ species: Array.from({ length: 21 }, (_, i) => `S${i}`) })?.path).toEqual(['species'])
  })

  it('the quote is all or none — the missing field is named', () => {
    const issue = refused({ heroQuoteText: 'Great.', heroQuoteCountry: 'NZ' })
    expect(issue?.path).toEqual(['heroQuoteAuthor'])
    expect(issue?.message).toMatch(/the author is missing/)
    expect(refused({ heroQuoteText: 'Great.', heroQuoteAuthor: 'A. Angler', heroQuoteCountry: 'NZ' })).toBeNull()
  })

  it('the contact is all or none; e-mail and WhatsApp are checked', () => {
    expect(refused({ contactName: 'Krzysztof' })?.path).toEqual(['contactEmail'])
    const full = { contactName: 'K', contactEmail: 'k@example.com', contactWhatsapp: '+48 123-456-789' }
    const ok = HubContentPayloadSchema.safeParse(valid(full))
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.contactWhatsapp).toBe('48123456789') // spaces, + and dashes removed
    expect(refused({ ...full, contactEmail: 'nope' })?.path).toEqual(['contactEmail'])
    expect(refused({ ...full, contactWhatsapp: '12' })?.path).toEqual(['contactWhatsapp'])
    expect(refused({ ...full, contactWhatsapp: 'call me' })?.path).toEqual(['contactWhatsapp'])
  })
})

describe('hubConstraintMessage', () => {
  it('maps a constraint name to a sentence, and an unknown one to null', () => {
    expect(hubConstraintMessage('violates check constraint "destination_hubs_contact_complete"')).toMatch(/contact needs/)
    expect(hubConstraintMessage('violates check constraint "destination_hubs_meta_description_length"')).toMatch(/160/)
    expect(hubConstraintMessage('some other error')).toBeNull()
  })
})
