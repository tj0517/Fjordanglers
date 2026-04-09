// preview/main
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getFeaturedExperiences, getPlatformStats, getSpeciesCounts, getFeaturedGuides, getExperienceLocations } from '@/lib/supabase/queries'
import type { FeaturedGuide } from '@/lib/supabase/queries'
import { FISH_CATALOG } from '@/lib/fish'
import { CountryFlag } from '@/components/ui/country-flag'
import { SpeciesSlider } from '@/components/home/species-slider'
import { HomeNav } from '@/components/home/home-nav'
import { HeroSearchBar } from '@/components/home/hero-search-bar'
import { BgVideo } from '@/components/home/bg-video'
import { BLOG_POSTS } from '@/lib/blog-data'
import { Footer } from '@/components/layout/footer'

export const dynamic = 'force-dynamic'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`


const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}


// ─── MICRO-COMPONENTS ─────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div
    aria-hidden="true"
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: GRAIN_BG,
      backgroundSize: '200px 200px',
      opacity: 0.06,
      mixBlendMode: 'screen',
      zIndex: 2,
    }}
  />
)

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [featured, stats, speciesCounts, featuredGuides, locations] = await Promise.all([
    getFeaturedExperiences(4),
    getPlatformStats(),
    getSpeciesCounts(),
    getFeaturedGuides(4),
    getExperienceLocations(),
  ])

  const species = FISH_CATALOG.map(s => ({ ...s, count: speciesCounts[s.slug] ?? 0 }))

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      <HomeNav />

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <section className="relative" style={{ minHeight: '96vh' }}>
        <div
          className="relative"
          style={{ minHeight: '96vh' }}
        >
          <BgVideo
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/hero_bg.mp4`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(170deg, rgba(5,12,24,0.72) 0%, rgba(5,12,24,0.3) 40%, rgba(5,12,24,0.86) 100%)',
            }}
          />
          <GrainOverlay />

          <div
            className="relative px-4 md:px-8 lg:px-14 pt-[76px] pb-10 md:pb-16"
            style={{ zIndex: 3, minHeight: '96vh' }}
          >
          <div className="max-w-[1360px] mx-auto flex flex-col justify-between" style={{ minHeight: 'min(calc(96vh - 76px), 720px)' }}>
            {/* Top: live badge */}
            <div className="flex justify-end">
              <div
                className="hidden sm:flex items-center gap-2 text-[11px] font-medium px-3.5 py-1.5 rounded-full f-body"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.44)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.55)' }}
                />
                Booking open · 2026
              </div>
            </div>

            {/* Bottom: headline + search */}
            <div>
              <h1
                className="font-bold f-display"
                style={{
                  fontSize: 'clamp(48px, 6vw, 96px)',
                  lineHeight: 1.0,
                  maxWidth: '760px',
                  marginBottom: '22px',
                }}
              >
                <span className="text-white block">Fish where</span>
                <span className="text-white block">others only</span>
                <span className="block" style={{ color: '#E67E50', fontStyle: 'italic' }}>
                  dream of going.
                </span>
              </h1>

              <p
                className="f-body mb-8"
                style={{
                  color: 'rgba(255,255,255,0.42)',
                  maxWidth: '420px',
                  fontSize: '16px',
                  lineHeight: 1.78,
                }}
              >
                Day trips and expeditions with hand-picked Scandinavian guides
                who know every river, fjord, and lake.
              </p>

              {/* Search bar */}
              <HeroSearchBar locations={locations} />

              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-sm font-medium f-body"
                style={{ color: 'rgba(255,255,255,0.36)' }}
              >
                Meet the guides →
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED EXPERIENCES ────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-14 pt-12 md:pt-20 pb-12 md:pb-20" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1360px] mx-auto">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-12">
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                Handpicked
              </p>
              <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                Featured Trips
              </h2>
            </div>
            <Link
              href="/trips"
              className="hidden md:block text-sm font-medium transition-colors hover:text-[#E67E50] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all trips →
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((exp, idx) => {
                const coverUrl = exp.images.find(img => img.is_cover)?.url ?? exp.images[0]?.url ?? null
                const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : exp.duration_days != null ? `${exp.duration_days} ${exp.duration_days === 1 ? 'day' : 'days'}` : null
                return (
                  <Link key={exp.id} href={`/trips/${exp.id}`} className="group block">
                    <article
                      className="overflow-hidden transition-all duration-300 hover:shadow-[0_24px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1.5 h-full flex flex-col"
                      style={{
                        borderRadius: '24px',
                        background: '#FDFAF7',
                        border: '1px solid rgba(10,46,77,0.07)',
                        boxShadow: '0 2px 14px rgba(10,46,77,0.05)',
                      }}
                    >
                      {/* Image */}
                      <div className="relative overflow-hidden flex-shrink-0" style={{ height: '220px' }}>
                        {coverUrl != null ? (
                          <Image
                            src={coverUrl}
                            alt={exp.title}
                            fill
                            priority={idx === 0}
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                        )}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-4"
                          style={{ background: 'rgba(7,17,28,0.25)' }}
                        >
                          <span
                            className="text-white text-xs font-semibold px-5 py-2 rounded-full translate-y-2 group-hover:translate-y-0 transition-transform duration-200 f-body"
                            style={{ background: '#E67E50' }}
                          >
                            View Trip →
                          </span>
                        </div>
                        <div
                          className="absolute top-3 right-3 text-white text-sm font-bold px-3 py-1.5 rounded-full f-body"
                          style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}
                        >
                          €{exp.price_per_person_eur}
                          <span className="text-xs font-normal opacity-55">/pp</span>
                        </div>
                        {diffLabel != null && (
                          <div
                            className="absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full f-body"
                            style={{
                              background: 'rgba(5,12,22,0.6)',
                              color: 'rgba(255,255,255,0.82)',
                              backdropFilter: 'blur(8px)',
                            }}
                          >
                            {diffLabel}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                            <CountryFlag country={exp.location_country} /> {exp.location_country}
                          </span>
                          {exp.fish_types.slice(0, 3).map(fish => (
                            <span
                              key={fish}
                              className="text-xs font-medium px-2 py-0.5 rounded-full f-body"
                              style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                            >
                              {fish}
                            </span>
                          ))}
                        </div>
                        <h3
                          className="font-semibold text-[15px] leading-snug mb-auto f-display line-clamp-2"
                          style={{ color: '#0A2E4D' }}
                        >
                          {exp.title}
                        </h3>
                        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                              style={{ border: '1.5px solid rgba(10,46,77,0.07)' }}
                            >
                              {exp.guide.avatar_url != null ? (
                                <Image
                                  src={exp.guide.avatar_url}
                                  alt={exp.guide.full_name}
                                  width={28}
                                  height={28}
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-[#0A2E4D] flex items-center justify-center text-white text-[10px] f-body">
                                  {exp.guide.full_name[0]}
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-medium f-body truncate max-w-[90px]" style={{ color: '#0A2E4D' }}>
                              {exp.guide.full_name}
                            </p>
                          </div>
                          {duration != null && (
                            <p className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>
                              {duration}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="f-body text-sm" style={{ color: 'rgba(10,46,77,0.4)' }}>
                New experiences coming soon —{' '}
                <Link href="/guides/apply" className="text-[#E67E50] underline-offset-2 underline">
                  join as a guide
                </Link>
              </p>
            </div>
          )}

          {featured.length > 0 && (
            <div className="flex justify-center mt-10">
              <Link
                href="/trips"
                className="flex items-center gap-2 text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:brightness-110 active:scale-[0.97] f-body"
                style={{ background: '#0A2E4D', color: '#fff' }}
              >
                Browse all trips
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── SPECIES PICKER ──────────────────────────────────────────── */}
      <section className="pb-12 md:pb-24 px-4 md:px-8 lg:px-14" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1360px] mx-auto">
          <div
            className="mb-8 md:mb-11 pt-12 md:pt-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
            style={{ borderTop: '1px solid rgba(10,46,77,0.09)' }}
          >
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                Browse by species
              </p>
              <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                What are you<span style={{ fontStyle: 'italic' }}> after?</span>
              </h2>
            </div>
            <Link
              href="/trips"
              className="hidden md:block text-sm font-medium hover:text-[#E67E50] transition-colors f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all trips →
            </Link>
          </div>
          <SpeciesSlider species={species} />
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className=" pb-4" style={{ background: '#F3EDE4' }}>
        <div
          className="relative overflow-hidden"
          style={{ background: '#07111C' }}
        >
          <GrainOverlay />
          <div className="relative px-4 md:px-8 lg:px-14 py-12 md:py-20 lg:py-24" style={{ zIndex: 3 }}>
            <div className="max-w-[1360px] mx-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-px" style={{ background: '#E67E50' }} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
                    Simple as that
                  </p>
                </div>
                <h2 className="text-white font-bold f-display" style={{ fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.08 }}>
                  How it works
                </h2>
              </div>
              <p className="text-sm f-body md:text-right md:max-w-[260px]" style={{ color: 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>
                From browsing to bankside in three steps.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '01', title: 'Find your obsession', desc: 'Filter by species, country, and duration. Every guide lives for their fish — and they know exactly where it hides.' },
                { step: '02', title: 'Your guide takes it from here', desc: 'Tell them when you\'re coming and what you\'re after. They\'ll plan the spots, the conditions, the technique — built around your group and no one else\'s.' },
                { step: '03', title: 'Fish water you\'d never find alone', desc: 'Spots you wouldn\'t discover in a lifetime. Local knowledge passed down through seasons. You just show up and cast.' },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative overflow-hidden flex flex-col justify-between"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '20px',
                    padding: '2rem',
                    minHeight: '220px',
                  }}
                >
                  {/* Giant ghost number */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-4 font-bold select-none pointer-events-none f-display"
                    style={{
                      fontSize: '108px',
                      lineHeight: 0.85,
                      color: 'rgba(230,126,80,0.10)',
                      fontStyle: 'italic',
                    }}
                  >
                    {item.step}
                  </span>

                  {/* Step badge */}
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold f-body flex-shrink-0 self-start"
                    style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}
                  >
                    {item.step}
                  </span>

                  {/* Text */}
                  <div className="relative mt-6" style={{ zIndex: 1 }}>
                    <h3 className="text-white font-bold mb-2 f-display" style={{ fontSize: '18px' }}>{item.title}</h3>
                    <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BLOG PREVIEW ────────────────────────────────────────────── */}
      {false && <section className="px-4 md:px-6 py-20" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">

          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>
                From the journal
              </p>
              <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                Stories from<span style={{ fontStyle: 'italic' }}> the water.</span>
              </h2>
            </div>
            <Link
              href="/blog"
              className="hidden md:block text-sm font-medium transition-colors hover:text-[#E67E50] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all articles →
            </Link>
          </div>

          {/* 1 featured + 4 cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Featured */}
            <Link href={`/blog/${BLOG_POSTS[0].slug}`} className="group block">
              <article
                className="relative overflow-hidden"
                style={{ borderRadius: '24px', height: '100%', minHeight: '400px' }}
              >
                <Image
                  src={BLOG_POSTS[0].img}
                  alt={BLOG_POSTS[0].title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.9) 0%, rgba(5,10,20,0.2) 60%, transparent 100%)' }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span
                    className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-4 f-body"
                    style={{ background: 'rgba(230,126,80,0.22)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.28)' }}
                  >
                    {BLOG_POSTS[0].category}
                  </span>
                  <h3 className="text-white font-bold f-display mb-3" style={{ fontSize: 'clamp(20px, 2.2vw, 28px)', lineHeight: 1.2 }}>
                    {BLOG_POSTS[0].title}
                  </h3>
                  <p className="text-sm f-body mb-4 line-clamp-2" style={{ color: 'rgba(255,255,255,0.48)' }}>
                    {BLOG_POSTS[0].excerpt}
                  </p>
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    {BLOG_POSTS[0].date} · {BLOG_POSTS[0].readTime} read
                  </span>
                </div>
              </article>
            </Link>

            {/* 2×2 grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {BLOG_POSTS.slice(1).map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                  <article
                    className="overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,46,77,0.10)]"
                    style={{ borderRadius: '20px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
                  >
                    <div className="relative overflow-hidden flex-shrink-0" style={{ height: '160px' }}>
                      <Image
                        src={post.img}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                      />
                      <div className="absolute top-3 left-3">
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                          style={{ background: 'rgba(5,12,22,0.65)', color: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(8px)' }}
                        >
                          {post.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-semibold f-display mb-auto line-clamp-2" style={{ fontSize: '14px', color: '#0A2E4D', lineHeight: 1.35 }}>
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{post.date}</span>
                        <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: '10px' }}>·</span>
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{post.readTime} read</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile view all */}
          <div className="mt-8 flex justify-center md:hidden">
            <Link
              href="/blog"
              className="text-sm font-medium f-body"
              style={{ color: 'rgba(10,46,77,0.45)' }}
            >
              View all articles →
            </Link>
          </div>
        </div>
      </section>}

      {/* ─── FEATURED GUIDES ─────────────────────────────────────────── */}
      {featuredGuides.length > 0 && (
        <section className="px-4 md:px-8 lg:px-14 py-12 md:py-20" style={{ background: '#F3EDE4' }}>
          <div className="max-w-[1360px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-12">
              <div>
                <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>
                  Hand-picked
                </p>
                <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                  Meet the <span style={{ fontStyle: 'italic' }}>guides.</span>
                </h2>
              </div>
              <Link href="/guides" className="hidden md:block text-sm font-medium hover:text-[#E67E50] transition-colors f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                All guides →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredGuides.map((guide: FeaturedGuide, idx) => {
                const fishPills = (guide.fish_expertise as string[]).slice(0, 2)
                return (
                  <Link key={guide.id} href={`/guides/${guide.id}`} className="group block">
                    <article
                      className="overflow-hidden transition-all duration-300 hover:shadow-[0_20px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1"
                      style={{ borderRadius: '28px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)', height: '360px', display: 'flex', flexDirection: 'column' }}
                    >
                      {/* Cover */}
                      <div className="relative overflow-hidden" style={{ height: '180px' }}>
                        {guide.cover_url != null ? (
                          <Image src={guide.cover_url} alt={guide.full_name} fill priority={idx === 0} className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                        ) : (
                          <div className="w-full h-full" style={{ background: '#0A2E4D' }} />
                        )}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'rgba(7,17,28,0.22)' }} />
                      </div>

                      {/* Body */}
                      <div className="px-6 pb-6 flex flex-col flex-1">
                        <div className="flex items-end justify-between -mt-8 mb-4" style={{ position: 'relative', zIndex: 10 }}>
                          <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0" style={{ border: '3px solid #FDFAF7', boxShadow: '0 2px 12px rgba(10,46,77,0.12)' }}>
                            {guide.avatar_url != null ? (
                              <Image src={guide.avatar_url} alt={guide.full_name} width={64} height={64} className="object-cover w-full h-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-xl f-display font-bold" style={{ background: '#0A2E4D' }}>
                                {guide.full_name[0]}
                              </div>
                            )}
                          </div>
                          {guide.average_rating != null && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                              ★ {guide.average_rating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-lg leading-tight mb-1 f-display" style={{ color: '#0A2E4D' }}>{guide.full_name}</h3>
                        <p className="text-xs mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                          <CountryFlag country={guide.country} /> {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
                          {guide.years_experience != null && <span> · {guide.years_experience} yrs exp</span>}
                        </p>

                        <div className="flex flex-nowrap gap-1.5 mb-4 overflow-hidden">
                          {fishPills.map(fish => (
                            <span key={fish} className="text-xs font-medium px-2.5 py-1 rounded-full f-body flex-shrink-0" style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}>{fish}</span>
                          ))}
                          {(guide.fish_expertise as string[]).length > 2 && (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body flex-shrink-0" style={{ background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.4)' }}>
                              +{(guide.fish_expertise as string[]).length - 2} more
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            {(guide.languages as string[]).slice(0, 2).join(', ')}
                            {(guide.languages as string[]).length > 2 && ` +${(guide.languages as string[]).length - 2}`}
                          </p>
                          <span className="text-xs font-semibold px-4 py-2 rounded-full transition-all group-hover:brightness-110 f-body" style={{ background: '#E67E50', color: '#fff' }}>
                            View Profile →
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── GUIDE CTA ───────────────────────────────────────────────── */}
      <section style={{ background: '#F3EDE4' }}>
        <div className="relative overflow-hidden" style={{ minHeight: '580px' }}>

          <Image
            src="/vanern.jpg"
            alt=""
            fill
            priority
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(105deg, rgba(4,12,22,0.94) 0%, rgba(4,12,22,0.82) 50%, rgba(4,12,22,0.55) 100%)' }}
          />
          <GrainOverlay />

          <div
            className="relative px-4 md:px-8 lg:px-14 py-14 md:py-20"
            style={{ zIndex: 3, minHeight: '580px' }}
          >
          <div className="max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-10 h-full" style={{ minHeight: '540px' }}>
            {/* Left — headline + CTA */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-px" style={{ background: '#E67E50' }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
                  For guides
                </p>
              </div>
              <h2
                className="text-white font-bold f-display mb-5"
                style={{ fontSize: 'clamp(36px, 4.5vw, 60px)', lineHeight: 1.06 }}
              >
                Reach anglers<br />
                <span style={{ fontStyle: 'italic', color: '#E67E50' }}>across Europe.</span>
              </h2>
              <p className="text-base leading-relaxed mb-10 f-body" style={{ color: 'rgba(255,255,255,0.48)', maxWidth: '380px' }}>
                Drop us your Instagram or website — we build your full listing for free. No tech, no paperwork, no hassle.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="https://instagram.com/fjordanglers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
                  style={{ background: '#E67E50' }}
                >
                  Get listed — DM us →
                </a>
                <a href="mailto:contact@fjordanglers.com" className="text-sm font-medium f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  or email us
                </a>
              </div>
            </div>

            {/* Right — how it works card */}
            <div className="hidden md:flex justify-end">
              <div
                className="w-full"
                style={{
                  maxWidth: '340px',
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '24px',
                  padding: '2rem',
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-4 f-body" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  How it works
                </p>
                <p className="f-display font-bold text-white mb-1" style={{ fontSize: '42px', lineHeight: 1 }}>
                  Zero setup.
                </p>
                <p className="f-display font-bold mb-4" style={{ fontSize: '42px', lineHeight: 1, color: '#E67E50', fontStyle: 'italic' }}>
                  Just guiding.
                </p>
                <p className="text-sm f-body mb-6" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                  Send us a link — we handle your full profile. You focus on the water, we handle the rest.
                </p>
                <div className="flex flex-col gap-2">
                  {['Free to list', 'We write your profile', 'You control your pricing', 'Anglers from 20+ countries'].map(t => (
                    <div key={t} className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(230,126,80,0.18)' }}>
                        <span style={{ color: '#E67E50', fontSize: '9px' }}>✓</span>
                      </span>
                      <span className="text-[13px] f-body" style={{ color: 'rgba(255,255,255,0.55)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <Footer />

    </div>
  )
}
