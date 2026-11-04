/**
 * FA-1.80 — GET /api/nav-user is per-user data: never cacheable, and the profile
 * row is chosen by the verified session, not by anything the caller sends.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  eq:      vi.fn(),
  row:     { current: null as unknown },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: (col: string, val: string) => {
          h.eq(col, val)
          return { maybeSingle: async () => ({ data: h.row.current }) }
        },
      }),
    }),
  }),
}))

import { GET } from '../route'

beforeEach(() => {
  h.getUser.mockReset()
  h.eq.mockReset()
  h.row.current = null
})

describe('GET /api/nav-user', () => {
  it('signed out → 401, empty body, private no-store, no profile read', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } })

    const res = await GET()

    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.text()).toBe('')
    expect(h.eq).not.toHaveBeenCalled()
  })

  it("signed in angler → the angler's own data, private no-store, looked up by session id", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'angler-1' } } })
    h.row.current = { role: 'angler', full_name: 'Test Angler', avatar_url: null }

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ name: 'Test Angler', role: 'angler', avatarUrl: null })
    expect(h.eq).toHaveBeenCalledWith('id', 'angler-1')
  })

  it('signed in but no profile row → 401, still no-store', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'ghost' } } })

    const res = await GET()

    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('a role the nav does not know is not passed through', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'x' } } })
    h.row.current = { role: 'superuser', full_name: 'X', avatar_url: null }

    expect((await GET()).status).toBe(401)
  })

  it('takes no request input at all — nothing a caller sends can pick the row', () => {
    expect(GET.length).toBe(0)
  })
})
