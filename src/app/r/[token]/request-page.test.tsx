import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

/**
 * FA-M.04 — what the server renders for `/r/[token]`.
 *
 * The page function is called directly with the data layer mocked; notFound() throws a sentinel
 * the way Next's own does. Markup is what `curl` would receive (no effects run), so it also proves
 * that rendering never calls the "opened" action (D1 a).
 */

const NOT_FOUND = new Error('NEXT_NOT_FOUND')
const notFound = vi.fn((): never => { throw NOT_FOUND })
const getGuideRequestPage = vi.fn()
const markRequestOpened = vi.fn()
const submitRequestAnswer = vi.fn()
let pathname = '/'

vi.mock('next/navigation', () => ({ notFound: () => notFound(), usePathname: () => pathname }))
vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => <script data-next-script={id ?? src} />,
}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/guide-requests/page', () => ({
  getGuideRequestPage: (_c: unknown, t: string) => getGuideRequestPage(t),
}))
vi.mock('./actions', () => ({
  markRequestOpened: (t: string) => markRequestOpened(t),
  submitRequestAnswer: (t: string, i: unknown) => submitRequestAnswer(t, i),
}))

import RequestPage, { metadata } from './page'
import RequestNotFound from './not-found'
import { GoogleTags } from '@/components/analytics/GoogleTags'
import { THIRD_PARTY_FREE_ROUTES } from '@/lib/analytics/third-party-free-routes'
import { briefSummaryLines, guideBriefSummaryLines, type Brief } from '@/lib/inquiries/brief'

const TOKEN = 'A'.repeat(43)
const params = (token: string) => ({ params: Promise.resolve({ token }) })

const VIEW = {
  country: 'Iceland', region: 'South-West', partySize: 3,
  requestedDates: ['2027-06-12', '2027-06-13', '2027-06-14'],
  brief: ['When: 12 Jun 2027 – 14 Jun 2027 (3 day(s) fishing)', 'Party: 3 angler(s)'],
  earliestAltDate: '2026-11-17',
  answered: null,
  accommodation: null,
  licence: null,
  faNote: null,
}

const TRIP_BRIEF = {
  accommodation: 'Client books — Tūrangi',
  licence:       'Client buys — Taupō licence',
  faNote:        'They land in Taupō the evening before.\nPick-up from Tūrangi if possible.',
}

beforeEach(() => {
  notFound.mockClear()
  getGuideRequestPage.mockReset()
  markRequestOpened.mockReset()
  submitRequestAnswer.mockReset()
  pathname = '/'
})

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await RequestPage(params(TOKEN)) as ReactElement)
}

describe('/r/[token] — a valid link', () => {
  it('shows country · region, the client dates, the group and the brief, and the three answers', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: VIEW })
    const html = await renderPage()
    expect(html).toContain('Iceland · South-West')
    expect(html).toContain('12 Jun – 14 Jun 2027 · 3 days')
    expect(html).toContain('3 anglers')
    expect(html).toContain('Party: 3 angler(s)')
    for (const label of ['Accept', 'Other dates', 'Decline']) expect(html).toContain(label)
    expect(notFound).not.toHaveBeenCalled()
  })

  it('country only when there is no trip page; "flexible" when the client gave no dates', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, region: null, requestedDates: [], brief: null } })
    const html = await renderPage()
    expect(html).toContain('>Iceland<')
    expect(html).toContain('No dates yet — flexible')
    expect(html).not.toContain('From the client')
  })

  it('a later visit shows the stored answer instead of the buttons', async () => {
    getGuideRequestPage.mockResolvedValue({
      ok: true,
      view: { ...VIEW, answered: { answer: 'other_dates', altDates: ['2027-07-01'], note: null, answeredAt: '2026-11-16T10:00:00Z' } },
    })
    const html = await renderPage()
    expect(html).toContain('You proposed other dates')
    expect(html).toContain('Thu, 1 Jul 2027')
    expect(html).not.toContain('>Accept<')
  })

  it('renders a note as text, never as HTML', async () => {
    getGuideRequestPage.mockResolvedValue({
      ok: true,
      view: { ...VIEW, answered: { answer: 'declined', altDates: [], note: '<img src=x onerror=alert(1)>', answeredAt: '2026-11-16T10:00:00Z' } },
    })
    const html = await renderPage()
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('red proof (D1 a): rendering the page does not call the "opened" action', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: VIEW })
    await renderPage()
    expect(markRequestOpened).not.toHaveBeenCalled()
  })

  it('is noindex, nofollow, no-referrer', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe('no-referrer')
  })
})

