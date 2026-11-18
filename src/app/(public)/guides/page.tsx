import type { Metadata } from 'next'
import Image from 'next/image'
import { getGuides, getPlatformStats, type GuideRow } from '@/lib/supabase/queries'
import { COUNTRIES } from '@/lib/countries'
import { SITE_URL } from '@/lib/site'
import { GuideLink } from '@/components/guides/guide-link'
import { guideProfilePath } from '@/lib/guide-url'
import { listingCanonicalUrl } from '@/lib/listing-canonical'
import { PhotoHero } from '@/components/site/photo-hero'
import { FilterRow, Pagination, pageHref } from '@/components/site/listing'
import {
  Arrow, CREAM, Eyebrow, LINE, MUTED, NAVY, ON_DARK, SALMON_ON_DARK, SecondaryButton, Tag,
  initials, primaryButtonStyle,
} from '@/components/site/ui'
import s from '@/components/site/grain.module.css'

/**
 * /guides — the guides list, built from docs/design/site-2026-11/guides.dc.html: photo hero with
 * the live counts, the country and language filters as rows of buttons, the guide cards, the
 * pagination and the "For guides" block. Fields, filters and paging are the ones the page had
 * before the redesign.
 */

const PAGE_SIZE = 12

const LANGUAGES = ['English', 'Norwegian', 'Swedish', 'Finnish', 'Icelandic', 'German'] as const

export const revalidate = 300

type SearchParams = {
  country?: string
  language?: string
  page?: string
}

/** `/guides` with the given filters; a filter change always goes back to page 1. */
function guidesHref(country: string | undefined, language: string | undefined): string {
  const sp = new URLSearchParams()
  if (country)  sp.set('country',  country)
  if (language) sp.set('language', language)
  return `/guides${sp.toString() ? `?${sp.toString()}` : ''}`
}

function GuideCard({ guide }: { guide: GuideRow }) {
  const place = [guide.city, guide.country].filter(p => p != null && p.trim() !== '').join(', ')
  const fish  = guide.fish_expertise.slice(0, 3)
  const more  = guide.fish_expertise.length - fish.length

  return (
    <GuideLink
      slug={guide.slug}
      className="flex flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_40px_rgba(10,46,77,.12)]"
      style={{ borderRadius: 20, background: CREAM, border: `1px solid ${LINE}`, textDecoration: 'none' }}
    >
      <span className="relative block h-[170px]" style={{ background: NAVY }}>
        {guide.cover_url != null && (
          <Image src={guide.cover_url} alt={`${guide.full_name} — ${guide.country}`} fill sizes="(min-width: 1080px) 384px, (min-width: 720px) 50vw, 100vw" className="object-cover" />
        )}
        {(guide.years_experience != null || guide.average_rating != null) && (
          <span className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
            {guide.average_rating != null && <Tag>★ {guide.average_rating.toFixed(1)}</Tag>}
            {guide.years_experience != null && <Tag tone="salmon">{guide.years_experience} yrs exp</Tag>}
          </span>
        )}
      </span>
      <span className="flex flex-[1_1_auto] flex-col gap-3 px-5 pb-5">
        <span
          aria-hidden="true"
          className="f-display relative -mt-[34px] flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full"
          style={{ background: NAVY, border: `4px solid ${CREAM}`, color: SALMON_ON_DARK, fontWeight: 700, fontSize: 22 }}
        >
          {guide.avatar_url != null
            ? <Image src={guide.avatar_url} alt="" fill sizes="68px" className="object-cover" />
            : initials(guide.full_name)}
        </span>
        <span className="flex flex-col gap-[3px]">
          <span className="f-display" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.15, color: NAVY }}>{guide.full_name}</span>
          {place !== '' && <span className="f-body text-[14px]" style={{ color: MUTED }}>{place}</span>}
        </span>
        {fish.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {fish.map(f => <Tag key={f} tone="sand">{f}</Tag>)}
            {more > 0 && <Tag>+{more} more</Tag>}
          </span>
        )}
        {guide.tagline != null && guide.tagline.trim() !== '' && (
          <span className="f-body text-[14.5px]" style={{ lineHeight: 1.5, color: MUTED }}>{guide.tagline}</span>
        )}
        <span className="mt-auto flex items-center justify-between gap-3 pt-[14px]" style={{ borderTop: `1px solid ${LINE}` }}>
          <span className="f-body text-[13.5px]" style={{ color: MUTED }}>
            {guide.languages.slice(0, 2).join(', ')}
            {guide.languages.length > 2 && ` +${guide.languages.length - 2}`}
          </span>
          <span className="f-body inline-flex items-center gap-2 text-[14.5px] font-bold" style={{ color: NAVY }}>View profile<Arrow /></span>
        </span>
      </span>
    </GuideLink>
  )
}

// ─── METADATA ─────────────────────────────────────────────────────────────────

