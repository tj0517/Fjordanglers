import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { CountryFlag } from '@/components/ui/country-flag'
import { formatPrice } from '@/lib/format-price'
import { createServiceClient } from '@/lib/supabase/server'
import { DESTINATION_HUBS, getHubCountries, getHubForSlug } from '@/lib/destinations'
import { WebEventTracker } from '@/components/analytics/WebEventTracker'

export const revalidate = 60

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpPage = {
  id: string
  slug: string
  experience_name: string
  country: string
  region: string
  price_from: number
  price_type: string
  currency: string
  hero_image_url: string | null
  gallery_image_urls: unknown
  difficulty: string | null
  non_angler_friendly: boolean | null
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// Visually identical to ExpCard in exp-page-map-section.tsx.
// Copied rather than extracted to avoid touching the existing /trips file tree
// (out of scope for this task; extraction deferred to docs/deferred-tasks.md).

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
  Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
  Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
  Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
}

function ExpCard({ page, priority = false }: { page: ExpPage; priority?: boolean }) {
  const gallery  = (page.gallery_image_urls as string[] | null) ?? []
  const coverUrl = gallery[0] ?? page.hero_image_url
  const dc = page.difficulty
    ? (DIFFICULTY_COLOR[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' })
    : null

  return (
    <Link href={`/experiences/${page.slug}`} className="block group">
      <article
        className="transition-all duration-200 group-hover:-translate-y-0.5"
        style={{ borderRadius: '20px' }}
      >
        {/* Image */}
        <div
          className="relative overflow-hidden"
          style={{ height: '240px', borderRadius: '16px', background: '#EDE6DB' }}
        >
          {coverUrl != null && (
            <Image
              src={coverUrl}
              alt={page.experience_name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {dc != null && page.difficulty && (
              <div
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(8px)', color: '#0A2E4D' }}
              >
                {page.difficulty}
              </div>
            )}
            {page.non_angler_friendly && (
              <div
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(74,222,128,0.85)', backdropFilter: 'blur(8px)', color: '#fff' }}
              >
                Family-friendly
              </div>
            )}
          </div>

          {/* Price bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
            <span
              className="text-[13px] font-bold px-3.5 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(5,12,22,0.72)', color: '#fff', backdropFilter: 'blur(8px)' }}
            >
              {formatPrice({ priceFrom: page.price_from, priceType: page.price_type, currency: page.currency })}
            </span>
          </div>
        </div>

        {/* Text info */}
        <div className="pt-3 px-0.5 pb-3">
          <h3
            className="font-semibold leading-snug f-body line-clamp-2"
            style={{ fontSize: '15px', color: '#0A2E4D' }}
          >
            {page.experience_name}
          </h3>

          <div
            className="flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(10,46,77,0.07)' }}
          >
            <MapPin size={10} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.45)', flexShrink: 0 }} />
            <p className="text-[11px] font-medium f-body truncate min-w-0" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {page.region}, {page.country}
            </p>
            <span className="flex-shrink-0"><CountryFlag country={page.country} /></span>
          </div>
        </div>
      </article>
    </Link>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    n: '1',
    title: 'Tell us your dates.',
    body: 'Dates, group size, what you want to catch.',
  },
  {
    n: '2',
    title: 'We check with the guide.',
    body: 'We come back with availability and a price within two business days.',
  },
  {
    n: '3',
    title: 'Deposit once dates are confirmed.',
    body: 'You pay nothing to ask.',
  },
]

// ─── Static params & metadata ─────────────────────────────────────────────────

export function generateStaticParams() {
  return DESTINATION_HUBS.map(hub => ({ destination: hub.slug }))
}

const BASE = 'https://fjordanglers.com'

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params
  const hub = getHubForSlug(destination)
  if (hub == null) return {}

  const countries = getHubCountries(hub)
  const db = createServiceClient()
  const { data } = await db
    .from('experience_pages')
    .select('hero_image_url')
    .eq('status', 'active')
    .in('country', countries)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ogImage = (data as { hero_image_url?: string | null } | null)?.hero_image_url
    ?? `${BASE}/brand/og-default.png`

  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: { canonical: `${BASE}/${hub.slug}` },
    openGraph: {
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: `${BASE}/${hub.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: hub.h1 }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: hub.metaTitle,
      description: hub.metaDescription,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DestinationHubPage({
  params,
}: {
  params: Promise<{ destination: string }>
}) {
  const { destination } = await params
  const hub = getHubForSlug(destination)
  if (hub == null) notFound()

  const countries = getHubCountries(hub)
  const db = createServiceClient()

  const { data } = await db
    .from('experience_pages')
    .select(
      'id, slug, experience_name, country, region, price_from, price_type, currency, hero_image_url, gallery_image_urls, difficulty, non_angler_friendly',
    )
    .eq('status', 'active')
    .in('country', countries)
    .order('created_at', { ascending: false })

  const pages = (data ?? []) as ExpPage[]

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: hub.h1,
    numberOfItems: pages.length,
    itemListElement: pages.map((exp, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'TouristTrip',
        name: exp.experience_name,
        url: `${BASE}/experiences/${exp.slug}`,
        ...(exp.hero_image_url != null ? { image: exp.hero_image_url } : {}),
      },
    })),
  }

  return (
    <div style={{ background: '#F3EDE4' }}>
      <WebEventTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      {/* Spacer for fixed nav */}
      <div style={{ height: '72px' }} />

      {/* Hero */}
      <header className="max-w-7xl mx-auto px-4 md:px-8 pt-12 pb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-6 h-px" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
            FjordAnglers
          </p>
        </div>
        <h1
          className="f-display font-bold mb-6"
          style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.06, color: '#0A2E4D' }}
        >
          {hub.h1}
        </h1>
        <p
          className="f-body leading-relaxed"
          style={{ fontSize: '17px', color: 'rgba(10,46,77,0.72)', maxWidth: '640px' }}
        >
          {hub.intro}
        </p>
      </header>

      {/* Card grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
        {pages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map((page, idx) => (
              <ExpCard key={page.id} page={page} priority={idx < 3} />
            ))}
          </div>
        )}
      </main>

      {/* How it works */}
      <section style={{ background: '#0A2E4D' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <h2
            className="f-display font-bold text-white mb-12"
            style={{ fontSize: 'clamp(24px, 3.5vw, 40px)' }}
          >
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map(step => (
              <div key={step.n}>
                <p
                  className="f-display font-bold mb-3"
                  style={{ fontSize: '56px', color: 'rgba(255,255,255,0.10)', lineHeight: 1 }}
                >
                  {step.n}
                </p>
                <p className="f-body font-semibold mb-2" style={{ fontSize: '16px', color: '#fff' }}>
                  {step.title}
                </p>
                <p className="f-body leading-relaxed" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
