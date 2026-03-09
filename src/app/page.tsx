import Image from 'next/image'
import Link from 'next/link'
import { getFeaturedExperiences, getPlatformStats, getSpeciesCounts } from '@/lib/supabase/queries'
import { HomeNav } from '@/components/home/home-nav'

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
  { name: 'Atlantic Salmon', slug: 'Salmon', img: '/fish_catalog/salmon.jpg' },
  { name: 'Trout', slug: 'Trout', img: '/fish_catalog/trout.jpg' },
  { name: 'Pike', slug: 'Pike', img: '/fish_catalog/pike.jpg' },
  { name: 'Zander', slug: 'Zander', img: '/fish_catalog/zander.jpg' },
  { name: 'Grayling', slug: 'Grayling', img: '/fish_catalog/graling.jpeg' },
  { name: 'Cod', slug: 'Cod', img: '/fish_catalog/cod.jpg' },
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
      <section className="relative px-4 md:px-6 pt-4 pb-4" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">
          <div
            className="relative overflow-hidden"
            style={{ borderRadius: '28px', minHeight: '96vh' }}
          >
            <video
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/brand/hero_bg.mov" type="video/mp4" />
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
              <Link key={s.name} href={`/experiences?fish=${encodeURIComponent(s.slug)}`} className="group block">
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
      <section className="relative overflow-hidden py-24 px-4 md:px-6" style={{ background: '#07111C' }}>
        <GrainOverlay />
        <div className="relative max-w-[1440px] mx-auto" style={{ zIndex: 3 }}>
          <div className="mb-16">
            <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body"
              style={{ color: '#E67E50' }}
            >
              Simple as that
            </p>
            <h2 className="text-white text-4xl font-bold f-display">How it works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3">
            {[
              { step: '01', title: 'Find your experience', desc: 'Filter by country, species, and dates. Real prices, no hidden fees.' },
              { step: '02', title: 'Book with the guide', desc: 'Send a message. Confirm in 24 hours. Pay securely through the platform.' },
              { step: '03', title: 'Show up and fish', desc: 'Your guide handles the rest. You just need to show up ready to cast.' },
            ].map((item, i) => (
              <div
                key={item.step}
                className="relative py-12 overflow-hidden"
                style={{
                  paddingRight: i < 2 ? '3.5rem' : 0,
                  paddingLeft: i > 0 ? '3.5rem' : 0,
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                }}
              >
                <span
                  className="absolute font-bold select-none pointer-events-none f-display"
                  style={{
                    top: '-8px',
                    right: i < 2 ? '2rem' : '-0.5rem',
                    fontSize: '120px',
                    lineHeight: 1,
                    color: 'rgba(255,255,255,0.028)',
                    fontStyle: 'italic',
                  }}
                >
                  {item.step}
                </span>
                <div className="relative" style={{ zIndex: 1 }}>
                  <span className="text-[11px] font-bold tracking-[0.22em] uppercase f-body" style={{ color: '#E67E50' }}>
                    {item.step}
                  </span>
                  <div className="w-8 h-px mt-3 mb-6" style={{ background: '#E67E50', opacity: 0.35 }} />
                  <h3 className="text-white text-xl font-bold mb-3 f-display">{item.title}</h3>
                  <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GUIDE CTA ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: '540px' }}>
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover object-center">
          <source src="/cta.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(108deg, rgba(4,12,22,0.92) 0%, rgba(4,12,22,0.78) 45%, rgba(4,12,22,0.4) 100%)',
          }}
        />
        <GrainOverlay />
        <div
          className="relative flex items-center min-h-[540px] px-8 max-w-[1440px] mx-auto"
          style={{ zIndex: 3 }}
        >
          <div style={{ maxWidth: '520px' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-px" style={{ background: '#E67E50' }} />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
                For guides
              </p>
            </div>
            <h2 className="text-white text-5xl font-bold leading-tight mb-5 f-display">
              Are you a<br />
              <span style={{ fontStyle: 'italic' }}>fishing guide?</span>
            </h2>
            <p className="text-base leading-relaxed mb-3 f-body" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Join our founding cohort of Scandinavian guides. Reach anglers from Poland, Germany,
              and across Europe.
            </p>
            <p className="text-sm leading-relaxed mb-8 f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
              First 50 guides get 3 months free +{' '}
              <span style={{ color: '#E67E50' }}>8% commission forever</span>.
            </p>
            <div className="flex items-center gap-5">
              <Link
                href="/guides/apply"
                className="inline-flex items-center gap-2 text-white font-semibold px-7 py-3.5 rounded-full text-sm tracking-wide transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
                style={{ background: '#E67E50' }}
              >
                Apply as Founding Guide →
              </Link>
              <Link href="/guides" className="text-sm font-medium f-body" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Meet the guides
              </Link>
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
                src="/vanern.jpgd"
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
                  { label: 'Atlantic Salmon', href: '/experiences?fish=Salmon' },
                  { label: 'Trout Fishing', href: '/experiences?fish=Trout' },
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
