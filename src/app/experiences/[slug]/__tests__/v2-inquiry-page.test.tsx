/**
 * FA-1.55 — the inquiry form always files against the canonical page, never an alias.
 *
 * Two facts together make that true, and both are checked here:
 *
 *   1. a retired slug never reaches the template at all — `page.tsx` 308s to the canonical
 *      slug first (FA-1.52), so no render of the form ever sees an alias;
 *   2. the form is handed `getExperienceV2(canonicalSlug).id` — the page row's own id — and
 *      not the slug it was asked for.
 *
 * If (1) were ever dropped, (2) would still hold only if `getExperienceV2` resolved aliases,
 * which it does not: it filters on `slug` directly. That is exactly why the redirect is the
 * thing under test and not an implementation detail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

const h = vi.hoisted(() => {
  class RedirectError extends Error {}
  return {
    RedirectError,
    mockEnv: {
      EXPERIENCE_V2_ENABLED:        true as boolean,
      NEXT_PUBLIC_WHATSAPP_NUMBER:  '48600100200',
    },
    getExperienceRouting: vi.fn(),
    getExperienceV2:      vi.fn(),
    permanentRedirect:    vi.fn((url: string) => { throw new RedirectError(url) }),
    notFound:             vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  }
})

vi.mock('@/lib/env', () => ({ env: h.mockEnv }))
vi.mock('@/lib/supabase/queries', () => ({
  getExperienceRouting: h.getExperienceRouting,
  getExperienceV2:      h.getExperienceV2,
}))
vi.mock('@/lib/fx', () => ({ fetchIndicativeRates: async () => ({}) }))
vi.mock('next/navigation', () => ({ permanentRedirect: h.permanentRedirect, notFound: h.notFound }))
vi.mock('../_v1/ExperienceV1', () => ({ default: () => null, generateMetadata: vi.fn() }))
// The site frame reads the session and the destination list; neither is what this test is about.
vi.mock('@/components/layout/nav-with-user', () => ({ NavWithUser: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))

import ExperiencePublicPage from '../page'
import ExperienceV2 from '../_v2/ExperienceV2'
import { fixedPage } from '@/components/experience-v2/v2-page.fixture'

const CANONICAL = 'seed-backcountry-day-nz'
const ALIAS     = 'otago-sight-fishing-2024'
const PAGE_ID   = 'aaaaaaaa-1111-2222-3333-444444444444'

/** The props of the first `InquiryWizardProvider` in the rendered tree. */
function wizardPageProps(tree: ReactElement): { experiencePageId: string } {
  const found = find(tree)
  if (found == null) throw new Error('InquiryWizardProvider not found in the rendered tree')
  return found

  function find(node: unknown): { experiencePageId: string } | null {
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = find(child)
        if (hit != null) return hit
      }
      return null
    }
    if (typeof node !== 'object' || node === null) return null
    const element = node as { type?: unknown; props?: Record<string, unknown> }
    const name = typeof element.type === 'function' ? element.type.name : null
    if (name === 'InquiryWizardProvider') {
      return element.props?.page as { experiencePageId: string }
    }
    return element.props == null ? null : find(element.props.children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.mockEnv.EXPERIENCE_V2_ENABLED = true
  h.getExperienceV2.mockImplementation(async (slug: string) =>
    slug === CANONICAL ? fixedPage({ id: PAGE_ID, slug: CANONICAL }) : null,
  )
})

describe('an alias slug never renders the form', () => {
  it('308s to the canonical slug before the template is chosen', async () => {
    h.getExperienceRouting.mockResolvedValue({ pageVersion: 2, canonicalSlug: CANONICAL })

    await expect(ExperiencePublicPage({ params: Promise.resolve({ slug: ALIAS }) }))
      .rejects.toThrow(h.RedirectError)
    expect(h.permanentRedirect).toHaveBeenCalledWith(`/experiences/${CANONICAL}`)
    // The template — and therefore the form — was never reached with the alias.
    expect(h.getExperienceV2).not.toHaveBeenCalled()
  })

  it('renders the template, not a redirect, when the slug is already canonical', async () => {
    h.getExperienceRouting.mockResolvedValue({ pageVersion: 2, canonicalSlug: CANONICAL })

    await ExperiencePublicPage({ params: Promise.resolve({ slug: CANONICAL }) })
    expect(h.permanentRedirect).not.toHaveBeenCalled()
  })
})

describe('the form is filed against the page row, not the slug', () => {
  it('hands the wizard the canonical page id', async () => {
    const tree = await ExperienceV2({ slug: CANONICAL }) as ReactElement
    expect(wizardPageProps(tree).experiencePageId).toBe(PAGE_ID)
    expect(h.getExperienceV2).toHaveBeenCalledWith(CANONICAL)
    expect(h.getExperienceV2).not.toHaveBeenCalledWith(ALIAS)
  })

  it('reads the page once for the whole template', async () => {
    await ExperienceV2({ slug: CANONICAL })
    expect(h.getExperienceV2).toHaveBeenCalledTimes(1)
  })
})
