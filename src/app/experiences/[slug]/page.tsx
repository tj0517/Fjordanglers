/**
 * /experiences/[slug] — template router (FA-1.52).
 *
 * Two templates share one route:
 *   v1  ./_v1/ExperienceV1  — today's editorial page, moved here unchanged
 *   v2  ./_v2/ExperienceV2  — offer-centric page (content: FA-1.53–1.55)
 *
 * v2 renders only when the global flag is on AND the page opted in
 * (experience_pages.page_version = 2). Rollback is switching the flag off.
 *
 * This file reads nothing request-scoped — no session, no request metadata, no
 * query string — and it has to stay that way. FA-1.80 found two things that kept
 * the route ƒ (server-rendered on every request): the nav read the session during
 * render (now a client island, see components/layout/nav.tsx), and the route had
 * no generateStaticParams, so Next never treated it as cacheable. With both gone
 * the build marks it ● and `revalidate` below takes effect: each slug renders on
 * its first request and is then served from the cache (the effective TTL is the
 * shortest one in the tree — the 300 s data caches in queries.ts, not this file's 3600).
 *
 * The admin preview (?preview=v2) is a separate dynamic route: src/proxy.ts
 * rewrites to it, and ./preview/page.tsx checks admin on the server itself.
 *
 * generateMetadata routes the same way the page does: a v2 page describes itself from
 * its own meta_title / meta_description (FA-1.53), anything else keeps v1's unchanged.
 */

import { permanentRedirect } from 'next/navigation'
import { getExperienceRouting, rendersAsV2 } from '@/lib/supabase/queries'
import ExperienceV1, { generateMetadata as v1Metadata } from './_v1/ExperienceV1'
import ExperienceV2, { generateMetadata as v2Metadata } from './_v2/ExperienceV2'

export const revalidate = 3600

// No slugs prebuilt (the build has no database in CI); an empty list is what makes the
// route cacheable — unknown slugs render on first request, then are cached.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const routing  = await getExperienceRouting(slug)

  return rendersAsV2(routing?.pageVersion)
    ? v2Metadata({ params })
    : v1Metadata({ params })
}

export default async function ExperiencePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const routing = await getExperienceRouting(slug)

  // Retired slug → 308 to the current one. The target comes from the database
  // only (never from the request), so this can never become an open redirect.
  if (routing != null && routing.canonicalSlug !== slug) {
    permanentRedirect(`/experiences/${encodeURIComponent(routing.canonicalSlug)}`)
  }

  if (rendersAsV2(routing?.pageVersion)) {
    return <ExperienceV2 slug={slug} />
  }

  // Unknown slug falls through to v1, which calls notFound() → 404, not 500.
  return <ExperienceV1 slug={slug} />
}
