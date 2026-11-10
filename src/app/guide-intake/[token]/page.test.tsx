import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FA-1.91 — a dead guide-intake link (unknown or inactive form) answers 404 through
 * notFound(), a valid one still renders.
 */

const NOT_FOUND = new Error('NEXT_NOT_FOUND')
const notFound = vi.fn((): never => { throw NOT_FOUND })
const getFormByToken = vi.fn()

vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('@/actions/guide-forms', () => ({ getFormByToken: (t: string) => getFormByToken(t) }))
vi.mock('./IntakeFormClient', () => ({ IntakeFormClient: () => null }))

import GuideIntakePage, { metadata } from './page'

const params = (token: string) => ({ params: Promise.resolve({ token }) })

beforeEach(() => {
  notFound.mockClear()
  getFormByToken.mockReset()
})

describe('/guide-intake/[token]', () => {
  it('calls notFound() when the lookup is null (unknown or inactive form)', async () => {
    getFormByToken.mockResolvedValue(null)
    await expect(GuideIntakePage(params('test-token'))).rejects.toBe(NOT_FOUND)
    expect(getFormByToken).toHaveBeenCalledWith('test-token')
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('still renders for a valid token and does not call notFound()', async () => {
    getFormByToken.mockResolvedValue({
      id: 'f1', title: 'Fixture form', description: null, token: 'test-token', questions: [],
    })
    const el = await GuideIntakePage(params('test-token'))
    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('is noindex', () => {
    expect(metadata.robots).toEqual({ index: false })
  })
})
