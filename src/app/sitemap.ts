import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { getIndexableBlogPosts, parseBlogPostDate } from '@/lib/blog-articles'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { SITE_URL } from '@/lib/site'
import { guideProfilePath } from '@/lib/guide-url'

export const revalidate = 3600

/**
 * `lastModified` is only ever a real modification date (FA-1.88): the row's
 * `updated_at`, or the blog post's own date. No date → no field. Never "now" —
 * a sitemap that re-dates every URL on every fetch teaches crawlers to ignore `lastmod`.
 */
function lastModifiedFrom(date: Date | string | null | undefined): Pick<MetadataRoute.Sitemap[number], 'lastModified'> {
  if (date == null) return {}
  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? {} : { lastModified: d }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static pages (no real modification date → no lastModified) ────────────
  const destinationHubPages: MetadataRoute.Sitemap = DESTINATION_HUBS.map(hub => ({
    url:             `${SITE_URL}/${hub.slug}`,
    changeFrequency: 'weekly' as const,
    priority:        0.85,
  }))

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                              changeFrequency: 'weekly',  priority: 1.00 },
    { url: `${SITE_URL}/trips`,                   changeFrequency: 'daily',   priority: 0.90 },
    { url: `${SITE_URL}/guides`,                  changeFrequency: 'daily',   priority: 0.90 },
    { url: `${SITE_URL}/blog`,                    changeFrequency: 'weekly',  priority: 0.65 },
    { url: `${SITE_URL}/legal/privacy-policy`,    changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/terms-of-service`,  changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/cookie-policy`,     changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/legal-notice`,      changeFrequency: 'monthly', priority: 0.30 },
  ]

  // ── Blog posts (static data; stubs are noindex, so they are not listed) ───
  const blogPages: MetadataRoute.Sitemap = getIndexableBlogPosts().map(post => ({
    url:             `${SITE_URL}/blog/${post.slug}`,
    ...lastModifiedFrom(parseBlogPostDate(post.date)),
    changeFrequency: 'monthly' as const,
    priority:        0.65,
  }))

  // ── Dynamic: active experience pages & active guides ─────────────────────
  let experiencePages: MetadataRoute.Sitemap = []
  let guidePages: MetadataRoute.Sitemap = []

  try {
    const db = createServiceClient()

    const [expRes, guideRes] = await Promise.all([
      db.from('experience_pages')
        .select('slug, updated_at, guide_id')
        .eq('status', 'active'),
      db.from('guides')
        .select('id, slug, updated_at')
        .eq('status', 'active')
        .eq('is_hidden', false),
    ])

    experiencePages = (expRes.data ?? []).map(exp => ({
      url:             `${SITE_URL}/experiences/${exp.slug}`,
      ...lastModifiedFrom(exp.updated_at),
      changeFrequency: 'weekly' as const,
      priority:        0.95,
    }))

    // A profile is listed only with a slug (never a UUID) and with at least one active offer —
    // a profile without one is noindex, so it stays out of the sitemap too (FA-1.86, tj D3).
    const guidesWithOffer = new Set((expRes.data ?? []).map(exp => exp.guide_id))
    guidePages = (guideRes.data ?? []).flatMap(guide => {
      const path = guideProfilePath(guide)
      if (path == null || !guidesWithOffer.has(guide.id)) return []
      return [{
        url:             `${SITE_URL}${path}`,
        ...lastModifiedFrom(guide.updated_at),
        changeFrequency: 'weekly' as const,
        priority:        0.90,
      }]
    })
  } catch {
    // Fail silently — sitemap degrades to static pages only
  }

  return [...staticPages, ...destinationHubPages, ...blogPages, ...experiencePages, ...guidePages]
}
