/**
 * /experiences/[slug]/preview — admin-only preview of template v2 (FA-1.52).
 *
 * Reached through src/proxy.ts, which rewrites /experiences/<slug>?preview=v2
 * here for requests with an admin session. That rewrite is a convenience, never
 * the gate: this route checks the session itself, and anyone who is not an
 * admin gets 404 — including a direct hit on this URL.
 *
 * force-dynamic because the answer depends on the caller's session; noindex
 * because it must never enter the index next to the public page.
 */

import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/auth/guards'
import { getExperienceRouting } from '@/lib/supabase/queries'
import ExperienceV2 from '../_v2/ExperienceV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'v2 preview',
  robots: { index: false, follow: false },
}

export default async function ExperienceV2PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!(await isAdminRequest())) notFound()

  // Same 404 as the public page for a slug that does not exist.
  const routing = await getExperienceRouting(slug)
  if (routing == null) notFound()

  return <ExperienceV2 slug={slug} />
}
