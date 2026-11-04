import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { BLOG_POSTS } from '@/lib/blog-data'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Static pages ──────────────────────────────────────────────────────────
  const destinationHubPages: MetadataRoute.Sitemap = DESTINATION_HUBS.map(hub => ({
    url:             `${SITE_URL}/${hub.slug}`,
    lastModified:    now,
    changeFrequency: 'weekly' as const,
    priority:        0.85,
  }))

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.00 },
    { url: `${SITE_URL}/trips`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${SITE_URL}/guides`,                  lastModified: now, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${SITE_URL}/blog`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.65 },
    { url: `${SITE_URL}/legal/privacy-policy`,    lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/terms-of-service`,  lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/cookie-policy`,     lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${SITE_URL}/legal/legal-notice`,      lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
  ]

  // ── Blog posts (static data) ───────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map(post => ({
    url:             `${SITE_URL}/blog/${post.slug}`,
    lastModified:    now,
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
        .select('slug, updated_at')
        .eq('status', 'active'),
      db.from('guides')
        .select('id, slug, updated_at')
        .eq('status', 'active')
        .eq('is_hidden', false),
    ])

    experiencePages = (expRes.data ?? []).map(exp => ({
      url:             `${SITE_URL}/experiences/${exp.slug}`,
      lastModified:    exp.updated_at ? new Date(exp.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.95,
    }))

    guidePages = (guideRes.data ?? []).map(guide => ({
      url:             `${SITE_URL}/guides/${(guide as { slug?: string | null }).slug ?? guide.id}`,
      lastModified:    guide.updated_at ? new Date(guide.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.90,
    }))
  } catch {
    // Fail silently — sitemap degrades to static pages only
  }

  return [...staticPages, ...destinationHubPages, ...blogPages, ...experiencePages, ...guidePages]
}
