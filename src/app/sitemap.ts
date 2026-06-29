import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { BLOG_POSTS } from '@/lib/blog-data'

export const revalidate = 3600

const BASE = 'https://fjordanglers.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Static pages ──────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.00 },
    { url: `${BASE}/trips`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${BASE}/guides`,                  lastModified: now, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${BASE}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${BASE}/blog`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.65 },
    { url: `${BASE}/legal/privacy-policy`,    lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${BASE}/legal/terms-of-service`,  lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${BASE}/legal/cookie-policy`,     lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${BASE}/legal/legal-notice`,      lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
  ]

  // ── Blog posts (static data) ───────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map(post => ({
    url:             `${BASE}/blog/${post.slug}`,
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
      url:             `${BASE}/experiences/${exp.slug}`,
      lastModified:    exp.updated_at ? new Date(exp.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.95,
    }))

    guidePages = (guideRes.data ?? []).map(guide => ({
      url:             `${BASE}/guides/${(guide as { slug?: string | null }).slug ?? guide.id}`,
      lastModified:    guide.updated_at ? new Date(guide.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.90,
    }))
  } catch {
    // Fail silently — sitemap degrades to static pages only
  }

  return [...staticPages, ...blogPages, ...experiencePages, ...guidePages]
}
