/**
 * FA-1.64 — `collectPagePhotos`: the "Choose from this page" library of an experience page.
 */

import { describe, it, expect } from 'vitest'
import { collectPagePhotos, type PagePhotoFields } from './page-photos'

const EMPTY: PagePhotoFields = {
  hero: null, gallery: [], contentPhotos: [], views: [], blocks: [], species: [],
  boats: [], accommodations: [], attractions: [], options: [], guidePhotos: [],
}

describe('collectPagePhotos', () => {
  it('collects from every photo field, in form order, guide photos last', () => {
    expect(collectPagePhotos({
      hero:           '/hero.jpg',
      gallery:        ['/g1.jpg', '/g2.jpg'],
      contentPhotos:  ['/c1.jpg'],
      views:          ['/v1.jpg'],
      blocks:         [{ image_url: '/b1.jpg', image_urls: ['/b1.jpg', '/b2.jpg'] }],
      species:        [{ image_url: '/s1.jpg', image_urls: ['/s1.jpg', '/s2.jpg'] }],
      boats:          [{ image_url: '/boat.jpg' }],
      accommodations: [{ image_url: '/lodge.jpg' }],
      attractions:    [{ image_url: '/attr.jpg' }],
      options:        [{ image_url: '/opt-block.jpg' }, { image_url: '/opt-boat.jpg' }],
      guidePhotos:    ['https://cdn.example/guide.jpg'],
    })).toEqual([
      '/hero.jpg', '/g1.jpg', '/g2.jpg', '/c1.jpg', '/v1.jpg', '/b1.jpg', '/b2.jpg', '/s1.jpg', '/s2.jpg',
      '/boat.jpg', '/lodge.jpg', '/attr.jpg', '/opt-block.jpg', '/opt-boat.jpg', 'https://cdn.example/guide.jpg',
    ])
  })

  it('lists a photo once, however many fields hold it', () => {
    expect(collectPagePhotos({
      ...EMPTY,
      hero:        '/a.jpg',
      gallery:     ['/a.jpg', '/b.jpg'],
      species:     [{ image_urls: ['/b.jpg', '/a.jpg'] }],
      guidePhotos: ['/a.jpg'],
    })).toEqual(['/a.jpg', '/b.jpg'])
  })

  it('skips empty values — no hero, blank strings, holders with no photo', () => {
    expect(collectPagePhotos({
      ...EMPTY,
      hero:        '',
      gallery:     ['  ', '/g.jpg'],
      blocks:      [{ image_url: '', image_urls: [] }, { image_url: null, image_urls: null }, {}],
      boats:       [{ image_url: '' }],
      guidePhotos: [''],
    })).toEqual(['/g.jpg'])
  })

  it('is empty for a page with no photos and no guide photos', () => {
    expect(collectPagePhotos(EMPTY)).toEqual([])
  })
})
