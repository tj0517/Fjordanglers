/**
 * FA-1.87 — which referrer host the beacon sends (tj decision 2026-11-12, point 1):
 * the page the document was loaded with reports `document.referrer`; once the visitor moves
 * to another page by a link inside the site (client-side navigation, document.referrer
 * unchanged), every event reports our own host — including a return to the landing path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const sent: Record<string, unknown>[] = []

async function freshModule(loadPath: string, referrer: string) {
  vi.resetModules()
  sent.length = 0
  vi.stubGlobal('document', { referrer })
  vi.stubGlobal('window', { location: { hostname: 'www.fjordanglers.com' } })
  vi.stubGlobal('performance', { getEntriesByType: () => [{ name: `https://www.fjordanglers.com${loadPath}?gclid=x` }] })
  vi.stubGlobal('navigator', {
    sendBeacon: (_url: string, blob: Blob) => {
      void blob.text().then(t => sent.push(JSON.parse(t) as Record<string, unknown>))
      return true
    },
  })
  return import('./web-events')
}

const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => { sent.length = 0 })
afterEach(() => { vi.unstubAllGlobals() })

describe('sendWebEvent — referrer_host', () => {
  it('landing page: the outside referrer, reduced to its host', async () => {
    const { sendWebEvent } = await freshModule('/norway', 'https://www.google.com/search?q=salmon')
    sendWebEvent({ event: 'page_view', path: '/norway' })
    sendWebEvent({ event: 'form_open', path: '/norway' })
    await flush()
    expect(sent.map(e => e.referrer_host)).toEqual(['www.google.com', 'www.google.com'])
  })

  it('after an in-site navigation: our own host, also back on the landing path', async () => {
    const { sendWebEvent } = await freshModule('/', 'https://www.google.com/')
    sendWebEvent({ event: 'page_view', path: '/' })
    sendWebEvent({ event: 'page_view', path: '/experiences/gaula' })
    sendWebEvent({ event: 'form_submit', path: '/experiences/gaula' })
    sendWebEvent({ event: 'page_view', path: '/' })
    await flush()
    expect(sent.map(e => e.referrer_host)).toEqual(
      ['www.google.com', 'www.fjordanglers.com', 'www.fjordanglers.com', 'www.fjordanglers.com'],
    )
  })

  it('the first tracked page is not the landing page (landed on an untracked page) → own host', async () => {
    const { sendWebEvent } = await freshModule('/', 'https://l.instagram.com/')
    sendWebEvent({ event: 'page_view', path: '/trips' })
    await flush()
    expect(sent[0]?.referrer_host).toBe('www.fjordanglers.com')
  })

  it('no referrer → the field is left out (stored as NULL)', async () => {
    const { sendWebEvent } = await freshModule('/norway', '')
    sendWebEvent({ event: 'page_view', path: '/norway' })
    await flush()
    expect(sent[0]).not.toHaveProperty('referrer_host')
  })
})
