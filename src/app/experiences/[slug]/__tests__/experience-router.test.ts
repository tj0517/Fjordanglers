/**
 * FA-1.52 — /experiences/[slug] template router.
 *
 * Decision table under test (the public page never reads cookies/headers/searchParams,
 * so routing depends on exactly two inputs: the flag and experience_pages.page_version):
 *
 *   flag false, page_version 1 → v1
 *   flag false, page_version 2 → v1   ← rollback is switching the flag off
 *   flag true,  page_version 1 → v1
 *   flag true,  page_version 2 → v2
 *   unknown slug               → v1 (which 404s), never a 500
 *   alias slug                 → permanentRedirect (308) to the canonical slug
 *
 * Plus the preview route: non-admin → notFound(), admin → v2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above every const, so everything they close over
// has to come from vi.hoisted().
const h = vi.hoisted(() => {
  class RedirectError extends Error {}
  class NotFoundError extends Error {}
  return {
    RedirectError,
    NotFoundError,
    // Mutable env so each case can flip the flag — same pattern as the inquiries route tests.
    mockEnv: { EXPERIENCE_V2_ENABLED: false as boolean },
    getExperienceRouting: vi.fn(),
    isAdminRequest: vi.fn(),
    // Marker components — the router's choice is visible in the returned element's type.
    V1: () => null,
    V2: () => null,
    permanentRedirect: vi.fn((url: string) => { throw new RedirectError(url) }),
    notFound: vi.fn(() => { throw new NotFoundError('NEXT_NOT_FOUND') }),
  }
})

const { mockEnv, getExperienceRouting, isAdminRequest, V1, V2, permanentRedirect } = h
const { RedirectError, NotFoundError } = h

vi.mock('@/lib/env', () => ({ env: h.mockEnv }))
vi.mock('@/lib/supabase/queries', () => ({ getExperienceRouting: h.getExperienceRouting }))
vi.mock('@/lib/auth/guards', () => ({ isAdminRequest: h.isAdminRequest }))
vi.mock('../_v1/ExperienceV1', () => ({ default: h.V1, generateMetadata: vi.fn() }))
vi.mock('../_v2/ExperienceV2', () => ({ default: h.V2 }))
vi.mock('next/navigation', () => ({ permanentRedirect: h.permanentRedirect, notFound: h.notFound }))

import ExperiencePublicPage from '../page'
import ExperienceV2PreviewPage from '../preview/page'

type Element = { type: unknown }

async function render(slug: string): Promise<Element> {
  return await ExperiencePublicPage({ params: Promise.resolve({ slug }) }) as unknown as Element
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.EXPERIENCE_V2_ENABLED = false
})

describe('public router — flag × page_version', () => {
  it('flag false + page_version 1 → v1', async () => {
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    expect((await render('salmon-week')).type).toBe(V1)
  })

  it('flag false + page_version 2 → v1 (rollback = flag off)', async () => {
    getExperienceRouting.mockResolvedValue({ pageVersion: 2, canonicalSlug: 'salmon-week' })
    expect((await render('salmon-week')).type).toBe(V1)
  })

  it('flag true + page_version 1 → v1 (the page has not opted in)', async () => {
    mockEnv.EXPERIENCE_V2_ENABLED = true
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    expect((await render('salmon-week')).type).toBe(V1)
  })

  it('flag true + page_version 2 → v2', async () => {
    mockEnv.EXPERIENCE_V2_ENABLED = true
    getExperienceRouting.mockResolvedValue({ pageVersion: 2, canonicalSlug: 'salmon-week' })
    const el = await render('salmon-week')
    expect(el.type).toBe(V2)
    expect(el).toMatchObject({ props: { slug: 'salmon-week' } })
  })

  it('unknown slug → v1 (which calls notFound) — the router itself does not throw', async () => {
    mockEnv.EXPERIENCE_V2_ENABLED = true
    getExperienceRouting.mockResolvedValue(null)
    expect((await render('does-not-exist')).type).toBe(V1)
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})

describe('public router — slug aliases', () => {
  it('alias slug → permanentRedirect (308) to the canonical slug', async () => {
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    await expect(render('old-salmon-week')).rejects.toBeInstanceOf(RedirectError)
    expect(permanentRedirect).toHaveBeenCalledWith('/experiences/salmon-week')
  })

  it('canonical slug → no redirect', async () => {
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    await render('salmon-week')
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('redirect target comes from the database, not the request', async () => {
    // Even a slug that looks like an absolute URL can only ever redirect to the
    // canonical slug the database returned — no open redirect through the path.
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    await expect(render('https://evil.example.com')).rejects.toBeInstanceOf(RedirectError)
    expect(permanentRedirect).toHaveBeenCalledWith('/experiences/salmon-week')
  })
})

describe('preview route — server-side admin check', () => {
  it('non-admin → notFound()', async () => {
    isAdminRequest.mockResolvedValue(false)
    await expect(
      ExperienceV2PreviewPage({ params: Promise.resolve({ slug: 'salmon-week' }) }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(getExperienceRouting).not.toHaveBeenCalled()
  })

  it('admin → v2 skeleton, whatever the flag and page_version say', async () => {
    isAdminRequest.mockResolvedValue(true)
    getExperienceRouting.mockResolvedValue({ pageVersion: 1, canonicalSlug: 'salmon-week' })
    const el = await ExperienceV2PreviewPage({
      params: Promise.resolve({ slug: 'salmon-week' }),
    }) as unknown as Element
    expect(el.type).toBe(V2)
  })

  it('admin + unknown slug → notFound(), not a 500', async () => {
    isAdminRequest.mockResolvedValue(true)
    getExperienceRouting.mockResolvedValue(null)
    await expect(
      ExperienceV2PreviewPage({ params: Promise.resolve({ slug: 'does-not-exist' }) }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
