import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FA-1.91 — a dead offer link (unknown or expired token) answers 404 through notFound(),
 * a valid one still renders. The page function is called directly; notFound() is mocked to
 * throw a sentinel the way Next's own throws a 404 signal.
 */

const NOT_FOUND = new Error('NEXT_NOT_FOUND')
const notFound = vi.fn((): never => { throw NOT_FOUND })
const getOfferByToken = vi.fn()

vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('@/actions/inquiries', () => ({ getOfferByToken: (t: string) => getOfferByToken(t) }))
vi.mock('./OfferPayButton', () => ({ OfferPayButton: () => null }))
vi.mock('./OfferOptionsPanel', () => ({ OfferOptionsPanel: () => null }))
vi.mock('@/components/offer/OfferLocationMap', () => ({ OfferLocationMap: () => null }))
vi.mock('@/lib/fx', () => ({
  currencyForCountry: () => 'EUR',
  fetchEurRate: async () => 1,
  fmtConverted: () => '',
}))

import OfferPage, { metadata } from './page'

const params = (token: string) => ({ params: Promise.resolve({ token }) })

beforeEach(() => {
  notFound.mockClear()
  getOfferByToken.mockReset()
})

describe('/offers/[token]', () => {
  it('calls notFound() when the lookup is null (unknown or expired token)', async () => {
    getOfferByToken.mockResolvedValue(null)
    await expect(OfferPage(params('test-token'))).rejects.toBe(NOT_FOUND)
    expect(getOfferByToken).toHaveBeenCalledWith('test-token')
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('still renders for a valid token and does not call notFound()', async () => {
    getOfferByToken.mockResolvedValue({ status: 'paid' })
    const el = await OfferPage(params('test-token'))
    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('is noindex', () => {
    expect(metadata.robots).toEqual({ index: false })
  })
})
