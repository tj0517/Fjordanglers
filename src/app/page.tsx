import Image from 'next/image'
import Link from 'next/link'
import { getFeaturedExperiences, getPlatformStats, getSpeciesCounts } from '@/lib/supabase/queries'
import { HomeNav } from '@/components/home/home-nav'
import { BLOG_POSTS } from '@/lib/blog-data'

export const dynamic = 'force-dynamic'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const COUNTRY_FLAGS: Record<string, string> = {
  Norway: '🇳🇴', Sweden: '🇸🇪', Finland: '🇫🇮', Denmark: '🇩🇰', Iceland: '🇮🇸',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}

const SPECIES_CONFIG = [
  { name: 'Atlantic Salmon', slug: 'Salmon', pageSlug: 'salmon', img: '/fish_catalog/salmon.jpg' },
  { name: 'Trout', slug: 'Trout', pageSlug: 'trout', img: '/fish_catalog/trout.jpg' },
  { name: 'Pike', slug: 'Pike', pageSlug: 'pike', img: '/fish_catalog/pike.jpg' },
  { name: 'Zander', slug: 'Zander', pageSlug: 'zander', img: '/fish_catalog/zander.jpg' },
  { name: 'Grayling', slug: 'Grayling', pageSlug: 'grayling', img: '/fish_catalog/graling.jpeg' },
  { name: 'Cod', slug: 'Cod', pageSlug: 'cod', img: '/fish_catalog/cod.jpg' },
]

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
  const [featured, stats, speciesCounts] = await Promise.all([
    getFeaturedExperiences(4),
    getPlatformStats(),
    getSpeciesCounts(),
  ])

  const species = SPECIES_CONFIG.map(s => ({ ...s, count: speciesCounts[s.slug] ?? 0 }))

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      <HomeNav />

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <section className="relative" style={{ minHeight: '96vh' }}>
        <div
          className="relative overflow-hidden"
          style={{ minHeight: '96vh' }}
        >
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="https://uwxrstbplaoxfghrchcy.supabase.co/storage/v1/object/public/videos/hero_bg.mp4" type="video/mp4" />
          </video>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(170deg, rgba(5,12,24,0.72) 0%, rgba(5,12,24,0.3) 40%, rgba(5,12,24,0.86) 100%)',
            }}
          />
          <GrainOverlay />

          <div
            className="relative flex flex-col justify-between px-8 md:px-14 pt-24 pb-12 md:pb-16"
            style={{ zIndex: 3, minHeight: '96vh' }}
          >
            {/* Top: destination chips + live badge */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {['🇳🇴 Norway', '🇸🇪 Sweden', '🇫🇮 Finland'].map((label, i) => (
                  <span
                    key={label}
                    className="text-[11px] font-semibold px-3.5 py-1.5 rounded-full f-body"
                    style={{
                      background: i === 0 ? 'rgba(230,126,80,0.16)' : 'rgba(255,255,255,0.07)',
                      color: i === 0 ? '#E67E50' : 'rgba(255,255,255,0.46)',
                      border: i === 0
                        ? '1px solid rgba(230,126,80,0.22)'
                        : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
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
              <form
                action="/experiences"
                method="GET"
                className="flex items-center mb-7 w-full max-w-[540px] overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div className="flex flex-col px-5 py-3.5 flex-1 min-w-0">
                  <label
                    htmlFor="hero-country"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                    style={{ color: 'rgba(255,255,255,0.36)' }}
                  >
                    Destination
                  </label>
                  <select
                    id="hero-country"
                    name="country"
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer f-body appearance-none"
                    style={{ color: 'rgba(255,255,255,0.82)' }}
                  >
                    <option value="" style={{ background: '#07111C' }}>Any country</option>
                    <option value="Norway" style={{ background: '#07111C' }}>🇳🇴 Norway</option>
                    <option value="Sweden" style={{ background: '#07111C' }}>🇸🇪 Sweden</option>
                    <option value="Finland" style={{ background: '#07111C' }}>🇫🇮 Finland</option>
                    <option value="Iceland" style={{ background: '#07111C' }}>🇮🇸 Iceland</option>
                  </select>
                </div>

                <div className="w-px self-stretch my-3" style={{ background: 'rgba(255,255,255,0.1)' }} />

                <div className="flex flex-col px-5 py-3.5 flex-1 min-w-0">
                  <label
                    htmlFor="hero-fish"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                    style={{ color: 'rgba(255,255,255,0.36)' }}
                  >
                    Species
                  </label>
                  <select
                    id="hero-fish"
                    name="fish"
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer f-body appearance-none"
                    style={{ color: 'rgba(255,255,255,0.82)' }}
                  >
                    <option value="" style={{ background: '#07111C' }}>Any fish</option>
                    <option value="Salmon" style={{ background: '#07111C' }}>Atlantic Salmon</option>
                    <option value="Trout" style={{ background: '#07111C' }}>Trout</option>
                    <option value="Pike" style={{ background: '#07111C' }}>Pike</option>
                    <option value="Zander" style={{ background: '#07111C' }}>Zander</option>
                    <option value="Grayling" style={{ background: '#07111C' }}>Grayling</option>
                    <option value="Cod" style={{ background: '#07111C' }}>Cod</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="m-2 shrink-0 text-white font-semibold text-sm px-7 py-3 rounded-[14px] transition-all hover:brightness-110 f-body whitespace-nowrap"
                  style={{ background: '#E67E50' }}
                >
                  Search
                </button>
              </form>

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
      </section>

      {/* ─── FEATURED EXPERIENCES ────────────────────────────────────── */}
      <section className="px-4 md:px-6 pt-20 pb-20" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">

          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                Handpicked
              </p>
              <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                Featured Experiences
              </h2>
            </div>
            <Link
              href="/experiences"
              className="hidden md:block text-sm font-medium transition-colors hover:text-[#E67E50] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all trips →
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map(exp => {
                const coverUrl = exp.images.find(img => img.is_cover)?.url ?? exp.images[0]?.url ?? null
                const flag = exp.location_country != null ? (COUNTRY_FLAGS[exp.location_country] ?? '') : ''
                const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : exp.duration_days != null ? `${exp.duration_days} days` : null
                return (
                  <Link key={exp.id} href={`/experiences/${exp.id}`} className="group block">
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
                            {flag} {exp.location_country}
                          </span>
                          {exp.fish_types[0] != null && (
                            <>
                              <span className="text-xs" style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full f-body"
                                style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                              >
                                {exp.fish_types[0]}
                              </span>
                            </>
                          )}
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
        </div>
      </section>

      {/* ─── SPECIES PICKER ──────────────────────────────────────────── */}
      <section className="pb-24 px-4 md:px-6" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">
          <div
            className="mb-11 pt-16 flex items-end justify-between"
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
              href="/experiences"
              className="hidden md:block text-sm font-medium hover:text-[#E67E50] transition-colors f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all trips →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {species.map(s => (
              <Link key={s.name} href={`/species/${s.pageSlug}`} className="group block">
                <div className="relative overflow-hidden" style={{ borderRadius: '22px', height: '210px' }}>
                  <Image
                    src={s.img}
                    alt={s.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(5,10,20,0.9) 18%, rgba(5,10,20,0.18) 55%, transparent 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'rgba(230,126,80,0.12)' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-bold text-sm leading-tight f-display">{s.name}</p>
                    {s.count > 0 && (
                      <p className="text-xs mt-0.5 f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {s.count} {s.count === 1 ? 'trip' : 'trips'}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className=" pb-4" style={{ background: '#F3EDE4' }}>
        <div
          className="relative overflow-hidden"
          style={{ background: '#07111C' }}
        >
          <GrainOverlay />
          <div className="relative px-8 md:px-14 py-20 md:py-24" style={{ zIndex: 3 }}>

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
                { step: '01', title: 'Find your experience', desc: 'Filter by country, species, and duration. Real prices, no hidden fees.' },
                { step: '02', title: 'Book with the guide', desc: 'Send a message. Confirm within 24 hours. Pay securely through the platform.' },
                { step: '03', title: 'Show up and fish', desc: 'Your guide handles everything. You just need to show up ready to cast.' },
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
      </section>

      {/* ─── BLOG PREVIEW ────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-20" style={{ background: '#F3EDE4' }}>
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
      </section>

      {/* ─── GUIDE CTA ───────────────────────────────────────────────── */}
      <section style={{ background: '#F3EDE4' }}>
        <div className="relative overflow-hidden" style={{ minHeight: '580px' }}>

          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover object-center">
            <source src="https://uwxrstbplaoxfghrchcy.supabase.co/storage/v1/object/public/videos/cta.mp4" type="video/mp4" />
          </video>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(105deg, rgba(4,12,22,0.94) 0%, rgba(4,12,22,0.82) 50%, rgba(4,12,22,0.55) 100%)' }}
          />
          <GrainOverlay />

          <div
            className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-8 md:px-14 py-20"
            style={{ zIndex: 3, minHeight: '580px' }}
          >
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
                Are you a<br />
                <span style={{ fontStyle: 'italic', color: '#E67E50' }}>fishing guide?</span>
              </h2>
              <p className="text-base leading-relaxed mb-10 f-body" style={{ color: 'rgba(255,255,255,0.48)', maxWidth: '380px' }}>
                Join our founding cohort of Scandinavian guides and reach anglers from across Europe.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/guides/apply"
                  className="inline-flex items-center gap-2 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
                  style={{ background: '#E67E50' }}
                >
                  Apply as Founding Guide →
                </Link>
                <Link href="/guides" className="text-sm font-medium f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Meet the guides
                </Link>
              </div>
            </div>

            {/* Right — founding offer card */}
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
                  Founding Guide Offer
                </p>
                <p className="f-display font-bold text-white mb-1" style={{ fontSize: '42px', lineHeight: 1 }}>
                  3 months
                </p>
                <p className="f-display font-bold mb-4" style={{ fontSize: '42px', lineHeight: 1, color: '#E67E50', fontStyle: 'italic' }}>
                  free.
                </p>
                <p className="text-sm f-body mb-6" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                  Then just <span style={{ color: 'rgba(255,255,255,0.75)' }}>8% commission</span> — for life. First 50 guides only.
                </p>
                <div className="flex flex-col gap-2">
                  {['€0 setup fee', '48h verification', 'You set your price', 'Anglers from 20+ countries'].map(t => (
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
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer style={{ background: '#05101A' }}>

        {/* Main footer content */}
        <div className="max-w-[1440px] mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

            {/* Brand column */}
            <div className="lg:col-span-1">
              <Image
                src="/brand/white-logo.png"
                alt="FjordAnglers"
                width={140}
                height={36}
                className="h-7 w-auto mb-4"
                style={{ opacity: 0.65 }}
              />
              <p
                className="text-sm leading-relaxed mb-6 f-body"
                style={{ color: 'rgba(255,255,255,0.28)', maxWidth: '200px' }}
              >
                Connecting anglers with the best fishing experiences in Scandinavia.
              </p>
              <a
                href="https://instagram.com/fjordanglers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-[13px] f-body transition-colors hover:text-white/55"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
                @fjordanglers
              </a>
            </div>

            {/* Explore */}
            <div>
              <h4
                className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
                style={{ color: 'rgba(255,255,255,0.22)' }}
              >
                Explore
              </h4>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'All Experiences', href: '/experiences' },
                  { label: 'Find Guides', href: '/guides' },
                  { label: 'License Map', href: '/license-map' },
                  { label: 'Atlantic Salmon', href: '/species/salmon' },
                  { label: 'Trout Fishing', href: '/species/trout' },
                ].map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] f-body transition-colors hover:text-white/55"
                      style={{ color: 'rgba(255,255,255,0.32)' }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Destinations */}
            <div>
              <h4
                className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
                style={{ color: 'rgba(255,255,255,0.22)' }}
              >
                Destinations
              </h4>
              <ul className="flex flex-col gap-3">
                {[
                  { label: '🇳🇴 Norway', href: '/experiences?country=Norway' },
                  { label: '🇸🇪 Sweden', href: '/experiences?country=Sweden' },
                  { label: '🇫🇮 Finland', href: '/experiences?country=Finland' },
                  { label: '🇮🇸 Iceland', href: '/experiences?country=Iceland' },
                  { label: '🇩🇰 Denmark', href: '/experiences?country=Denmark' },
                ].map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] f-body transition-colors hover:text-white/55"
                      style={{ color: 'rgba(255,255,255,0.32)' }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Guides */}
            <div>
              <h4
                className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
                style={{ color: 'rgba(255,255,255,0.22)' }}
              >
                For Guides
              </h4>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Apply as Guide', href: '/guides/apply' },
                  { label: 'Guide Dashboard', href: '/dashboard' },
                  { label: 'Sign in', href: '/login' },
                ].map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] f-body transition-colors hover:text-white/55"
                      style={{ color: 'rgba(255,255,255,0.32)' }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div
            className="max-w-[1440px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-4"
          >
            <p className="text-[12px] f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>
              © 2026 FjordAnglers. All rights reserved.
            </p>
            <p className="text-[12px] f-body" style={{ color: 'rgba(255,255,255,0.14)' }}>
              Norway · Sweden · Finland · Iceland · Denmark
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
