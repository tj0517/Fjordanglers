import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { createServiceClient } from '@/lib/supabase/server'
import { MapPin, Check, X as XIcon, ChevronDown } from 'lucide-react'
import ExpPageMapWrapper from '@/app/trips/exp-page-map-wrapper'
import type { ExpPage } from '@/app/trips/exp-page-map-section'
import { InquiryWidget, MobileInquiryBar } from '@/components/inquiry/InquiryWidget'
import { CountryFlag } from '@/components/ui/country-flag'
import { ExperiencePageWithOptions } from '@/components/trips/ExperiencePageWithOptions'
import { SeasonCalendarGrid } from '@/components/trips/SeasonCalendarGrid'
import { ExperienceGallery } from '@/components/trips/experience-gallery'
import type { SpeciesDetailItem, SpecialAttraction, ContentBlock, FaqItem, Accommodation, Boat } from '@/actions/experience-pages'
import type { TripOption } from '@/components/trips/TripOptionsAccordion'

/**
 * /experiences/[slug] — Public editorial experience page.
 *
 * Layout (per PDF spec):
 *   PHOTO → INTRODUCE → QUICK FIT → ABOUT THIS EXPERIENCE → PHOTOS
 *   → WHAT YOU CAN CATCH (alternating fish|photo + per-fish season)
 *   → ROD SETUP → BOAT | PHOTO → PHOTO | SPECIAL ATTRACTION
 *   → LOCATION → WHAT'S INCLUDED → PRICE
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SalmonRule() {
  return <div className="w-10 h-px" style={{ background: '#E67E50' }} />
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-5 f-body"
      style={{ color: '#E67E50' }}>{label}</p>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const svc = createServiceClient()
  const { data: page } = await svc
    .from('experience_pages')
    .select('experience_name, meta_title, meta_description, hero_image_url, og_image_url, gallery_image_urls, country, region, price_from, price_type')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (page == null) return {}

  const title      = page.meta_title ?? `${page.experience_name} | FjordAnglers`
  const description = page.meta_description
    ?? (page.price_type === 'request'
      ? `Guided fishing in ${page.region}, ${page.country}. Price on request. Book via FjordAnglers.`
      : `Fish with an expert guide in ${page.region}, ${page.country}. From €${page.price_from}. Book via FjordAnglers.`)
  const gallery    = (page.gallery_image_urls as string[] | null) ?? []
  const ogImage    = page.og_image_url ?? gallery[0] ?? page.hero_image_url

  return {
    title,
    description,
    alternates: { canonical: `https://fjordanglers.com/experiences/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://fjordanglers.com/experiences/${slug}`,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: page.experience_name }] : [],
    },
    twitter: { card: 'summary_large_image' as const, title, description, images: ogImage ? [ogImage] : [] },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExperiencePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const svc = createServiceClient()

  const { data: rawPage } = await svc
    .from('experience_pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (rawPage == null) notFound()

  // Cast to include columns added in 20260427_experience_pages_v2.sql
  // and 20260512_move_faq_to_experience_pages.sql
  // (not yet in auto-generated DB types — will be updated after migration runs)
  type PageWithNewCols = typeof rawPage & {
    intro_text:          string | null
    species_details:     unknown
    boats:               unknown
    special_attractions: unknown
    what_to_bring:       unknown
    accommodations:      unknown
    faq:                 unknown
    content_photo_urls:  unknown
    content_blocks:      unknown
    price_type:          string
  }
  const page = rawPage as unknown as PageWithNewCols

  function formatPrice(priceFrom: number, priceType: string): string {
    if (priceType === 'request') return 'Price on request'
    if (priceType === 'flat') return `from €${priceFrom} for the group`
    return `from €${priceFrom} / person`
  }

  // Fetch blocked dates for InquiryWidget if trip_id is set
  let blockedRanges: Array<{ date_start: string; date_end: string }> = []
  let maxGuests = 12

  if (page.trip_id) {
    const today     = new Date().toISOString().slice(0, 10)
    const yearAhead = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

    const [{ data: expData }, { data: expCalendars }, { data: allGuideCalendars }] = await Promise.all([
      svc.from('experiences').select('max_guests, guide_id').eq('id', page.trip_id).single(),
      svc.from('calendar_experiences').select('calendar_id').eq('experience_id', page.trip_id),
      page.guide_id
        ? svc.from('guide_calendars').select('id').eq('guide_id', page.guide_id)
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
    ])

    if (expData?.max_guests) maxGuests = expData.max_guests

    const specificIds = (expCalendars ?? []).map((c: { calendar_id: string }) => c.calendar_id)
    const calendarIds = specificIds.length > 0
      ? specificIds
      : (allGuideCalendars ?? []).map((c: { id: string }) => c.id)

    if (calendarIds.length > 0) {
      const { data: blocked } = await svc
        .from('calendar_blocked_dates')
        .select('date_start, date_end')
        .in('calendar_id', calendarIds)
        .gte('date_end', today)
        .lte('date_start', yearAhead)
      blockedRanges = blocked ?? []
    }
  }

  // Guide info
  const { data: guide } = page.guide_id
    ? await svc
        .from('guides')
        .select('id, full_name, avatar_url, bio, tagline, country, city, years_experience, fish_expertise, average_rating, total_reviews, languages, slug')
        .eq('id', page.guide_id)
        .single()
    : { data: null }

  // Trip options for this page
  const { data: rawOptions } = await svc
    .from('experience_page_options')
    .select('*')
    .eq('experience_page_id', page.id)
    .order('sort_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tripOptions: TripOption[] = ((rawOptions ?? []) as unknown as any[]).map((o: any) => ({
    id:                        o.id,
    sort_order:                o.sort_order,
    label:                     o.label,
    price_from:                Number(o.price_from),
    price_type:                (o.price_type as string | null) ?? 'per_person',
    content_blocks:            (o.content_blocks as ContentBlock[] | null) ?? [],
    catches_text:              o.catches_text ?? null,
    target_species:            (o.target_species as string[] | null) ?? [],
    boats:                     (o.boats as Boat[] | null) ?? [],
    season_months:             o.season_months ?? [],
    peak_months:               o.peak_months   ?? [],
    special_attractions:       (o.special_attractions as SpecialAttraction[] | null) ?? [],
    meeting_point_name:        o.meeting_point_name ?? null,
    meeting_point_description: o.meeting_point_description ?? null,
    location_lat:              o.location_lat ?? null,
    location_lng:              o.location_lng ?? null,
    what_to_bring:             (o.what_to_bring as string[] | null) ?? [],
    includes:                  (o.includes as string[] | null) ?? [],
    excludes:                  (o.excludes as string[] | null) ?? [],
  }))

  const hasOptions = tripOptions.length > 0

  // Similar experience pages
  const { data: sameCountryRaw } = await svc
    .from('experience_pages')
    .select('id, slug, experience_name, country, region, price_from, price_type, hero_image_url, gallery_image_urls, technique, target_species, difficulty')
    .eq('status', 'active')
    .eq('country', page.country)
    .neq('id', page.id)
    .limit(3)

  let similarTrips = sameCountryRaw ?? []

  if (similarTrips.length === 0) {
    const { data: anyRaw } = await svc
      .from('experience_pages')
      .select('id, slug, experience_name, country, region, price_from, price_type, hero_image_url, gallery_image_urls, technique, target_species, difficulty')
      .eq('status', 'active')
      .neq('id', page.id)
      .limit(3)
    similarTrips = anyRaw ?? []
  }

  // Quick Fit: when options exist, aggregate all target_species across options (union)
  const pageSpecies     = (page.target_species as string[] | null) ?? []
  const species = hasOptions
    ? Array.from(new Set(tripOptions.flatMap(o => o.target_species)))
    : pageSpecies
  const technique       = (page.technique          as string[] | null) ?? []
  const env             = (page.environment        as string[] | null) ?? []
  const includes        = (page.includes           as string[] | null) ?? []
  const excludes        = (page.excludes           as string[] | null) ?? []
  const gallery         = (page.gallery_image_urls as string[] | null) ?? []
  const contentPhotos   = (page.content_photo_urls  as string[] | null) ?? []
  const viewsPhotos     = (page.views_image_urls    as string[] | null) ?? []
  const seasonMonths    = (page.season_months      as number[] | null) ?? []
  const peakMonths      = (page.peak_months        as number[] | null) ?? []
  const speciesDetails       = (page.species_details    as SpeciesDetailItem[]  | null) ?? []
  const boats                = (page.boats              as Boat[]               | null) ?? []
  const specialAttractions   = (page.special_attractions as SpecialAttraction[]  | null) ?? []
  const accommodations       = (page.accommodations      as Accommodation[]      | null) ?? []
  const whatToBring          = (page.what_to_bring      as string[]             | null) ?? []
  const faq                  = (page.faq               as FaqItem[]            | null) ?? []
  const pageContentBlocks    = (page.content_blocks     as ContentBlock[]       | null) ?? []
  const guideLanguages       = (guide?.languages        as string[]             | null) ?? []


  // Build ExpPage for the map — used in both mobile and desktop LOCATION sections
  const currentExpPage: ExpPage = {
    id:                  rawPage.id,
    slug:                rawPage.slug,
    experience_name:     rawPage.experience_name,
    country:             rawPage.country,
    region:              rawPage.region,
    price_from:          rawPage.price_from,
    price_type:          page.price_type,
    hero_image_url:      rawPage.hero_image_url,
    gallery_image_urls:  rawPage.gallery_image_urls,
    difficulty:          rawPage.difficulty,
    technique:           rawPage.technique,
    target_species:      rawPage.target_species,
    non_angler_friendly: rawPage.non_angler_friendly,
    location_lat:        rawPage.location_lat,
    location_lng:        rawPage.location_lng,
    location_area:       rawPage.location_area,
    location_spots:      rawPage.location_spots,
  }
  const hasMap = rawPage.location_lat != null || rawPage.location_area != null

  const difficultyColor: Record<string, { bg: string; color: string }> = {
    Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
    Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
    Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
    Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
  }

  const topImages = gallery.length > 0
    ? gallery.map((url, i) => ({ id: String(i), url, is_cover: i === 0 }))
    : page.hero_image_url
      ? [{ id: '0', url: page.hero_image_url, is_cover: true }]
      : []

  const tripSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: page.experience_name,
    description: page.meta_description ?? `Guided fishing trip in ${page.region}, ${page.country}. Book with verified local guides via FjordAnglers.`,
    ...(page.hero_image_url != null ? { image: page.hero_image_url } : {}),
    url: `https://fjordanglers.com/experiences/${slug}`,
    touristType: ['Fishing', 'Outdoor Activity'],
    ...(page.price_from != null && page.price_type !== 'request' ? {
      offers: {
        '@type': 'Offer',
        price: page.price_from,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `https://fjordanglers.com/experiences/${slug}`,
      },
    } : {}),
    provider: { '@type': 'Organization', name: 'FjordAnglers', url: 'https://fjordanglers.com' },
    ...(guide != null ? {
      subjectOf: {
        '@type': 'Person',
        name: guide.full_name,
        url: `https://fjordanglers.com/guides/${guide.id}`,
      },
    } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://fjordanglers.com' },
      { '@type': 'ListItem', position: 2, name: 'Trips', item: 'https://fjordanglers.com/trips' },
      { '@type': 'ListItem', position: 3, name: page.experience_name, item: `https://fjordanglers.com/experiences/${slug}` },
    ],
  }

  const faqSchema = faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <SiteNav />
      {/* ─── MOBILE GALLERY (below nav, compact height) ── */}
      {topImages.length > 0 && (
        <div className="md:hidden pt-[72px] relative">
          <ExperienceGallery images={topImages} title={page.experience_name} topMobile />
          {/* Back button — absolute over photo, just under nav */}
          <Link
            href="/trips"
            className="absolute left-4 inline-flex items-center gap-1.5 f-body text-[13px] font-medium z-10"
            style={{
              top: '80px',
              color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none',
              background: 'rgba(0,0,0,0.32)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              padding: '5px 11px',
              borderRadius: '20px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11L5 7l4-4"/>
            </svg>
            All trips
          </Link>
          {/* Price overlay — absolute on photo */}
          <div className="absolute bottom-10 left-4 z-10 pointer-events-none">
            <span className="font-bold f-display text-white" style={{ fontSize: '22px', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
              {formatPrice(page.price_from, page.price_type)}
            </span>
          </div>
        </div>
      )}

      {/* ─── MOBILE TITLE CARD (overlays gallery bottom) ── */}
      <div
        className="md:hidden relative z-10"
        style={{ marginTop: topImages.length > 0 ? '-28px' : '72px', background: '#F3EDE4', borderRadius: '28px 28px 0 0' }}
      >
        {/* Drag-handle pill */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(10,46,77,0.15)' }} />
        </div>
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin size={12} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
            <span className="text-xs f-body font-semibold" style={{ color: 'rgba(10,46,77,0.55)' }}>
              {page.region}, {page.country}
            </span>
            {page.season_start != null && page.season_end != null && (
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                · {page.season_start}–{page.season_end}
              </span>
            )}
          </div>
          <h1
            className="font-bold f-display leading-tight"
            style={{ fontSize: 'clamp(22px, 6.5vw, 30px)', color: '#0A2E4D' }}
          >
            {page.experience_name}
          </h1>
        </div>
      </div>

      {/* ── BACK BUTTON (desktop only — mobile version is overlaid on gallery) ── */}
      <div className="hidden md:block max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-16 pt-[110px] pb-2">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 f-body text-[13px] font-medium transition-opacity hover:opacity-60"
          style={{ color: 'rgba(10,46,77,0.5)', textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11L5 7l4-4"/>
          </svg>
          All trips
        </Link>
      </div>

      {/* ── OUTER CONTAINER ── */}
      <div className="pt-0 md:pt-2 max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-16">

        {/* ──────────── GALLERY BENTO (desktop only) ──────────── */}
        {topImages.length > 0 && (
          <div className="hidden md:block pt-8 md:pt-10">
            <ExperienceGallery images={topImages} title={page.experience_name} />
          </div>
        )}

        {/* ── TITLE BLOCK (desktop only) ── */}
        <div className="hidden md:block pb-6 lg:pb-8" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5 text-xs f-body flex-wrap"
            style={{ color: 'rgba(10,46,77,0.38)' }}>
            <Link href="/" className="hover:text-[#0A2E4D] transition-colors">Home</Link>
            <span style={{ color: 'rgba(10,46,77,0.2)' }}>›</span>
            <Link href="/trips" className="hover:text-[#0A2E4D] transition-colors">Experiences</Link>
            <span style={{ color: 'rgba(10,46,77,0.2)' }}>›</span>
            <span style={{ color: 'rgba(10,46,77,0.6)' }}>{page.experience_name}</span>
          </div>

          {/* Location + season range */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <MapPin size={13} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
            <span className="text-sm f-body font-semibold" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {page.region}, {page.country}
            </span>
            {page.season_start && page.season_end && (
              <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                · {page.season_start}–{page.season_end}
              </span>
            )}
          </div>

          {/* H1 */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold f-display leading-[1.0] mb-5"
            style={{ color: '#0A2E4D', letterSpacing: '-0.01em' }}>
            {page.experience_name}
          </h1>

          {/* Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold f-display text-xl" style={{ color: '#0A2E4D' }}>
              {formatPrice(page.price_from, page.price_type)}
            </span>
            {env.length > 0 && (
              <>
                <span style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
                {env.map(e => (
                  <span key={e} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                    style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.65)', border: '1px solid rgba(10,46,77,0.1)' }}>
                    {e}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── TWO-COLUMN CONTENT GRID ── */}
        {hasOptions ? (
          /* ─── OPTIONS MODE: ExperiencePageWithOptions manages both columns ─── */
          <ExperiencePageWithOptions
            options={tripOptions}
            faq={faq}
            pageContentBlocks={pageContentBlocks}
            speciesDetails={speciesDetails}
            tripId={page.trip_id ?? null}
            experiencePageId={page.trip_id ? undefined : page.id}
            tripTitle={page.experience_name}
            maxGuests={maxGuests}
            blockedRanges={blockedRanges}
            priceFrom={page.price_from ?? null}
            priceType={page.price_type ?? null}
          >
            {/* These server-rendered sections go in the left column */}

            {/* INTRODUCE */}
            {page.intro_text && (
              <section className="mb-10">
                <p className="text-lg sm:text-xl f-body leading-relaxed text-justify font-medium"
                  style={{ color: '#0A2E4D' }}>
                  {page.intro_text}
                </p>
              </section>
            )}

            {/* QUICK FIT */}
            {(species.length > 0 || technique.length > 0 || guideLanguages.length > 0 || page.difficulty || page.physical_effort || page.non_angler_friendly) && (
              <section className="mb-12 p-6 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <SalmonRule />
                <SectionLabel label="Quick Fit" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(page.difficulty || page.physical_effort || page.non_angler_friendly) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Level</p>
                      <div className="flex flex-wrap gap-2">
                        {page.difficulty && (() => {
                          const dc = difficultyColor[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }
                          return <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: dc.bg, color: dc.color }}>{page.difficulty}</span>
                        })()}
                        {page.physical_effort && (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>
                            {page.physical_effort} effort
                          </span>
                        )}
                        {page.non_angler_friendly && (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}>
                            Family-friendly
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {species.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Target species</p>
                      <div className="flex flex-wrap gap-2">
                        {species.map(s => (
                          <span key={s} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {technique.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Technique</p>
                      <div className="flex flex-wrap gap-2">
                        {technique.map(t => (
                          <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guideLanguages.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Guide speaks</p>
                      <div className="flex flex-wrap gap-2">
                        {guideLanguages.map(lang => (
                          <span key={lang} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ABOUT */}
            {page.story_text && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="About this experience" />
                <div className="space-y-4">
                  {page.story_text.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.75)' }}>
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* PHOTOS */}
            {contentPhotos.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Photos" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {contentPhotos.slice(0, 6).map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden">
                      <Image src={url} alt={`${page.experience_name} photo ${i + 1}`} fill className="object-cover"
                        sizes="(min-width: 1280px) 260px, (min-width: 640px) 30vw, 48vw" />
                    </div>
                  ))}
                </div>
                {contentPhotos.length > 6 && (
                  <p className="mt-3 text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    + {contentPhotos.length - 6} more photos
                  </p>
                )}
              </section>
            )}

            {/* VIEWS */}
            {viewsPhotos.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Views" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {viewsPhotos.slice(0, 6).map((url, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                      <Image src={url} alt={`${page.experience_name} view ${i + 1}`} fill className="object-cover"
                        sizes="(min-width: 1280px) 260px, (min-width: 640px) 30vw, 48vw" />
                    </div>
                  ))}
                </div>
                {viewsPhotos.length > 6 && (
                  <p className="mt-3 text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    + {viewsPhotos.length - 6} more views
                  </p>
                )}
              </section>
            )}

            {/* WHAT YOU CAN CATCH */}
            {(page.catches_text || speciesDetails.length > 0) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="What you can catch" />
                {page.catches_text && (
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-8" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {page.catches_text}
                  </p>
                )}
                {speciesDetails.length > 0 && (
                  <div className="space-y-12">
                    {speciesDetails.map((fish, idx) => {
                      const fishPhotos = fish.image_urls?.length ? fish.image_urls : (fish.image_url ? [fish.image_url] : [])
                      return (
                      <div key={fish.name}>
                        <div className={`flex flex-col sm:flex-row${idx % 2 === 1 ? '-reverse' : ''} gap-6 items-start`}>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{fish.name}</h3>
                            {fish.description && (
                              <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                                {fish.description}
                              </p>
                            )}
                          </div>
                          {fishPhotos[0] && (
                            <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                              <Image src={fishPhotos[0]} alt={fish.name} fill className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                            </div>
                          )}
                        </div>
                        {fishPhotos.length > 1 && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {fishPhotos.slice(1, 4).map((url, pi) => (
                              <div key={pi} className="relative aspect-[4/3] rounded-xl overflow-hidden">
                                <Image src={url} alt={`${fish.name} photo ${pi + 2}`} fill className="object-cover" sizes="(min-width: 640px) 220px, 30vw" />
                              </div>
                            ))}
                          </div>
                        )}
                        {fish.season_months.length > 0 && (
                          <div className="mt-5">
                            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Season</p>
                            <SeasonCalendarGrid seasonMonths={fish.season_months} peakMonths={fish.peak_months} clickable />
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ROD SETUP */}
            {page.rod_setup && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Rod setup & recommended gear" />
                <div className="px-5 py-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {page.rod_setup}
                  </p>
                </div>
              </section>
            )}

            {/* PAGE CONTENT BLOCKS */}
            {pageContentBlocks.length > 0 && (
              <div className="space-y-10 mb-12">
                {pageContentBlocks.map((block, i) => (
                  <section key={i}>
                    {block.headline && (
                      <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
                        {block.headline}
                      </h4>
                    )}
                    {block.image_url ? (
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[300px] aspect-[4/3]">
                          <Image src={block.image_url} alt={block.headline || `Photo ${i + 1}`} fill className="object-cover" sizes="(min-width: 640px) 300px, 100vw" />
                        </div>
                        {block.text && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {block.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : block.text && (
                      <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                        {block.text}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            )}

            {/* BOAT */}
            {boats.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="The boat" />
                <div className="space-y-10">
                  {boats.map((boat, idx) => (
                    <div key={idx}>
                      {boat.heading && (
                        <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{boat.heading}</h4>
                      )}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {boat.description && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {boat.description}
                            </p>
                          </div>
                        )}
                        {boat.image_url && (
                          <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                            <Image src={boat.image_url} alt={boat.heading || `Boat ${idx + 1}`} fill className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SEASON */}
            {(seasonMonths.length > 0 || page.season_start || page.best_months) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Season" />
                {page.season_start && page.season_end && (
                  <p className="text-lg font-bold f-display mb-4" style={{ color: '#0A2E4D' }}>
                    {page.season_start} – {page.season_end}
                  </p>
                )}
                {seasonMonths.length > 0 && (
                  <div className="mb-4">
                    <SeasonCalendarGrid seasonMonths={seasonMonths} peakMonths={peakMonths} clickable />
                  </div>
                )}
                {page.best_months && (
                  <p className="text-sm f-body leading-relaxed text-justify mt-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {page.best_months}
                  </p>
                )}
              </section>
            )}

            {/* ACCOMMODATION */}
            {accommodations.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Accommodation" />
                <div className="space-y-10">
                  {accommodations.map((item, idx) => (
                    <div key={idx}>
                      {item.heading && (
                        <h3 className="text-xl font-bold f-display mb-4" style={{ color: '#0A2E4D' }}>
                          {item.heading}
                        </h3>
                      )}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {item.description && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {item.description}
                            </p>
                          </div>
                        )}
                        {item.image_url && (
                          <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                            <Image src={item.image_url} alt={item.heading || `Accommodation ${idx + 1}`} fill
                              className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LOCATION + MAP */}
            {(page.meeting_point_name || page.meeting_point_description || hasMap) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Location" />
                {page.meeting_point_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={15} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
                    <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{page.meeting_point_name}</p>
                  </div>
                )}
                {page.meeting_point_description && (
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-6" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    {page.meeting_point_description}
                  </p>
                )}
                {hasMap && (
                  <div className="rounded-2xl overflow-hidden" style={{ height: '320px', position: 'relative', zIndex: 0 }}>
                    <ExpPageMapWrapper
                      pages={[currentExpPage]}
                      hoveredPageId={rawPage.id}
                      showPopups={false}
                      interactive={false}
                    />
                  </div>
                )}
              </section>
            )}
          </ExperiencePageWithOptions>
        ) : (
        /* ─── FLAT MODE: no options → original two-column layout ─── */
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 py-12 lg:py-14">

          {/* ── LEFT COLUMN ── */}
          <div className="flex-1 min-w-0">

            {/* ──────────── INTRODUCE ──────────── */}
            {page.intro_text && (
              <section className="mb-10">
                <p className="text-lg sm:text-xl f-body leading-relaxed text-justify font-medium"
                  style={{ color: '#0A2E4D' }}>
                  {page.intro_text}
                </p>
              </section>
            )}

            {/* ──────────── QUICK FIT ──────────── */}
            {(species.length > 0 || technique.length > 0 || guideLanguages.length > 0 || page.difficulty || page.physical_effort || page.non_angler_friendly) && (
              <section className="mb-12 p-6 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <SalmonRule />
                <SectionLabel label="Quick Fit" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(page.difficulty || page.physical_effort || page.non_angler_friendly) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Level</p>
                      <div className="flex flex-wrap gap-2">
                        {page.difficulty && (() => {
                          const dc = difficultyColor[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }
                          return <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: dc.bg, color: dc.color }}>{page.difficulty}</span>
                        })()}
                        {page.physical_effort && (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>
                            {page.physical_effort} effort
                          </span>
                        )}
                        {page.non_angler_friendly && (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}>
                            Family-friendly
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {species.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Target species</p>
                      <div className="flex flex-wrap gap-2">
                        {species.map(s => (
                          <span key={s} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {technique.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Technique</p>
                      <div className="flex flex-wrap gap-2">
                        {technique.map(t => (
                          <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guideLanguages.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Guide speaks</p>
                      <div className="flex flex-wrap gap-2">
                        {guideLanguages.map(lang => (
                          <span key={lang} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ──────────── ABOUT THIS EXPERIENCE ──────────── */}
            {page.story_text && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="About this experience" />
                <div className="space-y-4">
                  {page.story_text.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.75)' }}>
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────── PHOTOS ──────────── */}
            {contentPhotos.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Photos" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {contentPhotos.slice(0, 6).map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden">
                      <Image
                        src={url}
                        alt={`${page.experience_name} photo ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 260px, (min-width: 640px) 30vw, 48vw"
                      />
                    </div>
                  ))}
                </div>
                {contentPhotos.length > 6 && (
                  <p className="mt-3 text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    + {contentPhotos.length - 6} more photos
                  </p>
                )}
              </section>
            )}


            {/* ──────────── VIEWS ──────────── */}
            {viewsPhotos.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Views" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {viewsPhotos.slice(0, 6).map((url, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                      <Image
                        src={url}
                        alt={`${page.experience_name} view ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 260px, (min-width: 640px) 30vw, 48vw"
                      />
                    </div>
                  ))}
                </div>
                {viewsPhotos.length > 6 && (
                  <p className="mt-3 text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    + {viewsPhotos.length - 6} more views
                  </p>
                )}
              </section>
            )}

            {/* ──────────── WHAT YOU CAN CATCH ──────────── */}
            {(page.catches_text || speciesDetails.length > 0) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="What you can catch" />
                {page.catches_text && (
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-8" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {page.catches_text}
                  </p>
                )}
                {speciesDetails.length > 0 && (
                  <div className="space-y-12">
                    {speciesDetails.map((fish, idx) => {
                      const fishPhotos = fish.image_urls?.length ? fish.image_urls : (fish.image_url ? [fish.image_url] : [])
                      return (
                      <div key={fish.name}>
                        <div className={`flex flex-col sm:flex-row${idx % 2 === 1 ? '-reverse' : ''} gap-6 items-start`}>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{fish.name}</h3>
                            {fish.description && (
                              <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                                {fish.description}
                              </p>
                            )}
                          </div>
                          {fishPhotos[0] && (
                            <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                              <Image src={fishPhotos[0]} alt={fish.name} fill className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                            </div>
                          )}
                        </div>
                        {fishPhotos.length > 1 && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {fishPhotos.slice(1, 4).map((url, pi) => (
                              <div key={pi} className="relative aspect-[4/3] rounded-xl overflow-hidden">
                                <Image src={url} alt={`${fish.name} photo ${pi + 2}`} fill className="object-cover" sizes="(min-width: 640px) 220px, 30vw" />
                              </div>
                            ))}
                          </div>
                        )}
                        {fish.season_months.length > 0 && (
                          <div className="mt-5">
                            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Season</p>
                            <SeasonCalendarGrid seasonMonths={fish.season_months} peakMonths={fish.peak_months} clickable />
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ──────────── ROD SETUP & GEAR ──────────── */}
            {page.rod_setup && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Rod setup & recommended gear" />
                <div className="px-5 py-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {page.rod_setup}
                  </p>
                </div>
              </section>
            )}

            {/* ──────────── SEASON (overall) ──────────── */}
            {!speciesDetails.some(s => s.season_months.length > 0) &&
              (seasonMonths.length > 0 || page.season_start || page.best_months) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Season" />
                {page.season_start && page.season_end && (
                  <p className="text-lg font-bold f-display mb-4" style={{ color: '#0A2E4D' }}>
                    {page.season_start} – {page.season_end}
                  </p>
                )}
                {seasonMonths.length > 0 && (
                  <div className="mb-4">
                    <SeasonCalendarGrid seasonMonths={seasonMonths} peakMonths={peakMonths} clickable />
                  </div>
                )}
                {page.best_months && (
                  <p className="text-sm f-body leading-relaxed text-justify mt-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {page.best_months}
                  </p>
                )}
              </section>
            )}

            {/* ──────────── PAGE CONTENT BLOCKS ──────────── */}
            {pageContentBlocks.length > 0 && (
              <div className="space-y-10 mb-12">
                {pageContentBlocks.map((block, i) => (
                  <section key={i}>
                    {block.headline && (
                      <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
                        {block.headline}
                      </h4>
                    )}
                    {block.image_url ? (
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[300px] aspect-[4/3]">
                          <Image src={block.image_url} alt={block.headline || `Photo ${i + 1}`} fill className="object-cover" sizes="(min-width: 640px) 300px, 100vw" />
                        </div>
                        {block.text && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {block.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : block.text && (
                      <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                        {block.text}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            )}

            {/* ──────────── BOAT ──────────── */}
            {boats.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="The boat" />
                <div className="space-y-10">
                  {boats.map((boat, idx) => (
                    <div key={idx}>
                      {boat.heading && (
                        <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{boat.heading}</h4>
                      )}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {boat.description && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {boat.description}
                            </p>
                          </div>
                        )}
                        {boat.image_url && (
                          <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                            <Image src={boat.image_url} alt={boat.heading || `Boat ${idx + 1}`} fill className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────── SPECIAL ATTRACTIONS (multi) ──────────── */}
            {specialAttractions.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Special attractions" />
                <div className="space-y-10">
                  {specialAttractions.map((attr, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row-reverse gap-6 items-start">
                      {/* Text (right on desktop) */}
                      {attr.text && (
                        <div className="flex-1 min-w-0">
                          <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                            {attr.text}
                          </p>
                        </div>
                      )}
                      {/* Photo (left on desktop) */}
                      {attr.image_url && (
                        <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                          <Image
                            src={attr.image_url}
                            alt={`Special attraction ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="(min-width: 640px) 340px, 100vw"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────── ACCOMMODATION ──────────── */}
            {accommodations.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Accommodation" />
                <div className="space-y-10">
                  {accommodations.map((item, idx) => (
                    <div key={idx}>
                      {item.heading && (
                        <h3 className="text-xl font-bold f-display mb-4" style={{ color: '#0A2E4D' }}>
                          {item.heading}
                        </h3>
                      )}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {item.description && (
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {item.description}
                            </p>
                          </div>
                        )}
                        {item.image_url && (
                          <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[340px] aspect-[4/3]">
                            <Image src={item.image_url} alt={item.heading || `Accommodation ${idx + 1}`} fill
                              className="object-cover" sizes="(min-width: 640px) 340px, 100vw" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────── LOCATION ──────────── */}
            {(page.meeting_point_name || page.meeting_point_description || hasMap) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Location" />
                {page.meeting_point_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={15} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
                    <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{page.meeting_point_name}</p>
                  </div>
                )}
                {page.meeting_point_description && (
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-6" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    {page.meeting_point_description}
                  </p>
                )}
                {hasMap && (
                  <div className="rounded-2xl overflow-hidden" style={{ height: '320px', position: 'relative', zIndex: 0 }}>
                    <ExpPageMapWrapper
                      pages={[currentExpPage]}
                      hoveredPageId={rawPage.id}
                      showPopups={false}
                      interactive={false}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ──────────── WHAT TO BRING ──────────── */}
            {whatToBring.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="What to bring" />
                <ul className="space-y-2">
                  {whatToBring.map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-base f-body font-medium" style={{ color: '#0A2E4D' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ──────────── WHAT'S INCLUDED ──────────── */}
            {(includes.length > 0 || excludes.length > 0) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="What's included" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {includes.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Included</p>
                      <ul className="space-y-2">
                        {includes.map(item => (
                          <li key={item} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: 'rgba(74,222,128,0.15)' }}>
                              <Check size={10} strokeWidth={2.5} style={{ color: '#16A34A' }} />
                            </div>
                            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.75)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {excludes.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Not included</p>
                      <ul className="space-y-2">
                        {excludes.map(item => (
                          <li key={item} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(239,68,68,0.08)' }}>
                              <XIcon size={10} strokeWidth={2.5} style={{ color: '#DC2626' }} />
                            </div>
                            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ──────────── FAQ ──────────── */}
            {faq.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="FAQ" />
                <div className="space-y-2">
                  {faq.map((item, i) => (
                    <details key={i} className="group rounded-2xl overflow-hidden"
                      style={{ border: '1.5px solid rgba(10,46,77,0.08)' }}>
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
                        style={{ background: 'rgba(10,46,77,0.02)', listStyle: 'none' }}>
                        <span className="text-sm font-semibold f-body pr-4" style={{ color: '#0A2E4D' }}>
                          {item.question}
                        </span>
                        <ChevronDown size={15} className="flex-shrink-0 transition-transform group-open:rotate-180"
                          style={{ color: 'rgba(10,46,77,0.4)' }} />
                      </summary>
                      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                        <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
                          {item.answer}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────── PRICE ──────────── */}
            <section className="mb-4">
              <SalmonRule />
              <SectionLabel label="Price" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <div className="flex-1">
                  <p className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                    {formatPrice(page.price_from, page.price_type)}
                  </p>
                  {page.currency && page.currency !== 'EUR' && page.price_type !== 'request' && (
                    <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Prices in {page.currency}
                    </p>
                  )}
                  {page.price_type !== 'request' && (
                    <p className="text-sm f-body mt-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {page.price_type === 'flat' ? 'Flat rate for the group · includes guide service' : 'Per person · includes guide service'}
                    </p>
                  )}
                </div>
                {/* Mobile CTA — visible only on mobile since desktop has the sidebar widget */}
                <div className="lg:hidden">
                  {page.trip_id ? null : (
                    <Link
                      href={`mailto:contact@fjordanglers.com?subject=Inquiry: ${encodeURIComponent(page.experience_name)}`}
                      className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold f-body text-sm"
                      style={{ background: '#E67E50', color: '#fff', boxShadow: '0 4px 14px rgba(230,126,80,0.35)' }}
                    >
                      Book this trip →
                    </Link>
                  )}
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT COLUMN — sticky widget ── */}
          <div className="hidden lg:block lg:w-[360px] flex-shrink-0">
            <div className="sticky top-28">
              <InquiryWidget
                tripId={page.trip_id ?? undefined}
                experiencePageId={page.trip_id ? undefined : page.id}
                tripTitle={page.experience_name}
                maxGuests={maxGuests}
                blockedRanges={blockedRanges}
                priceFrom={page.price_from ?? null}
                priceType={page.price_type ?? null}
              />
            </div>
          </div>

        </div>
        )} {/* end of ternary: hasOptions ? <ExperiencePageWithOptions> : <flat div> */}
      </div>

      {/* ── MOBILE BAR ── */}
      <MobileInquiryBar tripId={page.trip_id} pricePerPerson={page.price_from ?? null} priceType={page.price_type ?? null} />

      {/* ════════════════════════════════════════════════════════════
          BOTTOM SECTIONS — different background
          ════════════════════════════════════════════════════════════ */}

      {/* ── GUIDE SECTION ── */}
      {guide && (
        <section style={{ background: '#0A2E4D' }}>
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-16 py-16 lg:py-20">

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-px" style={{ background: '#E67E50' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] f-body" style={{ color: '#E67E50' }}>
                Your guide
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-8 lg:gap-12 items-start">

              <div className="flex-shrink-0">
                <div className="relative rounded-2xl overflow-hidden"
                  style={{ width: '100px', height: '100px', border: '2px solid rgba(255,255,255,0.12)' }}>
                  {guide.avatar_url ? (
                    <Image src={guide.avatar_url} alt={guide.full_name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center f-display text-3xl font-bold"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      {guide.full_name[0]}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold f-display text-white">{guide.full_name}</h2>
                  {guide.average_rating != null && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold f-body px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(230,126,80,0.18)', color: '#E67E50' }}>
                      ★ {guide.average_rating.toFixed(1)}
                      {guide.total_reviews > 0 && (
                        <span style={{ color: 'rgba(230,126,80,0.6)' }}>· {guide.total_reviews} reviews</span>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
                  {(guide.city || guide.country) && (
                    <span className="flex items-center gap-1.5 text-sm f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <CountryFlag country={guide.country} size={14} />
                      {[guide.city, guide.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {guide.years_experience != null && guide.years_experience > 0 && (
                    <span className="text-sm f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {guide.years_experience} years guiding
                    </span>
                  )}
                  {Array.isArray(guide.languages) && guide.languages.length > 0 && (
                    <span className="text-sm f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Speaks {(guide.languages as string[]).join(', ')}
                    </span>
                  )}
                </div>

                {(guide.tagline || guide.bio) && (
                  <p className="text-sm f-body leading-relaxed text-justify mb-6" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '560px' }}>
                    {guide.tagline ?? (guide.bio ? guide.bio.slice(0, 180) + (guide.bio.length > 180 ? '…' : '') : null)}
                  </p>
                )}

                {Array.isArray(guide.fish_expertise) && guide.fish_expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(guide.fish_expertise as string[]).slice(0, 5).map(f => (
                      <span key={f} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <Link
                  href={`/guides/${guide.id}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold f-body transition-all hover:opacity-90"
                  style={{ background: '#E67E50', color: '#fff', boxShadow: '0 4px 14px rgba(230,126,80,0.35)' }}
                >
                  View guide profile →
                </Link>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── SIMILAR TRIPS ── */}
      {similarTrips.length > 0 && (
        <section style={{ background: '#F3EDE4' }}>
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-16 py-16 lg:py-20">

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-px" style={{ background: '#E67E50' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] f-body" style={{ color: '#E67E50' }}>
                More like this
              </p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold f-display mb-10" style={{ color: '#0A2E4D' }}>
              {similarTrips.some(t => t.country === page.country)
                ? `More experiences in ${page.country}`
                : 'More curated experiences'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarTrips.map(trip => {
                const tripGallery = (trip.gallery_image_urls as string[] | null) ?? []
                const thumbUrl    = trip.hero_image_url ?? tripGallery[0]
                const tripTech    = (trip.technique as string[] | null) ?? []
                const tripDiff    = trip.difficulty

                const diffColor: Record<string, { bg: string; color: string }> = {
                  Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
                  Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
                  Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
                  Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
                }

                return (
                  <Link
                    key={trip.id}
                    href={`/experiences/${trip.slug}`}
                    className="group block rounded-3xl overflow-hidden transition-all hover:-translate-y-1"
                    style={{
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 4px 24px rgba(10,46,77,0.07)',
                    }}
                  >
                    <div className="relative overflow-hidden" style={{ height: '200px' }}>
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt={trip.experience_name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0A2E4D, #1a4a6e)' }} />
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(10,46,77,0.72)', backdropFilter: 'blur(8px)' }}>
                        <CountryFlag country={trip.country} size={12} />
                        <span className="text-[11px] font-semibold f-body text-white">{trip.region}</span>
                      </div>
                    </div>

                    <div className="px-5 py-5">
                      <h3 className="text-base font-bold f-display leading-snug mb-3" style={{ color: '#0A2E4D' }}>
                        {trip.experience_name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {tripDiff && (() => {
                          const dc = diffColor[tripDiff] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }
                          return (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full f-body"
                              style={{ background: dc.bg, color: dc.color }}>{tripDiff}</span>
                          )
                        })()}
                        {tripTech.slice(0, 2).map(t => (
                          <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.6)', border: '1px solid rgba(10,46,77,0.08)' }}>
                            {t}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                          {(trip as {price_type?: string}).price_type === 'request' ? 'Price on request' : `from €${trip.price_from}`}
                        </span>
                        <span className="text-xs font-semibold f-body transition-colors" style={{ color: '#E67E50' }}>
                          View →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-10 text-center">
              <Link
                href={`/trips?country=${encodeURIComponent(page.country)}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body transition-all hover:opacity-80"
                style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}
              >
                See all experiences in {page.country} →
              </Link>
            </div>

          </div>
        </section>
      )}

      <SiteFooter />
    </>
  )
}
