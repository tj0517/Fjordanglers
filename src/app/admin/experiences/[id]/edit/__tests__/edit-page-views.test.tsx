/**
 * FA-1.64 (scope addition, tj 2026-10-23) — the edit page hands the page's Views to the form.
 *
 * Until now `initialData` had no `views_image_urls`, so Views opened empty and every
 * "Save changes" wrote [] over the stored views (since eb4f2b62, 2026-05-28). Proven here on the
 * loader itself: the stored views reach `ExperiencePageForm`, and a page without views gets [].
 */

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'

const h = vi.hoisted(() => ({ page: {} as Record<string, unknown> }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => {
    const query = (table: string) => {
      const result = table === 'experience_pages' ? { data: h.page } : { data: [] }
      const chain = {
        select: () => chain,
        eq:     () => chain,
        order:  () => chain,
        single: async () => result,
        then:   (resolve: (r: typeof result) => unknown) => resolve(result),
      }
      return chain
    }
    return { from: query }
  },
}))
vi.mock('@/actions/experience-pages', () => ({ getExperienceV2Editor: async () => ({}) }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('@/components/admin/ExperiencePageForm', () => ({ default: () => null }))
vi.mock('@/components/admin/ExperienceEditTabs', () => ({ ExperienceEditTabs: () => null }))
vi.mock('@/components/admin/experience-v2-editor/ExperienceV2Editor', () => ({ ExperienceV2Editor: () => null }))

import AdminExperienceEditPage from '../page'
import ExperiencePageForm from '@/components/admin/ExperiencePageForm'

/** The `ExperiencePageForm` element the page renders (inside the tabs' `pageForm` prop). */
function findForm(node: unknown): ReactElement<{ initialData: { views_image_urls?: string[] } }> | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) return node.map(findForm).find(f => f != null) ?? null
  const el = node as ReactElement<Record<string, unknown>>
  if (el.type === ExperiencePageForm) return el as ReactElement<{ initialData: { views_image_urls?: string[] } }>
  return Object.values(el.props ?? {}).map(findForm).find(f => f != null) ?? null
}

async function formFor(page: Record<string, unknown>) {
  h.page = { id: 'p1', experience_name: 'Test page', slug: 'test-page', price_from: 100, ...page }
  const tree = await AdminExperienceEditPage({ params: Promise.resolve({ id: 'p1' }) })
  const form = findForm(tree)
  if (form == null) throw new Error('ExperiencePageForm not rendered')
  return form.props.initialData
}

describe('admin experience edit page — Views reach the form', () => {
  it('passes the stored views to the form, so a save keeps them', async () => {
    const initialData = await formFor({ views_image_urls: ['/v1.jpg', '/v2.jpg'] })
    expect(initialData.views_image_urls).toEqual(['/v1.jpg', '/v2.jpg'])
  })

  it('a page with no views gets an empty list', async () => {
    const initialData = await formFor({ views_image_urls: null })
    expect(initialData.views_image_urls).toEqual([])
  })
})