describe('/r/[token] — the Trip Brief (FA-M.07)', () => {
  it('an inquiry without a form brief shows the Accommodation and Licence rows and the note from FA', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, brief: null, ...TRIP_BRIEF } })
    const html = await renderPage()
    expect(html).not.toContain('From the client')
    expect(html).toContain('About the client')
    expect(html).toMatch(/<dt[^>]*>Accommodation<\/dt><dd[^>]*>Client books — Tūrangi<\/dd>/)
    expect(html).toMatch(/<dt[^>]*>Licence<\/dt><dd[^>]*>Client buys — Taupō licence<\/dd>/)
    expect(html).toContain('Note from FjordAnglers')
    expect(html).toContain('They land in Taupō the evening before.')
  })

  it('with a form brief, both show', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, ...TRIP_BRIEF } })
    const html = await renderPage()
    expect(html).toContain('Party: 3 angler(s)')
    expect(html).toContain('Client buys — Taupō licence')
  })

  it('an empty Trip Brief renders no empty rows and no note block', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: VIEW })
    const html = await renderPage()
    for (const text of ['About the client', 'Accommodation', 'Licence', 'Note from FjordAnglers', 'request-trip-brief', 'request-fa-note']) {
      expect(html, text).not.toContain(text)
    }
  })

  it('only one row when only one value is set', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, licence: 'No licence needed' } })
    const html = await renderPage()
    expect(html).toContain('No licence needed')
    expect(html).not.toContain('Accommodation')
    expect(html).not.toContain('Note from FjordAnglers')
  })

  it('renders the FA note, accommodation and licence as text, never as HTML', async () => {
    const x = '<img src=x onerror=alert(1)>'
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, accommodation: x, licence: x, faNote: x } })
    const html = await renderPage()
    expect(html).not.toContain('<img src=x')
    expect(html.split('&lt;img src=x').length - 1).toBe(3)
  })

  it('no budget and no price on the page', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: true, view: { ...VIEW, ...TRIP_BRIEF } })
    const html = await renderPage()
    expect(html).not.toMatch(/budget|price|€|EUR|ISK|NZD/i)
  })
})

describe('/r/[token] — a refused link', () => {
  it('calls notFound() for any refusal (the data layer gives no reason)', async () => {
    getGuideRequestPage.mockResolvedValue({ ok: false })
    await expect(RequestPage(params(TOKEN))).rejects.toBe(NOT_FOUND)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('the refusal page says the link expired, points to WhatsApp and shows no request data', () => {
    const html = renderToStaticMarkup(<RequestNotFound />)
    expect(html).toContain('This link has expired')
    expect(html).toContain('https://wa.me/')
    expect(html).not.toMatch(/party|brief|guests|\banglers?\b|Iceland|Where|Accept/i)
  })
})

describe('guide brief (D2 a) — no budget lines; the FA summary keeps them', () => {
  const brief: Brief = {
    dates_mode: 'exact', date_from: '2027-06-12', date_to: '2027-06-14', days: 3,
    anglers: 3, non_anglers: 0, skill_level: 3, priority: 'trophy', fitness: 'mid', wading_ok: true,
    budget_ack: true, budget_band: 'EUR:200000-300000',
  }

  it('guideBriefSummaryLines drops "Budget band" and "Budget: confirmed …"', () => {
    const lines = guideBriefSummaryLines(brief)
    expect(lines.some(l => l.startsWith('Budget band'))).toBe(false)
    expect(lines.some(l => l.startsWith('Budget:'))).toBe(false)
    expect(guideBriefSummaryLines({ ...brief, budget_ack: false }).some(l => l.startsWith('Budget'))).toBe(false)
    expect(lines).toContain('Party: 3 angler(s)')
  })

  it('briefSummaryLines (admin, auto-reply) is unchanged and still carries both', () => {
    const lines = briefSummaryLines(brief)
    expect(lines.some(l => l.startsWith('Budget band:'))).toBe(true)
    expect(lines).toContain('Budget: confirmed the price shown on the page')
    expect(lines.slice(0, guideBriefSummaryLines(brief).length)).toEqual(guideBriefSummaryLines(brief))
  })
})

describe('Google tags (D1 a) — not on /r/…, still on normal pages', () => {
  const google = /gtm-init|googletagmanager\.com|google-ads/

  it('/r/<token> renders neither the Ads tag nor GTM', () => {
    pathname = `/r/${TOKEN}`
    expect(renderToStaticMarkup(<GoogleTags gtmId="GTM-TEST" />)).not.toMatch(google)
  })

  it('/ renders the Ads tag and GTM', () => {
    pathname = '/'
    const html = renderToStaticMarkup(<GoogleTags gtmId="GTM-TEST" />)
    expect(html).toContain('data-next-script="gtm-init"')
    expect(html).toContain('data-next-script="https://www.googletagmanager.com/gtag/js?id=AW-18171634204"')
    expect(html).toContain('data-next-script="google-ads"')
  })

  it('/r is on the excluded list as a prefix (the constant every token page must be on)', () => {
    expect(THIRD_PARTY_FREE_ROUTES).toContain('/r/')
  })
})
