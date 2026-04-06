import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { BLOG_POSTS } from '@/lib/blog-data'

export const revalidate = 3600

const BASE = 'https://fjordanglers.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Static pages ──────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                         lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/trips`,              lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/guides`,             lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/blog`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/guides/apply`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  // ── Blog posts (static data) ───────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map(post => ({
    url:             `${BASE}/blog/${post.slug}`,
    lastModified:    now,
    changeFrequency: 'monthly' as const,
    priority:        0.6,
  }))

  // ── Dynamic: published experiences & active guides ────────────────────────
  let experiencePages: MetadataRoute.Sitemap = []
  let guidePages: MetadataRoute.Sitemap = []

  try {
    const db = createServiceClient()

    const [expRes, guideRes] = await Promise.all([
      db.from('experiences')
        .select('id, updated_at')
        .eq('published', true)
        .eq('is_hidden', false),
      db.from('guides')
        .select('id, updated_at')
        .eq('status', 'active')
        .eq('is_hidden', false),
    ])

    experiencePages = (expRes.data ?? []).map(exp => ({
      url:             `${BASE}/trips/${exp.id}`,
      lastModified:    exp.updated_at ? new Date(exp.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority:        0.8,
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

  return [...staticPages, ...blogPages, ...experiencePages, ...guidePages]
}
