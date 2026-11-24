/**
 * "<Country> hub" — the grain block that sends a reader of a country's article to that country's hub
 * (FA-1.97, docs/design/blog-2026-11/article.dc.html). No hub for the post's country (or a general
 * post), no block. The hub's own title is the heading; the line under it is the same for every hub.
 */

import { PLAN_YOUR_TRIP_HREF } from '@/components/layout/nav'
import { Eyebrow, GhostButton, ON_DARK, PrimaryButton } from '@/components/site/ui'
import s from '@/components/site/grain.module.css'

export function ArticleHubCta({ hub, country }: { hub: { slug: string; label: string } | null; country: string | null }) {
  if (hub == null) return null

  const place = country?.trim() ?? ''

  return (
    <section
      data-block="article-hub"
      className={`${s.blur} ${s.canyon} flex flex-wrap items-center justify-between gap-8`}
      style={{ borderRadius: 24, padding: '56px clamp(24px, 5vw, 64px)' }}
    >
      <div className="flex max-w-[620px] flex-[1_1_420px] flex-col gap-[14px]">
        <Eyebrow dark>{place !== '' ? `${place} hub` : 'Destination hub'}</Eyebrow>
        <h2
          className="f-display m-0"
          style={{ fontWeight: 600, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.08, letterSpacing: '-.015em', color: '#FFFFFF' }}
        >
          {hub.label}
        </h2>
        <p className="f-body m-0 text-[17px]" style={{ lineHeight: 1.55, color: ON_DARK }}>
          Seasons, species and every trip in one place.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <PrimaryButton href={`/${hub.slug}`} dark>{place !== '' ? `Open the ${place} hub` : 'Open the hub'}</PrimaryButton>
        <GhostButton href={PLAN_YOUR_TRIP_HREF}>Plan your trip</GhostButton>
      </div>
    </section>
  )
}
