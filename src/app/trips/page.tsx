import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { createServiceClient } from '@/lib/supabase/server'
import ExpPageMapSection from './exp-page-map-section'
import type { ExpPage } from '@/components/trips/exp-page'
import { COUNTRIES } from '@/lib/countries'
import { WebEventTracker } from '@/components/analytics/WebEventTracker'
import { SITE_URL } from '@/lib/site'
import { getActiveDestinationCountries } from '@/lib/supabase/queries'
import { listingCanonicalUrl } from '@/lib/listing-canonical'
import { defaultTripsDescription } from '@/lib/trips-description'
import { Pagination, pageHref } from '@/components/site/listing'

const PAGE_SIZE = 12

type SearchParams = {
  country?: string
  page?: string
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const revalidate = 60

const DEFAULT_TITLE = 'Guided Fishing Trips with Local Guides'

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const matched = params.country
    ? COUNTRIES.find(c => c.toLowerCase() === params.country!.toLowerCase().trim())
    : undefined

  const title = matched != null
    ? `Guided Fishing Trips in ${matched}`
    : DEFAULT_TITLE
  const description = matched != null
    ? `Browse guided fishing trips in ${matched} with verified local guides. Filter by species, price and dates.`
    : defaultTripsDescription(await getActiveDestinationCountries())

  // Page N ≥ 2 is its own canonical; any country filter stays on /trips (FA-1.88).
  const canonical = listingCanonicalUrl(`${SITE_URL}/trips`, params.page, [params.country])

  return {
    title,
    description,
    // Overrides the root layout's Nordic-specific keywords — without this, every
    // /trips?country=... page (Patagonia and NZ included) inherits them too.
    keywords: matched != null ? [matched, 'guided fishing trip'] : ['guided fishing trip', 'fishing guide'],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: `${title} | FjordAnglers` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: ['/brand/og-default.png'],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params      = await searchParams
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset      = (currentPage - 1) * PAGE_SIZE

  const svc = createServiceClient()

  let query = svc
    .from('experience_pages')
    .select(
      'id, slug, experience_name, country, region, price_from, price_type, currency, hero_image_url, gallery_image_urls, difficulty, technique, target_species, non_angler_friendly, location_lat, location_lng, location_area, location_spots',
      { count: 'exact' },
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.country) {
    query = query.ilike('country', params.country)
  }

  const { data, count } = await query

  const pages      = (data ?? []) as ExpPage[]
  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const matchedCountry = params.country
    ? COUNTRIES.find(c => c.toLowerCase() === params.country!.toLowerCase().trim())
    : undefined

  // The active filters without 'page' — the map section reloads its pins when they change.
  const baseParams = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => k !== 'page' && v != null) as [string, string][]
  ).toString()

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: matchedCountry != null
      ? `Guided Fishing Trips in ${matchedCountry}`
      : DEFAULT_TITLE,
    numberOfItems: total,
    itemListElement: pages.map((exp, i) => ({
      '@type': 'ListItem',
      position: offset + i + 1,
      item: {
        '@type': 'TouristTrip',
        name: exp.experience_name,
        url: `${SITE_URL}/experiences/${exp.slug ?? exp.id}`,
        ...(exp.hero_image_url != null ? { image: exp.hero_image_url } : {}),
        ...(exp.price_from != null ? {
          offers: {
            '@type': 'Offer',
            price: String(exp.price_from),
            priceCurrency: exp.currency,
            availability: 'https://schema.org/InStock',
          },
        } : {}),
      },
    })),
  }

  return (
    <div style={{ background: '#F3EDE4' }}>
      <WebEventTracker country={matchedCountry} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      <SiteNav />

      {/* Spacer for fixed nav */}
      <div style={{ height: '72px' }} />

      <h1 className="sr-only">{matchedCountry != null ? `Guided Fishing Trips in ${matchedCountry}` : DEFAULT_TITLE}</h1>

      {/* ── TWO-COLUMN (map + list) ── */}
      <ExpPageMapSection
        initialPages={pages}
        initialTotal={total}
        filterKey={baseParams}
        paginationNode={
          total > PAGE_SIZE
            ? <Pagination page={currentPage} totalPages={totalPages} href={p => pageHref('/trips', { country: params.country }, p)} />
            : null
        }

      />
      <SiteFooter />
    </div>
  )
}
