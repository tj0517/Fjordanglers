// @vitest-environment jsdom
/**
 * FA-1.80 — the nav is a cached, signed-out shell plus a client island:
 *   no local session → signed-out nav, /api/nav-user never called
 *   local session    → same-size placeholder, then the user's menu
 *   endpoint 401     → back to signed-out
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: h.getSession } }),
}))
vi.mock('@/actions/auth', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/iceland' }))
vi.mock('next/image', () => ({ default: () => null }))

import { SiteNav } from '../nav'

const fetchMock = vi.fn()

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  h.getSession.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SiteNav', () => {
  it('signed out: no account menu, no placeholder, no profile request', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } })

    render(<SiteNav />)
    await waitFor(() => expect(h.getSession).toHaveBeenCalled())

    expect(screen.queryByLabelText('Account menu')).toBeNull()
    expect(screen.queryByTestId('nav-user-placeholder')).toBeNull()
    expect(screen.getAllByText('Explore trips →').length).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signed in: placeholder while the profile loads, then the account menu', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
    let release: (v: unknown) => void = () => {}
    fetchMock.mockReturnValue(new Promise(r => { release = r }))

    render(<SiteNav />)

    expect(await screen.findByTestId('nav-user-placeholder')).toBeTruthy()
    expect(screen.queryByLabelText('Account menu')).toBeNull()

    release({ ok: true, status: 200, json: async () => ({ name: 'Test Admin', role: 'admin', avatarUrl: null }) })

    expect(await screen.findByLabelText('Account menu')).toBeTruthy()
    expect(screen.queryByTestId('nav-user-placeholder')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/nav-user', expect.objectContaining({ cache: 'no-store' }))
  })

  it('signed in but the endpoint says 401 (stale session): back to the signed-out nav', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
    respond(401)

    render(<SiteNav />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('nav-user-placeholder')).toBeNull())
    expect(screen.queryByLabelText('Account menu')).toBeNull()
  })

  it('network failure while loading: back to the signed-out nav', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
    fetchMock.mockRejectedValue(new Error('offline'))

    render(<SiteNav />)

    await waitFor(() => expect(screen.queryByTestId('nav-user-placeholder')).toBeNull())
    expect(screen.queryByLabelText('Account menu')).toBeNull()
  })
})
