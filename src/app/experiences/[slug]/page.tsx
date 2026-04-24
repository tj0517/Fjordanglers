import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { MapPin, Check, X as XIcon } from 'lucide-react'
import { FISH_IMG } from '@/lib/fish'
import { InquiryWidget, MobileInquiryBar } from '@/components/inquiry/InquiryWidget'
import { ExperienceGallery } from '@/components/trips/experience-gallery'
import { HomeNav } from '@/components/home/home-nav'
import { CountryFlag } from '@/components/ui/country-flag'
import { Footer } from '@/components/layout/footer'

/**
 * /experiences/[slug] — Public editorial experience page.
 *
 * Layout:
 *   1. Gallery bento grid — same width as content columns below (not full-bleed)
 *   2. Title block — breadcrumb, location, h1, price + pills
 *   3. Two-column grid — left: all content | right: sticky inquiry widget
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

// ─── Season Calendar ───────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function SeasonCalendarGrid({
  seasonMonths,
  peakMonths,
}: {
  seasonMonths: number[]
  peakMonths:   number[]
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {MONTH_SHORT.map((label, i) => {
          const m      = i + 1
          const isPeak = peakMonths.includes(m)
          const isOpen = seasonMonths.includes(m)

          let bg: string, textColor: string, dotBg: string, statusText: string
          if (isPeak) {
            bg = '#E67E50'; textColor = '#fff'; dotBg = 'rgba(255,255,255,0.7)'; statusText = 'Peak'
          } else if (isOpen) {
            bg = 'rgba(230,126,80,0.08)'; textColor = 'rgba(10,46,77,0.65)'; dotBg = 'rgba(230,126,80,0.5)'; statusText = 'Open'
          } else {
            bg = 'rgba(10,46,77,0.035)'; textColor = 'rgba(10,46,77,0.2)'; dotBg = 'rgba(10,46,77,0.1)'; statusText = '—'
          }

          return (
            <div
              key={label}
              className="flex flex-col items-center justify-between rounded-2xl py-4 px-1"
              style={{ background: bg, minHeight: '88px' }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide f-body" style={{ color: textColor }}>
                {label}
              </span>
              <span className="w-2 h-2 rounded-full" style={{ background: dotBg }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] f-body text-center" style={{ color: textColor }}>
                {statusText}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap">
        {[
          { dot: '#E67E50',               label: 'Peak season' },
          { dot: 'rgba(230,126,80,0.5)',   label: 'Open season' },
          { dot: 'rgba(10,46,77,0.12)',    label: 'Off season'  },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.dot }} />
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const svc = createServiceClient()
  const { data: page } = await svc
    .from('experience_pages')
    .select('experience_name, meta_title, meta_description, hero_image_url, og_image_url, gallery_image_urls, country, region, price_from')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (page == null) return {}

  const title      = page.meta_title ?? `${page.experience_name} | FjordAnglers`
  const description = page.meta_description
    ?? `Fish with an expert guide in ${page.region}, ${page.country}. From €${page.price_from}. Book via FjordAnglers.`
  const gallery    = (page.gallery_image_urls as string[] | null) ?? []
  const ogImage    = page.og_image_url ?? gallery[0] ?? page.hero_image_url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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

  const { data: page } = await svc
    .from('experience_pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (page == null) notFound()

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

  // Similar experience pages — same country first, fall back to any active pages
  const { data: sameCountryRaw } = await svc
    .from('experience_pages')
    .select('id, slug, experience_name, country, region, price_from, hero_image_url, gallery_image_urls, technique, target_species, difficulty')
    .eq('status', 'active')
    .eq('country', page.country)
    .neq('id', page.id)
    .limit(3)

  let similarTrips = sameCountryRaw ?? []

  // Fallback: if no same-country results, show any other active experience pages
  if (similarTrips.length === 0) {
    const { data: anyRaw } = await svc
      .from('experience_pages')
      .select('id, slug, experience_name, country, region, price_from, hero_image_url, gallery_image_urls, technique, target_species, difficulty')
      .eq('status', 'active')
      .neq('id', page.id)
      .limit(3)
    similarTrips = anyRaw ?? []
  }

  const species      = (page.target_species     as string[] | null) ?? []
  const technique    = (page.technique          as string[] | null) ?? []
  const env          = (page.environment        as string[] | null) ?? []
  const includes     = (page.includes           as string[] | null) ?? []
  const excludes     = (page.excludes           as string[] | null) ?? []
  const gallery      = (page.gallery_image_urls as string[] | null) ?? []
  const seasonMonths = (page.season_months      as number[] | null) ?? []
  const peakMonths   = (page.peak_months        as number[] | null) ?? []

  // Use gallery images; fall back to hero_image_url as single image
  const topImages = gallery.length > 0
    ? gallery
    : page.hero_image_url
      ? [page.hero_image_url]
      : []

  const difficultyColor: Record<string, { bg: string; color: string }> = {
    Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
    Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
    Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
    Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
  }

  return (
    <>
      <HomeNav pinned />

      {/* ── OUTER CONTAINER — same width for gallery + everything below ── */}
      {/* pt-[72px] clears the fixed nav */}
      <div className="pt-[90px] max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16">

        {/* ── GALLERY — top of page, constrained to content width ── */}
        {topImages.length > 0 && (
          <div className="pt-8 md:pt-10">
            <ExperienceGallery
              images={topImages.map((url, i) => ({ id: String(i), url, is_cover: i === 0 }))}
              title={page.experience_name}
            />
          </div>
        )}

        {/* ── TITLE BLOCK ─────────────────────────────────────────── */}
        <div className="pb-6 lg:pb-8" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}>

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
              from €{page.price_from}
            </span>
            {page.difficulty && (() => {
              const dc = difficultyColor[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }
              return (
                <>
                  <span style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full f-body"
                    style={{ background: dc.bg, color: dc.color }}>{page.difficulty}</span>
                </>
              )
            })()}
            {technique.slice(0, 2).map(t => (
              <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.65)', border: '1px solid rgba(10,46,77,0.1)' }}>
                {t}
              </span>
            ))}
            {page.non_angler_friendly && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}>
                Family-friendly
              </span>
            )}
          </div>
        </div>

        {/* ── TWO-COLUMN CONTENT GRID ─────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 py-12 lg:py-14">

          {/* ── LEFT COLUMN ───────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Quick Fit Matrix */}
            {(species.length > 0 || technique.length > 0 || env.length > 0 || page.difficulty || page.physical_effort) && (
              <section className="mb-12 p-6 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <SalmonRule />
                <SectionLabel label="Quick Fit" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {species.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Target species</p>
                      <div className="flex flex-wrap gap-1.5">
                        {species.map(s => (
                          <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {technique.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Technique</p>
                      <div className="flex flex-wrap gap-1.5">
                        {technique.map(t => (
                          <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {env.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Environment</p>
                      <div className="flex flex-wrap gap-1.5">
                        {env.map(e => (
                          <span key={e} className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(page.difficulty || page.physical_effort) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Level</p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.difficulty && (() => {
                          const dc = difficultyColor[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }
                          return <span className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: dc.bg, color: dc.color }}>{page.difficulty}</span>
                        })()}
                        {page.physical_effort && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>
                            {page.physical_effort} effort
                          </span>
                        )}
                        {page.non_angler_friendly && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}>Family-friendly</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Story */}
            {page.story_text && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="About this experience" />
                <div className="space-y-4">
                  {page.story_text.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-base f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.75)' }}>
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Target species with fish images */}
            {species.length > 0 && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="What you can catch" />
                {page.catches_text && (
                  <p className="text-base f-body leading-relaxed mb-6" style={{ color: 'rgba(10,46,77,0.7)' }}>
                    {page.catches_text}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {species.map(s => {
                    const img = FISH_IMG[s as keyof typeof FISH_IMG]
                    return (
                      <div key={s} className="flex items-center gap-4 px-4 py-4 rounded-2xl"
                        style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                        {img && (
                          <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden">
                            <Image src={img} alt={s} fill className="object-contain" />
                          </div>
                        )}
                        <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{s}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Rod setup */}
            {page.rod_setup && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Rod setup & recommended gear" />
                <div className="px-5 py-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                  <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {page.rod_setup}
                  </p>
                </div>
              </section>
            )}

            {/* Season — visual calendar */}
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
                    <SeasonCalendarGrid seasonMonths={seasonMonths} peakMonths={peakMonths} />
                  </div>
                )}
                {page.best_months && (
                  <p className="text-sm f-body leading-relaxed mt-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {page.best_months}
                  </p>
                )}
              </section>
            )}

            {/* Meeting point */}
            {(page.meeting_point_name || page.meeting_point_description) && (
              <section className="mb-12">
                <SalmonRule />
                <SectionLabel label="Meeting point" />
                {page.meeting_point_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={15} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
                    <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{page.meeting_point_name}</p>
                  </div>
                )}
                {page.meeting_point_description && (
                  <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    {page.meeting_point_description}
                  </p>
                )}
              </section>
            )}

            {/* Includes / Excludes */}
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

          </div>

          {/* ── RIGHT COLUMN — sticky widget ─────────────── */}
          <div className="hidden lg:block lg:w-[360px] flex-shrink-0">
            <div className="sticky top-28">
              {page.trip_id ? (
                <InquiryWidget
                  tripId={page.trip_id}
                  tripTitle={page.experience_name}
                  maxGuests={maxGuests}
                  blockedRanges={blockedRanges}
                />
              ) : (
                <div className="rounded-3xl overflow-hidden"
                  style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(10,46,77,0.3)' }}>
                  <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Book this experience
                    </p>
                    <p className="text-lg font-bold f-display leading-snug text-white">{page.experience_name}</p>
                    <p className="text-sm f-body mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      from €{page.price_from}
                    </p>
                  </div>
                  <div className="px-5 py-5">
                    <Link
                      href={`mailto:contact@fjordanglers.com?subject=Inquiry: ${encodeURIComponent(page.experience_name)}`}
                      className="block w-full py-3.5 text-center rounded-xl text-sm font-bold f-body"
                      style={{ background: '#E67E50', color: '#fff', boxShadow: '0 4px 14px rgba(230,126,80,0.4)' }}
                    >
                      Contact FjordAnglers →
                    </Link>
                    <p className="text-center text-[11px] f-body mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Free to enquire · reply within 24h
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── MOBILE BAR ──────────────────────────────────────────── */}
      {page.trip_id ? (
        <MobileInquiryBar tripId={page.trip_id} />
      ) : (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-5"
          style={{
            background: 'rgba(243,237,228,0.97)', backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(10,46,77,0.1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.1)',
            paddingTop: '14px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          }}>
          <Link
            href={`mailto:contact@fjordanglers.com?subject=Inquiry: ${encodeURIComponent(page.experience_name)}`}
            className="flex items-center justify-center w-full py-4 rounded-2xl font-bold text-white f-body"
            style={{ background: '#E67E50', fontSize: '16px', boxShadow: '0 4px 20px rgba(230,126,80,0.4)' }}
          >
            Contact FjordAnglers →
          </Link>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          BOTTOM SECTIONS — different background, full-width
          ════════════════════════════════════════════════════════════ */}

      {/* ── GUIDE SECTION ───────────────────────────────────────── */}
      {guide && (
        <section style={{ background: '#0A2E4D' }}>
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16 py-16 lg:py-20">

            {/* Label */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-px" style={{ background: '#E67E50' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] f-body" style={{ color: '#E67E50' }}>
                Your guide
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-8 lg:gap-12 items-start">

              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="relative rounded-2xl overflow-hidden"
                  style={{ width: '100px', height: '100px', border: '2px solid rgba(255,255,255,0.12)' }}>
                  {guide.avatar_url ? (
                    <Image
                      src={guide.avatar_url}
                      alt={guide.full_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center f-display text-3xl font-bold"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      {guide.full_name[0]}
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
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

                {/* Meta row */}
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

                {/* Tagline / bio */}
                {(guide.tagline || guide.bio) && (
                  <p className="text-sm f-body leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '560px' }}>
                    {guide.tagline ?? (guide.bio ? guide.bio.slice(0, 180) + (guide.bio.length > 180 ? '…' : '') : null)}
                  </p>
                )}

                {/* Fish expertise tags */}
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

                {/* CTA */}
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

      {/* ── SIMILAR TRIPS ───────────────────────────────────────── */}
      {similarTrips.length > 0 && (
        <section style={{ background: '#F3EDE4' }}>
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16 py-16 lg:py-20">

            {/* Header */}
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

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarTrips.map(trip => {
                const tripGallery = (trip.gallery_image_urls as string[] | null) ?? []
                const thumbUrl    = tripGallery[0] ?? trip.hero_image_url
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
                    {/* Image */}
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
                      {/* Country tag */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(10,46,77,0.72)', backdropFilter: 'blur(8px)' }}>
                        <CountryFlag country={trip.country} size={12} />
                        <span className="text-[11px] font-semibold f-body text-white">{trip.region}</span>
                      </div>
                    </div>

                    {/* Content */}
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
                          from €{trip.price_from}
                        </span>
                        <span className="text-xs font-semibold f-body transition-colors"
                          style={{ color: '#E67E50' }}>
                          View →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* See all link */}
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

      <Footer />
    </>
  )
}
