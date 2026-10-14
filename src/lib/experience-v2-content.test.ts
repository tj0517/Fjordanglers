import { describe, it, expect } from 'vitest'
import {
  safeHttpUrl, speciesNames, parseLicenseInfo, parseDaySchedule, parseItinerary, languageNames,
  parseSeasonPeriods, parseContentBlocks,
} from './experience-v2-content'

describe('safeHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(safeHttpUrl('https://example.com/licence')).toBe('https://example.com/licence')
    expect(safeHttpUrl('http://example.com/')).toBe('http://example.com/')
  })

  it.each([
    'javascript:alert(1)', 'data:text/html,<b>x</b>', 'mailto:a@b.c', 'ftp://example.com',
    '//example.com', 'ask at the post office', '', '   ',
  ])('rejects %j', value => {
    expect(safeHttpUrl(value)).toBeNull()
  })

  it('rejects null and undefined', () => {
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
  })
})

describe('parseLicenseInfo', () => {
  it('reads the documented shape', () => {
    expect(parseLicenseInfo({ required: true, buy_url: 'https://x.test/l', price_text: 'NZ$30', steps: ['a', 'b'] }))
      .toEqual({ required: true, buyUrl: 'https://x.test/l', buyText: null, priceText: 'NZ$30', steps: ['a', 'b'] })
  })

  it('keeps a non-http buy_url as text, never as a URL', () => {
    const info = parseLicenseInfo({ required: true, buy_url: 'javascript:alert(1)' })
    expect(info?.buyUrl).toBeNull()
    expect(info?.buyText).toBe('javascript:alert(1)')
  })

  it('is null for null, a non-object and an object that says nothing', () => {
    expect(parseLicenseInfo(null)).toBeNull()
    expect(parseLicenseInfo('licence')).toBeNull()
    expect(parseLicenseInfo([])).toBeNull()
    expect(parseLicenseInfo({})).toBeNull()
  })

  it('drops non-string steps instead of throwing', () => {
    expect(parseLicenseInfo({ steps: ['ok', 3, null, '  '] })?.steps).toEqual(['ok'])
  })
})

describe('speciesNames', () => {
  it('keeps names in order and skips entries without one', () => {
    expect(speciesNames([{ name: 'Brown trout' }, { description: 'x' }, 'bad', { name: ' Rainbow ' }]))
      .toEqual(['Brown trout', 'Rainbow'])
  })
  it('is empty for anything that is not an array', () => {
    expect(speciesNames(null)).toEqual([])
    expect(speciesNames({ name: 'x' })).toEqual([])
  })
})

describe('parseDaySchedule', () => {
  it('reads time, title and description', () => {
    expect(parseDaySchedule([{ time: '7:30', title: 'Pickup & Briefing', description: 'Guide collects you from your hotel.' }]))
      .toEqual([{ time: '7:30', title: 'Pickup & Briefing', description: 'Guide collects you from your hotel.' }])
  })
  it('reads a legacy row (meta, no description) as having no description — the meta is never shown', () => {
    expect(parseDaySchedule([{ time: '9:00', title: 'Fishing', meta: { wading: 'to the knee', walk_km: 3, drive_min: 45 } }]))
      .toEqual([{ time: '9:00', title: 'Fishing', description: null }])
  })
  it('skips a step with no title and tolerates a missing time and description', () => {
    expect(parseDaySchedule([{ time: '1:00' }, { title: 'Lunch' }, { title: 'Dinner', description: '   ' }]))
      .toEqual([{ time: '', title: 'Lunch', description: null }, { time: '', title: 'Dinner', description: null }])
  })
})

describe('parseSeasonPeriods', () => {
  it('reads periods, sorting their months', () => {
    expect(parseSeasonPeriods([{ title: 'Summer (December – February)', months: [12, 1, 2], text: 'Prime time.' }]))
      .toEqual([{ title: 'Summer (December – February)', months: [1, 2, 12], text: 'Prime time.' }])
  })
  it('gives a month to the first period that claims it and drops it from later ones', () => {
    expect(parseSeasonPeriods([
      { title: 'Summer', months: [12, 1, 2], text: 'a' },
      { title: 'Autumn', months: [2, 3],     text: 'b' },
    ]).map(p => p.months)).toEqual([[1, 2, 12], [3]])
  })
  it('skips what is malformed instead of throwing', () => {
    expect(parseSeasonPeriods([
      { title: 'No months' },
      { months: [5] },
      { title: 'Bad months', months: [0, 13, 4.5, '6'] },
      'not an object',
      { title: 'Kept', months: [6], text: '  ' },
    ])).toEqual([{ title: 'Kept', months: [6], text: null }])
    expect(parseSeasonPeriods(null)).toEqual([])
    expect(parseSeasonPeriods({ title: 'not an array' })).toEqual([])
  })
})

describe('parseContentBlocks — photos', () => {
  it('a legacy block with only image_url is a gallery of one', () => {
    expect(parseContentBlocks([{ headline: 'Lake', text: 't', image_url: '/lake.jpg' }]))
      .toEqual([{ headline: 'Lake', text: 't', imageUrls: ['/lake.jpg'] }])
  })
  it('a block with image_urls keeps them in order, first = cover', () => {
    expect(parseContentBlocks([{ headline: 'Spring Creeks', text: 't', image_urls: ['https://x.example/1.jpg', '/2.jpg'] }])[0]?.imageUrls)
      .toEqual(['https://x.example/1.jpg', '/2.jpg'])
  })
  it('image_urls wins when both are stored', () => {
    expect(parseContentBlocks([{ headline: 'H', text: 't', image_url: '/old.jpg', image_urls: ['/new-1.jpg', '/new-2.jpg'] }])[0]?.imageUrls)
      .toEqual(['/new-1.jpg', '/new-2.jpg'])
  })
  it('drops unsafe or empty photo entries but keeps the block', () => {
    expect(parseContentBlocks([{ headline: 'H', text: null, image_urls: ['javascript:alert(1)', '', 42, '/ok.jpg'] }]))
      .toEqual([{ headline: 'H', text: null, imageUrls: ['/ok.jpg'] }])
    expect(parseContentBlocks([{ headline: 'H', text: 't' }])[0]?.imageUrls).toEqual([])
  })
})

describe('parseItinerary', () => {
  it('keeps only the detail fields that have text', () => {
    expect(parseItinerary([{ day: 2, title: 'Beat 3', meals: 'Lunch', lodging: '', notes: null }]))
      .toEqual([{ day: 2, title: 'Beat 3', details: [{ label: 'Meals', value: 'Lunch' }] }])
  })
  it('numbers a day that has no number by its position', () => {
    expect(parseItinerary([{ title: 'A' }, { title: 'B' }]).map(d => d.day)).toEqual([1, 2])
  })
})

describe('languageNames', () => {
  it('turns ISO codes into English names', () => {
    expect(languageNames(['en', 'is', 'pl'])).toEqual(['English', 'Icelandic', 'Polish'])
  })
  it('prints a value it does not recognise as stored, and skips blanks', () => {
    expect(languageNames(['English', ' ', 'xx-not-a-code!'])).toEqual(['English', 'xx-not-a-code!'])
  })
})
