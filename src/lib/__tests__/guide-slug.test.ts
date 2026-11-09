import { describe, it, expect } from 'vitest'
import { activationBlocker, slugChangeBlocker, suggestGuideSlug, validateGuideSlug } from '../guide-slug'
import { guideProfilePath } from '../guide-url'
import { retiredGuideTarget } from '../guide-redirects'

describe('suggestGuideSlug (FA-1.86)', () => {
  it('builds name-country in the shape of the slugs on prod', () => {
    expect(suggestGuideSlug('Dustin Habener', 'New Zealand')).toBe('dustin-habener-new-zealand')
    expect(suggestGuideSlug('Inge Rønning', 'Norway')).toBe('inge-ronning-norway')
    expect(suggestGuideSlug('Øystein Davidsen', 'Norway')).toBe('oystein-davidsen-norway')
    expect(suggestGuideSlug('Joakim Åberg', 'Sweden')).toBe('joakim-aberg-sweden')
    expect(suggestGuideSlug('Sebastián Fernández', 'Chile')).toBe('sebastian-fernandez-chile')
  })
  it('drops punctuation and handles a missing country', () => {
    expect(suggestGuideSlug('Kristina Placko & Daryl Paskell', 'New Zealand')).toBe('kristina-placko-daryl-paskell-new-zealand')
    expect(suggestGuideSlug('Emanuel Cosic', '')).toBe('emanuel-cosic')
    expect(suggestGuideSlug('', '')).toBe('')
  })
  it('always produces something validateGuideSlug accepts (or empty)', () => {
    for (const [n, c] of [['Martín "Tincho" Chambó', 'Argentina'], ['Łukasz Żółć', 'Poland'], ['  ', 'Iceland']]) {
      const s = suggestGuideSlug(n!, c!)
      expect(validateGuideSlug(s), s).toBeNull()
    }
  })
})

describe('validateGuideSlug (FA-1.86)', () => {
  it('rejects empty, blank, uppercase, spaces, double or edge hyphens, too long', () => {
    for (const bad of [null, undefined, '', '   ', 'Josh-Hart', 'josh hart', 'josh--hart', '-josh', 'josh-', 'josh_hart', 'x'.repeat(81)]) {
      expect(validateGuideSlug(bad as string | null | undefined), String(bad)).not.toBeNull()
    }
  })
  it('accepts the approved slugs', () => {
    for (const ok of ['dustin-habener-new-zealand', 'josh-hart-new-zealand', 'kristina-placko-daryl-paskell-new-zealand', 'emanuel-cosic', 'lucky-lure-fishing-finland']) {
      expect(validateGuideSlug(ok), ok).toBeNull()
    }
  })
})

describe('activation and slug lock (FA-1.86)', () => {
  it('activating without a slug is blocked, with one is not; other statuses are never blocked', () => {
    expect(activationBlocker('active', null)).toMatch(/without a slug/)
    expect(activationBlocker('active', '  ')).toMatch(/without a slug/)
    expect(activationBlocker('active', 'a-b')).toBeNull()
    for (const s of ['pending', 'verified', 'suspended']) expect(activationBlocker(s, null)).toBeNull()
  })
  it('an active guide cannot change its slug; a non-active one can; setting a first slug is fine', () => {
    expect(slugChangeBlocker({ status: 'active', slug: 'old' }, 'new')).toMatch(/cannot be changed/)
    expect(slugChangeBlocker({ status: 'active', slug: 'old' }, 'old')).toBeNull()
    expect(slugChangeBlocker({ status: 'active', slug: 'old' }, undefined)).toBeNull()
    expect(slugChangeBlocker({ status: 'suspended', slug: 'old' }, 'new')).toBeNull()
    expect(slugChangeBlocker({ status: 'active', slug: null }, 'first')).toBeNull()
  })
})

describe('guideProfilePath (FA-1.86, D1)', () => {
  it('is /guides/<slug>, and null — never /guides/null or a UUID — without a usable slug', () => {
    expect(guideProfilePath({ slug: 'josh-hart-new-zealand' })).toBe('/guides/josh-hart-new-zealand')
    expect(guideProfilePath({ slug: null })).toBeNull()
    expect(guideProfilePath({ slug: undefined })).toBeNull()
    expect(guideProfilePath({ slug: '  ' })).toBeNull()
    expect(guideProfilePath({})).toBeNull()
  })
})

describe('retiredGuideTarget (FA-1.86, D2)', () => {
  it('maps the Josh Hart duplicate to the real profile, case-insensitively; nothing else', () => {
    expect(retiredGuideTarget('cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d')).toBe('1a30602e-05f8-4a5d-a89f-76b4d53843a4')
    expect(retiredGuideTarget('CD8F48F1-0633-4832-9C56-0F2CB4C7EE6D')).toBe('1a30602e-05f8-4a5d-a89f-76b4d53843a4')
    expect(retiredGuideTarget('1a30602e-05f8-4a5d-a89f-76b4d53843a4')).toBeNull()
    expect(retiredGuideTarget('josh-hart-new-zealand')).toBeNull()
  })
})