const GUIDES_TITLE = 'Independent Fishing Guides in Iceland, Scandinavia, Patagonia and New Zealand'
const GUIDES_DESCRIPTION =
  'Owner-operator guides listed by name, with their rivers, prices and season. Iceland, Norway, Sweden, Finland, Argentina, Chile and New Zealand.'

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams
  // Page N ≥ 2 is its own canonical; any country/language filter stays on /guides (FA-1.88).
  const canonical = listingCanonicalUrl(`${SITE_URL}/guides`, params.page, [params.country, params.language])

  return {
    title: GUIDES_TITLE,
    description: GUIDES_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      type: 'website',
      title: GUIDES_TITLE,
      description: GUIDES_DESCRIPTION,
      // Page-level openGraph replaces the layout's wholesale, so the default image is restated here.
      images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: `${GUIDES_TITLE} | FjordAnglers` }],
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const totalPages  = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [{ guides, total }, stats] = await Promise.all([
    getGuides({ country: params.country, language: params.language, page: currentPage }),
    getPlatformStats(),
  ])

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'FjordAnglers guides',
    description: 'Owner-operator guides listed by name, with their rivers, prices and season. Iceland, Norway, Sweden, Finland, Argentina, Chile and New Zealand.',
    url: `${SITE_URL}/guides`,
    numberOfItems: total,
    // A guide without a slug has no profile URL, so it has no entry (FA-1.86).
    itemListElement: guides.flatMap((guide, i) => {
      const path = guideProfilePath(guide)
      if (path == null) return []
      return [{
        '@type': 'ListItem',
        position: (currentPage - 1) * PAGE_SIZE + i + 1,
        item: {
          '@type': 'Person',
          name: guide.full_name,
          url: `${SITE_URL}${path}`,
          ...(guide.avatar_url != null && { image: guide.avatar_url }),
          ...(guide.bio != null && { description: guide.bio }),
          address: { '@type': 'PostalAddress', addressCountry: guide.country },
        },
      }]
    }),
  }

  const stat = [
    { label: 'Guides',    n: stats.guideCount },
    { label: 'Countries', n: stats.countryCount },
    { label: 'Languages', n: stats.languageCount },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="min-h-screen pb-[120px]" style={{ background: '#F3EDE4' }}>
        <PhotoHero image="/hub/nzriver.jpg" minHeight={560}>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="flex max-w-[640px] flex-[1_1_420px] flex-col gap-5">
              <Eyebrow dark>Our guides</Eyebrow>
              <h1
                className="f-display"
                style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(42px, 5.6vw, 72px)', lineHeight: 1, letterSpacing: '-.02em', color: '#FFFFFF' }}
              >
                The guides <span style={{ fontStyle: 'italic', color: SALMON_ON_DARK }}>who know every fish.</span>
              </h1>
              <p className="f-body m-0 text-[18px]" style={{ lineHeight: 1.55, color: '#F4F7F9' }}>
                Owner-operators only. The person who replies to your enquiry is the person who will be standing next to you on the water.
              </p>
            </div>
            <dl className="m-0 grid w-full grid-cols-3 gap-[10px] sm:flex sm:w-auto sm:flex-[0_1_220px] sm:flex-col" data-testid="guides-stats">
              {stat.map(item => (
                <div key={item.label} className={`${s.fq} flex flex-col gap-1`} style={{ padding: '13px 18px' }}>
                  <dt className="f-body text-[11.5px] font-bold uppercase" style={{ letterSpacing: '.1em', color: SALMON_ON_DARK }}>{item.label}</dt>
                  <dd className="f-display" style={{ margin: 0, fontWeight: 700, fontSize: 30, lineHeight: 1, color: '#FFFFFF' }}>{item.n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </PhotoHero>

        <main className="mx-auto flex flex-col gap-10 px-6 pt-12" style={{ maxWidth: 1200 }}>
          <section className="flex flex-col gap-[14px]" data-testid="guides-filters">
            <FilterRow label="Country" all="All countries" options={COUNTRIES} value={params.country} href={c => guidesHref(c, params.language)} />
            <FilterRow label="Language" all="All languages" options={LANGUAGES} value={params.language} href={l => guidesHref(params.country, l)} />
            <p className="f-body m-0 mt-1.5 text-[14px]" style={{ color: MUTED }}>
              {total} guide{total !== 1 ? 's' : ''}
            </p>
          </section>

          {guides.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="f-display m-0" style={{ fontWeight: 700, fontSize: 'clamp(30px, 4vw, 44px)', color: NAVY }}>No guides found</p>
              <p className="f-body m-0 text-[16px]" style={{ color: MUTED }}>Try broadening your filters to find available guides.</p>
              <SecondaryButton href="/guides">Clear all filters</SecondaryButton>
            </div>
          ) : (
            <section className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }} data-testid="guides-grid">
              {guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
            </section>
          )}

          {totalPages(total) > 1 && (
            <Pagination page={currentPage} totalPages={totalPages(total)} href={p => pageHref('/guides', { country: params.country, language: params.language }, p)} />
          )}

          <section
            className={`${s.blur} ${s.guide} mt-10 flex flex-wrap items-center justify-between gap-7`}
            style={{ borderRadius: 24, padding: '48px clamp(24px, 5vw, 64px)' }}
            data-block="for-guides"
          >
            <div className="flex max-w-[620px] flex-[1_1_420px] flex-col gap-3">
              <Eyebrow dark>For guides</Eyebrow>
              <h2 className="f-display" style={{ margin: 0, fontWeight: 600, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.08, color: '#FFFFFF' }}>
                Do you guide on your own water?
              </h2>
              <p className="f-body m-0 text-[17px]" style={{ lineHeight: 1.55, color: ON_DARK }}>
                We send you anglers who have already picked your water and their dates. You set your price, and the angler pays it to you directly.
              </p>
            </div>
            <a href="mailto:contact@fjordanglers.com?subject=Guiding%20with%20FjordAnglers" className="f-body" style={primaryButtonStyle}>
              Become a guide
            </a>
          </section>
        </main>
      </div>
    </>
  )
}
