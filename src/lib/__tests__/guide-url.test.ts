import { describe, it, expect } from 'vitest'
import { guideProfilePath, publicGuideSlug } from '@/lib/guide-url'

/** FA-1.86 visibility of a guide's profile; FA-1.97 links it from a trip card only when it is public. */
describe('publicGuideSlug', () => {
  const visible = { slug: 'josh-hart-new-zealand', status: 'active', is_hidden: false }

  it('an active, not hidden guide with a slug: the slug', () => {
    expect(publicGuideSlug(visible)).toBe('josh-hart-new-zealand')
  })

  it('hidden: null (getGuide() serves no hidden profile — the link would be a 404)', () => {
    expect(publicGuideSlug({ ...visible, is_hidden: true })).toBeNull()
  })

  it('not active: null', () => {
    for (const status of ['pending', 'suspended', 'offboarded', null]) {
      expect(publicGuideSlug({ ...visible, status }), String(status)).toBeNull()
    }
  })

  it('no slug, or a blank one: null — a profile is never linked by UUID', () => {
    expect(publicGuideSlug({ ...visible, slug: null })).toBeNull()
    expect(publicGuideSlug({ ...visible, slug: '  ' })).toBeNull()
  })

  it('unknown visibility (columns not read): null, never a guess', () => {
    expect(publicGuideSlug({ slug: 'x' })).toBeNull()
  })

  it('guideProfilePath is unchanged', () => {
    expect(guideProfilePath({ slug: 'a' })).toBe('/guides/a')
    expect(guideProfilePath({ slug: null })).toBeNull()
  })
})
