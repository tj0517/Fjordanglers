import { describe, it, expect } from 'vitest'
import {
  safeHttpUrl, speciesNames, parseLicenseInfo, parseDaySchedule, parseItinerary, languageNames,
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
  it('turns meta into short lines, in a fixed order', () => {
    expect(parseDaySchedule([{ time: '9:00', title: 'Fishing', meta: { wading: 'to the knee', walk_km: 3, drive_min: 45 } }]))
      .toEqual([{ time: '9:00', title: 'Fishing', metaLines: ['45 min drive', '3 km on foot', 'wading: to the knee'] }])
  })
  it('skips a step with no title and tolerates a missing time and meta', () => {
    expect(parseDaySchedule([{ time: '1:00' }, { title: 'Lunch' }]))
      .toEqual([{ time: '', title: 'Lunch', metaLines: [] }])
  })
  it('reads a boolean wading flag', () => {
    expect(parseDaySchedule([{ title: 'x', meta: { wading: true } }])[0]?.metaLines).toEqual(['wading: yes'])
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
