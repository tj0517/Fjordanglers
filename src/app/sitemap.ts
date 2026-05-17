import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { BLOG_POSTS } from '@/lib/blog-data'
import { FISH_CATALOG } from '@/lib/fish'

export const revalidate = 3600

const BASE = 'https://fjordanglers.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Static pages ──────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/trips`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/guides`,                  lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/guides/apply`,            lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/legal/privacy-policy`,    lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/legal/terms-of-service`,  lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/legal/cookie-policy`,     lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // ── Species pages (from static catalog) ───────────────────────────────────
  const speciesPages: MetadataRoute.Sitemap = FISH_CATALOG.map(fish => ({
    url:             `${BASE}/species/${fish.slug}`,
    lastModified:    now,
    changeFrequency: 'monthly' as const,
    priority:        0.6,
  }))

  // ── Blog posts (static data) ───────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map(post => ({
    url:             `${BASE}/blog/${post.slug}`,
    lastModified:    now,
    changeFrequency: 'monthly' as const,
    priority:        0.6,
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
        .select('id, updated_at')
        .eq('status', 'active')
        .eq('is_hidden', false),
    ])

    experiencePages = (expRes.data ?? []).map(exp => ({
      url:             `${BASE}/experiences/${exp.slug}`,
      lastModified:    exp.updated_at ? new Date(exp.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.85,
    }))

    guidePages = (guideRes.data ?? []).map(guide => ({
      url:             `${BASE}/guides/${guide.id}`,
      lastModified:    guide.updated_at ? new Date(guide.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    }))
  } catch {
    // Fail silently — sitemap degrades to static pages only
  }

  return [...staticPages, ...speciesPages, ...blogPages, ...experiencePages, ...guidePages]
}
