import { describe, it, expect } from 'vitest'
import { finishSlug, slugify, slugifyDraft } from '../experiences/offer-slug'
import { slugSchema } from '../experiences/v2-editor'

describe('offer slugify (FA-1.89)', () => {
  it('transliterates macrons, Nordic letters and & — the SEO audit example', () => {
    expect(slugify('Fly fishing – Taupō & Tongariro')).toBe('fly-fishing-taupo-and-tongariro')
  })
  it('handles ø, å, æ and Icelandic letters', () => {
    expect(slugify('Gaula & Orkla — Støren')).toBe('gaula-and-orkla-storen')
    expect(slugify('Ålen Lodge')).toBe('alen-lodge')
    expect(slugify('Lærdal')).toBe('laerdal')
    expect(slugify('Þingvallavatn & Laxá í Aðaldal')).toBe('thingvallavatn-and-laxa-i-adaldal')
  })
  it('never produces repeated hyphens from repeated spaces or dashes', () => {
    expect(slugify('Fly   fishing  --  Southland')).toBe('fly-fishing-southland')
    expect(slugify('Fly fishing - - - Taupō')).toBe('fly-fishing-taupo')
    expect(slugify('Torres del Paine / Tierra del Fuego')).toBe('torres-del-paine-tierra-del-fuego')
  })
  it('trims leading and trailing punctuation and drops apostrophes', () => {
    expect(slugify('  — "Angler’s Run!" —  ')).toBe('anglers-run')
    expect(slugify('...Sea-run browns?')).toBe('sea-run-browns')
    expect(slugify('')).toBe('')
    expect(slugify(' – & – ')).toBe('and')
  })
  it('always yields a slug slugSchema accepts, with no "--"', () => {
    for (const title of ['Fly fishing – Taupō & Tongariro', 'Œuvre ß Łódź', '1 / 2 days']) {
      const slug = slugify(title)
      expect(slugSchema.safeParse(slug).success, slug).toBe(true)
      expect(slug, title).not.toMatch(/--|^-|-$/)
    }
  })
})

describe('typing a slug by hand (FA-1.89)', () => {
  it('keeps one trailing hyphen while typing so the next word can follow', () => {
    expect(slugifyDraft('fly ')).toBe('fly-')
    expect(slugifyDraft('fly--')).toBe('fly-')
    expect(slugifyDraft('-fly-fishing')).toBe('fly-fishing')
  })
  it('drops the trailing hyphen on save, leaving an existing "--" slug untouched', () => {
    expect(finishSlug('fly-fishing-')).toBe('fly-fishing')
    expect(finishSlug('fly-fishing-across-punta-arenas-tierra-del-fuego--torres-del-paine'))
      .toBe('fly-fishing-across-punta-arenas-tierra-del-fuego--torres-del-paine')
  })
})
