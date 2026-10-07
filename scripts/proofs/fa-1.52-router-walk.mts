/**
 * FA-1.52 acceptance criteria — /experiences/[slug] template router
 *
 * Two layers, one run:
 *
 *  A. data layer — getExperienceRouting() against the local database with
 *     fixtures inserted here: canonical v1 page, canonical v2 page, a retired
 *     slug in experience_slug_aliases, and a slug that does not exist.
 *
 *  B. HTTP — the real route through the running dev server, as an anonymous
 *     visitor: v1 page 200, v2 page (flag-dependent), alias 308 → canonical,
 *     unknown slug 404 (not 500), ?preview=v2 without an admin session served
 *     the public page, and /experiences/<slug>/preview itself 404.
 *     The admin-session half of the preview criterion is proven in the
 *     Playwright walk (screenshots in .playwright-mcp/), since a browser login
 *     is what writes the Supabase session cookies.
 *
 * What B asserts for the v2 page depends on EXPERIENCE_V2_ENABLED, which must
 * match the value the dev server was started with — run it both ways:
 *
 *   EXPERIENCE_V2_ENABLED=false npx tsx --tsconfig scripts/proofs/tsconfig.proof.json \
 *     scripts/proofs/fa-1.52-router-walk.mts
 *   EXPERIENCE_V2_ENABLED=true  npx tsx --tsconfig scripts/proofs/tsconfig.proof.json \
 *     scripts/proofs/fa-1.52-router-walk.mts
 *
 * Fixtures use slugs that no earlier request has touched, so the router's
 * unstable_cache entry is created after the fixture exists. They are removed at
 * the end, pass or fail.
 *
 * Local stack only — the fuse below refuses anything that is not 127.0.0.1.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getExperienceRouting } from '@/lib/supabase/queries'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error('SAFETY FUSE: this proof only runs against the local stack')
}

const BASE      = process.env.PROOF_BASE_URL ?? 'http://127.0.0.1:3000'
const FLAG_ON   = process.env.EXPERIENCE_V2_ENABLED === 'true'
const V1_SLUG   = 'fa152-proof-v1'
const V2_SLUG   = 'fa152-proof-v2'
const ALIAS     = 'fa152-proof-retired-slug'
const MISSING   = 'fa152-proof-no-such-page'

const svc = createServiceClient()
let failures = 0

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label} — ${detail}`)
  if (!ok) failures++
}

function step(n: string, label: string) {
  console.log(`\n── ${n}. ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`)
}

async function cleanup() {
  await svc.from('experience_slug_aliases').delete().eq('slug', ALIAS)
  await svc.from('experience_pages').delete().in('slug', [V1_SLUG, V2_SLUG])
}

try {
  step('0', `fixtures (flag EXPERIENCE_V2_ENABLED=${FLAG_ON})`)
  await cleanup()

  const { data: pages, error: insertError } = await svc
    .from('experience_pages')
    .insert([
      { experience_name: 'FA-1.52 proof v1', slug: V1_SLUG, country: 'Iceland', status: 'active', page_version: 1 },
      { experience_name: 'FA-1.52 proof v2', slug: V2_SLUG, country: 'Iceland', status: 'active', page_version: 2 },
    ])
    .select('id, slug, page_version')

  if (insertError != null || pages == null) throw new Error(`fixture insert failed: ${insertError?.message}`)
  const v2Page = pages.find(p => p.slug === V2_SLUG)!
  console.log('   inserted', pages.map(p => `${p.slug} (page_version=${p.page_version})`).join(', '))

  const { error: aliasError } = await svc
    .from('experience_slug_aliases')
    .insert({ slug: ALIAS, experience_id: v2Page.id })
  if (aliasError != null) throw new Error(`alias insert failed: ${aliasError.message}`)
  console.log('   inserted alias', ALIAS, '→', V2_SLUG)

  // ── A. data layer ──────────────────────────────────────────────────────────
  step('A', 'getExperienceRouting()')

  const v1Routing = await getExperienceRouting(V1_SLUG)
  check('canonical v1 slug', JSON.stringify(v1Routing) === JSON.stringify({ pageVersion: 1, canonicalSlug: V1_SLUG }),
    JSON.stringify(v1Routing))

  const v2Routing = await getExperienceRouting(V2_SLUG)
  check('canonical v2 slug', JSON.stringify(v2Routing) === JSON.stringify({ pageVersion: 2, canonicalSlug: V2_SLUG }),
    JSON.stringify(v2Routing))

  const aliasRouting = await getExperienceRouting(ALIAS)
  check('retired slug resolves to its canonical page',
    aliasRouting?.canonicalSlug === V2_SLUG && aliasRouting.pageVersion === 2,
    JSON.stringify(aliasRouting))

  const missingRouting = await getExperienceRouting(MISSING)
  check('unknown slug → null', missingRouting === null, JSON.stringify(missingRouting))

  // ── B. HTTP, anonymous ─────────────────────────────────────────────────────
  step('B', `HTTP through ${BASE} (anonymous)`)

  async function get(path: string) {
    const res  = await fetch(`${BASE}${path}`, { redirect: 'manual' })
    const body = await res.text()
    return { status: res.status, location: res.headers.get('location'), isV2: body.includes('v2 preview') }
  }

  const v1Res = await get(`/experiences/${V1_SLUG}`)
  check('v1 page', v1Res.status === 200 && !v1Res.isV2, `${v1Res.status}, v2 skeleton: ${v1Res.isV2}`)

  const v2Res = await get(`/experiences/${V2_SLUG}`)
  check(`page_version=2 with flag ${FLAG_ON ? 'on → v2 skeleton' : 'off → v1'}`,
    v2Res.status === 200 && v2Res.isV2 === FLAG_ON, `${v2Res.status}, v2 skeleton: ${v2Res.isV2}`)

  const aliasRes = await get(`/experiences/${ALIAS}`)
  check('retired slug → 308 to the canonical slug',
    aliasRes.status === 308 && (aliasRes.location ?? '').endsWith(`/experiences/${V2_SLUG}`),
    `${aliasRes.status} → ${aliasRes.location}`)

  const missingRes = await get(`/experiences/${MISSING}`)
  check('unknown slug → 404, not 500', missingRes.status === 404, String(missingRes.status))

  const previewAnon = await get(`/experiences/${V2_SLUG}?preview=v2`)
  check('?preview=v2 without an admin session → the public page',
    previewAnon.status === 200 && previewAnon.isV2 === FLAG_ON,
    `${previewAnon.status}, v2 skeleton: ${previewAnon.isV2} (same as without the parameter)`)

  const previewDirect = await get(`/experiences/${V2_SLUG}/preview`)
  check('direct /preview without an admin session → 404',
    previewDirect.status === 404, String(previewDirect.status))
} finally {
  step('Z', 'cleanup')
  await cleanup()
  console.log('   fixtures removed')
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
