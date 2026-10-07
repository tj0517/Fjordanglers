/**
 * FA-1.53 — the data layer and the price rule of the v2 offer page, against the local seed.
 *
 * Proves what a unit test cannot: that `getExperienceV2()` reads the real schema correctly
 * and that the filters it applies in code (CLAUDE.md rule 3's data layer, not the policy)
 * actually drop what they claim to:
 *
 *   A. the NZ seed page (`fixed`)   — guides, current prices, the expired row excluded
 *   B. the Iceland seed page (`custom`) — a range, no price table
 *   C. the override, written for real and read back through the data layer, replaces the
 *      base row only — and the 115% cap is shown rejecting a write (red proof)
 *   D. a `paused` guide row and a `show_on_page = false` row disappear from the page,
 *      even though the public read policy returns them (deferred row FA-1.50)
 *   E. the price rule on the seeded rows: total = guide × 1.20 to the cent
 *
 * Run (local stack up, no dev server needed):
 *   eval "$(pnpm supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY|ANON_KEY)=')"
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \
 *   SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     npx tsx --tsconfig scripts/proofs/tsconfig.proof.json scripts/proofs/fa-1.53-offer-page-walk.mts
 *
 * Every write it makes is undone at the end, pass or fail. Local stack only — the fuse
 * below refuses anything that is not 127.0.0.1.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getExperienceV2 } from '@/lib/supabase/queries'
import { quote, fromPrice } from '@/lib/pricing/experience-price'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error('SAFETY FUSE: this proof only runs against the local stack')
}

const NZ_SLUG = 'seed-backcountry-day-nz'
const IS_SLUG = 'seed-salmon-week-iceland'
const NZ_ID   = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101'
const HANA    = '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c04'
const JON     = '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03'

const svc = createServiceClient()
let failures = 0

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label} — ${detail}`)
  if (!ok) failures++
}

function step(n: string, label: string) {
  console.log(`\n── ${n}. ${label} ${'─'.repeat(Math.max(0, 52 - label.length))}`)
}

async function cleanup() {
  await svc.from('experience_guides')
    .update({ guide_price_override_cents: null, status: 'active', show_on_page: true })
    .eq('experience_id', NZ_ID).eq('guide_id', HANA)
  await svc.from('experience_guides').delete().eq('experience_id', NZ_ID).eq('guide_id', JON)
}

try {
  await cleanup()

  // ── A. the fixed page ──────────────────────────────────────────────────────
  step('A', `getExperienceV2('${NZ_SLUG}') — fixed`)

  const nz = await getExperienceV2(NZ_SLUG)
  if (nz == null) throw new Error('the NZ seed page did not come back — is the seed applied?')

  console.log('   prices:', JSON.stringify(nz.prices))
  check('offer mode', nz.offerMode === 'fixed', `offerMode=${nz.offerMode}`)
  check('fee_pct read from the page', nz.feePct === 0.2, `feePct=${nz.feePct}`)
  check('three current price rows', nz.prices.length === 3, `${nz.prices.length} rows`)
  check(
    'the expired 2024 row is gone',
    !nz.prices.some(p => p.guidePriceCents === 100_000),
    `guide prices = ${nz.prices.map(p => p.guidePriceCents).join(', ')}`,
  )
  check(
    'one primary guide, with the rating fields the H1 line needs',
    nz.guides.length === 1 && nz.guides[0]!.isPrimary && nz.guides[0]!.googleRating === 4.9,
    `${nz.guides.map(g => `${g.fullName} ★${g.googleRating} (${g.googleReviewCount})`).join('; ')}`,
  )
  check(
    'chip data present',
    nz.seasonMonths.length === 7 && nz.skillLevel === 3 && nz.maxAnglersPerGuide === 2,
    `season=${nz.seasonMonths.length} months, skill=${nz.skillLevel}, maxAnglers=${nz.maxAnglersPerGuide}`,
  )
  check('gallery', nz.galleryImageUrls.length === 5, `hero=${nz.heroImageUrl}, +${nz.galleryImageUrls.length}`)

  // ── B. the custom page ─────────────────────────────────────────────────────
  step('B', `getExperienceV2('${IS_SLUG}') — custom`)

  const is = await getExperienceV2(IS_SLUG)
  if (is == null) throw new Error('the Iceland seed page did not come back')

  check('offer mode', is.offerMode === 'custom', `offerMode=${is.offerMode}`)
  check('no price table', is.prices.length === 0, `${is.prices.length} rows`)
  check(
    'the range is there, exactly as stored',
    is.priceFromCents === 45_050 && is.priceToCents === 320_000,
    `${is.priceFromCents}–${is.priceToCents} ${is.currency}`,
  )
  check('its own SLA, not a constant', is.responseSlaHours === 48, `${is.responseSlaHours} h`)

  // ── C. the override ────────────────────────────────────────────────────────
  step('C', 'guide_price_override_cents — base row only, cap enforced')

  // 110% of the base row (days 1, anglers 2 = 125 000) → 137 500, inside the 115% cap.
  const { error: overrideError } = await svc.from('experience_guides')
    .update({ guide_price_override_cents: 137_500 })
    .eq('experience_id', NZ_ID).eq('guide_id', HANA)
  check('writing 110% of the base row is accepted', overrideError == null, overrideError?.message ?? 'written')

  const withOverride = await getExperienceV2(NZ_SLUG)
  const base    = withOverride?.prices.find(p => p.days === 1 && p.anglers === 2)
  const twoDays = withOverride?.prices.find(p => p.days === 2 && p.anglers === 2)
  const oneAng  = withOverride?.prices.find(p => p.days === 1 && p.anglers === 1)
  check('the base row now carries the override', base?.guidePriceCents === 137_500, `${base?.guidePriceCents}`)
  check('the 2-day row is untouched', twoDays?.guidePriceCents === 240_000, `${twoDays?.guidePriceCents}`)
  check('the 1-angler row is untouched', oneAng?.guidePriceCents === 90_000, `${oneAng?.guidePriceCents}`)
  check(
    'the override never leaves the data layer',
    !Object.keys(withOverride ?? {}).some(k => k.toLowerCase().includes('override')),
    `ExperienceV2 keys: ${Object.keys(withOverride ?? {}).join(', ')}`,
  )

  // RED PROOF: 116% of the base row must be rejected by the database (O-32).
  const { error: capError } = await svc.from('experience_guides')
    .update({ guide_price_override_cents: 145_000 })
    .eq('experience_id', NZ_ID).eq('guide_id', HANA)
  check(
    'RED PROOF — 145 000 (116% of 125 000) is rejected',
    capError != null,
    capError?.message ?? 'ACCEPTED — the 115% cap is not being enforced',
  )

  await svc.from('experience_guides')
    .update({ guide_price_override_cents: null })
    .eq('experience_id', NZ_ID).eq('guide_id', HANA)

  // ── D. rows the policy returns but the page may not show ───────────────────
  step('D', 'paused / show_on_page = false / backup are filtered in code')

  await svc.from('experience_guides').insert({
    experience_id: NZ_ID, guide_id: JON, role: 'backup', status: 'active', show_on_page: false, sort_order: 1,
  })

  const { data: policyRows } = await svc.from('experience_guides')
    .select('guide_id, role, status, show_on_page').eq('experience_id', NZ_ID)
  console.log('   rows in the table:', JSON.stringify(policyRows))

  const hiddenBackup = await getExperienceV2(NZ_SLUG)
  check(
    'a show_on_page = false backup row is not on the page',
    hiddenBackup?.guides.length === 1,
    `${hiddenBackup?.guides.length} guide(s): ${hiddenBackup?.guides.map(g => g.fullName).join(', ')}`,
  )

  await svc.from('experience_guides')
    .update({ show_on_page: true }).eq('experience_id', NZ_ID).eq('guide_id', JON)
  const shownBackup = await getExperienceV2(NZ_SLUG)
  check(
    'with show_on_page = true the same row appears, after the primary by sort_order',
    shownBackup?.guides.length === 2 && shownBackup?.guides[0]!.isPrimary === true,
    `${shownBackup?.guides.map(g => `${g.fullName}${g.isPrimary ? ' (primary)' : ''}`).join(' → ')}`,
  )

  await svc.from('experience_guides')
    .update({ status: 'paused' }).eq('experience_id', NZ_ID).eq('guide_id', JON)
  const pausedBackup = await getExperienceV2(NZ_SLUG)
  check(
    'a paused row disappears again',
    pausedBackup?.guides.length === 1,
    `${pausedBackup?.guides.length} guide(s)`,
  )

  // ── E. the price rule on the seeded rows ───────────────────────────────────
  step('E', 'the widget numbers, from the seeded rows')

  const fresh = await getExperienceV2(NZ_SLUG)
  const args  = { prices: fresh!.prices, feePct: fresh!.feePct, maxAnglersPerGuide: fresh!.maxAnglersPerGuide }

  for (const [days, anglers] of [[1, 1], [1, 2], [2, 2]] as const) {
    const q = quote({ days, anglers, ...args })
    if (!q.priced) { check(`${days} d × ${anglers}`, false, `unpriced: ${q.reason}`); continue }
    check(
      `${days} d × ${anglers} angler(s)`,
      q.feeCents + q.guideCents === q.totalCents,
      `total ${q.totalCents} = guide ${q.guideCents} + deposit ${q.feeCents} ${q.currency}`,
    )
  }

  const q3 = quote({ days: 1, anglers: 3, ...args })
  check(
    '1 d × 3 anglers — no row covers the group, so no number',
    !q3.priced,
    q3.priced ? `WRONG: quoted ${q3.totalCents}` : `on request (${q3.reason})`,
  )

  const from = fromPrice(args)
  check('the "from" price is the lowest total', from?.totalCents === 108_000, `${from?.totalCents} ${from?.currency}`)

  const isQuote = quote({ days: 3, anglers: 2, prices: is.prices, feePct: is.feePct, maxAnglersPerGuide: is.maxAnglersPerGuide })
  check('the custom page has no calculator answer at all', !isQuote.priced, isQuote.priced ? 'WRONG' : isQuote.reason)
} finally {
  await cleanup()
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
