import Link from 'next/link'
import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { createServiceClient } from '@/lib/supabase/server'
import ExpPageMapSection from './exp-page-map-section'
import type { ExpPage } from './exp-page-map-section'

const PAGE_SIZE = 12

type SearchParams = {
  country?: string
  page?: string
}

// ─── Inline Pagination — Server Component (Link only) ─────────────────────────

function Pagination({
  page,
  totalPages,
  baseParams,
}: {
  page: number
  totalPages: number
  baseParams: string
}) {
  function pageHref(p: number) {
    const sp = new URLSearchParams(baseParams)
    sp.set('page', p.toString())
    return `/trips?${sp.toString()}`
  }

  const items: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i)
  } else {
    items.push(1)
    if (page > 3) items.push('…')
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (page < totalPages - 2) items.push('…')
    items.push(totalPages)
  }

  const pill = 'min-w-[36px] h-9 rounded-full flex items-center justify-center text-sm font-medium f-body transition-all px-3'

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-8 pb-2">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className={pill}
          style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
          ← Prev
        </Link>
      ) : (
        <span className={pill} style={{ border: '1px solid rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.2)' }}>← Prev</span>
      )}

      {items.map((item, idx) =>
        item === '…' ? (
          <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-sm f-body"
            style={{ color: 'rgba(10,46,77,0.3)' }}>…</span>
        ) : item === page ? (
          <span key={item} className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold f-body"
            style={{ background: '#0A2E4D', color: '#fff' }}>
            {item}
          </span>
        ) : (
          <Link key={item} href={pageHref(item)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium f-body transition-colors"
            style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
            {item}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={pageHref(page + 1)} className={pill}
          style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
          Next →
        </Link>
      ) : (
        <span className={pill} style={{ border: '1px solid rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.2)' }}>Next →</span>
      )}
    </nav>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const revalidate = 60
export const metadata = {
  title: 'Guided Fishing Trips in Norway, Sweden, Iceland & Finland',
  description: 'Browse 20+ hand-picked guided fishing trips across Norway, Sweden, Iceland and Finland. Salmon, sea trout, pike & fly fishing. Filter by country.',
  alternates: { canonical: 'https://fjordanglers.com/trips' },
  openGraph: {
    url: 'https://fjordanglers.com/trips',
    images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: 'Guided Fishing Trips in Norway, Sweden, Iceland & Finland | FjordAnglers' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    images: ['/brand/og-default.png'],
  },
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
      'id, slug, experience_name, country, region, price_from, price_type, hero_image_url, gallery_image_urls, difficulty, technique, target_species, non_angler_friendly, location_lat, location_lng, location_area, location_spots',
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

  // Preserve active filters in pagination links (strip 'page' key)
  const baseParams = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => k !== 'page' && v != null) as [string, string][]
  ).toString()

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: params.country
      ? `Guided Fishing Trips in ${params.country}`
      : 'Guided Fishing Trips in Norway, Sweden, Iceland & Finland',
    numberOfItems: total,
    itemListElement: pages.map((exp, i) => ({
      '@type': 'ListItem',
      position: offset + i + 1,
      item: {
        '@type': 'TouristTrip',
        name: exp.experience_name,
        url: `https://fjordanglers.com/experiences/${exp.slug ?? exp.id}`,
        ...(exp.hero_image_url != null ? { image: exp.hero_image_url } : {}),
        ...(exp.price_from != null ? {
          offers: {
            '@type': 'Offer',
            price: String(exp.price_from),
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
          },
        } : {}),
      },
    })),
  }

  return (
    <div style={{ background: '#F3EDE4' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      <SiteNav />

      {/* Spacer for fixed nav */}
      <div style={{ height: '72px' }} />

      <h1 className="sr-only">Guided Fishing Trips in Norway, Sweden, Iceland &amp; Finland</h1>

      {/* ── TWO-COLUMN (map + list) ── */}
      <ExpPageMapSection
        initialPages={pages}
        initialTotal={total}
        filterKey={baseParams}
        paginationNode={
          total > PAGE_SIZE
            ? <Pagination page={currentPage} totalPages={totalPages} baseParams={baseParams} />
            : null
        }

      />
      <SiteFooter />
    </div>
  )
}
