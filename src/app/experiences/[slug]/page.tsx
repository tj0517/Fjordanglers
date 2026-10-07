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
 * query string — so it is not what makes this route dynamic, and it has to stay
 * that way. It is not ISR today either: the build marks /experiences/[slug] as
 * ƒ (server-rendered on demand) on main and here alike, so `revalidate = 3600`
 * below currently changes nothing. The cause sits outside this file, in the
 * rendered tree (see docs/deferred-tasks.md, FA-1.52). The export stays as it
 * is, so the route caches the moment that cause is gone.
 *
 * The admin preview (?preview=v2) is a separate dynamic route: src/proxy.ts
 * rewrites to it, and ./preview/page.tsx checks admin on the server itself.
 *
 * generateMetadata is re-exported from v1 unchanged; v2 inherits it for now.
 */

import { permanentRedirect } from 'next/navigation'
import { env } from '@/lib/env'
import { getExperienceRouting } from '@/lib/supabase/queries'
import ExperienceV1 from './_v1/ExperienceV1'
import ExperienceV2 from './_v2/ExperienceV2'

export const revalidate = 3600

export { generateMetadata } from './_v1/ExperienceV1'

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

  if (env.EXPERIENCE_V2_ENABLED && routing?.pageVersion === 2) {
    return <ExperienceV2 slug={slug} />
  }

  // Unknown slug falls through to v1, which calls notFound() → 404, not 500.
  return <ExperienceV1 slug={slug} />
}
