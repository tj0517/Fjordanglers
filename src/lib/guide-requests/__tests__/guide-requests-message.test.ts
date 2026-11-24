/**
 * FA-M.05 — the WhatsApp text for a guide request and its wa.me link (no network).
 * Wording per docs/design/fa-m-guide-app/Push.dc.html; no client budget or name.
 */
import { describe, it, expect } from 'vitest'
import { buildGuideRequestMessage, shortDates, waMeUrl } from '../send'

const LINK = `https://www.fjordanglers.com/r/${'A'.repeat(43)}`

describe('shortDates', () => {
  it.each([
    [[], 'flexible dates'],
    [['2027-01-14'], '14 Jan'],
    [['2027-01-15', '2027-01-14'], '14–15 Jan'],
    [['2027-01-30', '2027-01-31', '2027-02-01'], '30 Jan – 1 Feb'],
    [['2027-06-12', '2027-06-14'], '12 Jun, 14 Jun'],
  ])('%j → %s', (dates, expected) => {
    expect(shortDates(dates)).toBe(expected)
  })
})

describe('buildGuideRequestMessage', () => {
  it('greets the guide by first name and carries area, dates, party size and the link', () => {
    const text = buildGuideRequestMessage({ guideFirstName: 'Josh', partySize: 2, area: 'Taupō', dates: ['2027-01-14', '2027-01-15'], link: LINK })
    expect(text).toBe([
      'Hi Josh,',
      '',
      'New request · Taupō, 14–15 Jan',
      '2 anglers. Tap to accept, decline or suggest dates:',
      LINK,
      '',
      'FjordAnglers',
    ].join('\n'))
  })

  it('one angler, unknown area and name', () => {
    const text = buildGuideRequestMessage({ guideFirstName: null, partySize: 1, area: null, dates: [], link: LINK })
    expect(text).toContain('Hi,\n')
    expect(text).toContain('New request · flexible dates')
    expect(text).toContain('1 angler. Tap')
  })
})

describe('waMeUrl', () => {
  it('uses the E.164 digits without + and URL-encodes the text', () => {
    const url = new URL(waMeUrl('+64211234567', 'Hi Josh,\nNew request · Taupō'))
    expect(url.host).toBe('wa.me')
    expect(url.pathname).toBe('/64211234567')
    expect(url.searchParams.get('text')).toBe('Hi Josh,\nNew request · Taupō')
  })

  it.each(['64211234567', '+64 21 123', 'javascript:alert(1)', '+64211234567/evil'])('refuses an unvalidated number %j', bad => {
    expect(() => waMeUrl(bad, 'x')).toThrow()
  })
})
