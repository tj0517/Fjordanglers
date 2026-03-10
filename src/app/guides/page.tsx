import Image from 'next/image'
import Link from 'next/link'
import { getGuides, getPlatformStats } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const COUNTRY_FLAGS: Record<string, string> = {
  Norway: '🇳🇴',
  Sweden: '🇸🇪',
  Finland: '🇫🇮',
  Iceland: '🇮🇸',
  Denmark: '🇩🇰',
}

const COUNTRIES = ['Norway', 'Sweden', 'Finland', 'Iceland'] as const
const LANGUAGES = ['English', 'Norwegian', 'Swedish', 'Finnish', 'Icelandic', 'German'] as const

// ─── TYPES ────────────────────────────────────────────────────────────────────

type SearchParams = {
  country?: string
  language?: string
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

// ─── METADATA ─────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Meet the Guides — FjordAnglers',
  description:
    'Verified local fishing experts across Norway, Sweden and Finland. Filter by country and language to find your perfect guide.',
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const [guides, stats] = await Promise.all([
    getGuides({ country: params.country, language: params.language }),
    getPlatformStats(),
  ])

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── Minimal guides nav — no external links ─────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 px-4 md:px-6 pt-5">
        <div
          className="max-w-[1440px] mx-auto overflow-hidden"
          style={{
            background: 'rgba(248,244,238,0.88)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            border: '1px solid rgba(10,46,77,0.08)',
            borderRadius: '18px',
            boxShadow: '0 4px 28px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div className="h-[60px] flex items-center justify-between px-5">
            <Link href="/guides" className="flex-shrink-0">
              <Image
                src="/brand/dark-logo.png"
                alt="FjordAnglers"
                width={140}
                height={36}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <Link
              href="/guides/apply"
              className="text-white text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body flex-shrink-0"
              style={{ background: '#E67E50' }}
            >
              Join as Guide
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── PHOTO HERO ──────────────────────────────────────────── */}
      <header className="relative overflow-hidden" style={{ height: '580px' }}>

        {/* Background photo */}
        <Image
          src="/vanern.jpg"
          alt="Fishing guide"
          fill
          priority
          className="object-cover object-center"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'rgba(5,10,20,0.48)' }} />

        <GrainOverlay />

        {/* Content — pinned to bottom */}
        <div
          className="relative max-w-7xl mx-auto px-8 flex flex-col justify-end h-full pb-16"
          style={{ zIndex: 3 }}
        >
          <div className="flex items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-px" style={{ background: '#E67E50' }} />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
                  Our Guides
                </p>
              </div>
              <h1 className="text-white font-bold f-display" style={{ fontSize: '54px', lineHeight: 1.06 }}>
                Meet the guides
                <br />
                <span style={{ fontStyle: 'italic', color: '#E67E50' }}>who know every fish.</span>
              </h1>
              <p className="mt-5 text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '420px' }}>
                Verified local experts across Norway, Sweden, Finland and Iceland.
              </p>
            </div>

            {/* Live stats */}
            <div className="hidden md:flex items-stretch gap-0 pb-1 flex-shrink-0">
              {[
                { n: stats.guideCount.toString(), label: 'Guides' },
                { n: stats.countryCount.toString(), label: 'Countries' },
                { n: stats.languageCount.toString(), label: 'Languages' },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-stretch">
                  {i > 0 && (
                    <div className="w-px mx-6 self-stretch" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  )}
                  <div className="flex flex-col items-center" style={{ width: '64px' }}>
                    <p className="text-white text-3xl font-bold tracking-tight f-display">{stat.n}</p>
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-3 f-body text-center">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ─── FILTER BAR ──────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-6">
        <div className="max-w-7xl mx-auto flex items-center gap-6 overflow-x-auto">
          {/* Country filters */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link
              href="/guides"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors f-body"
              style={
                !params.country
                  ? { background: '#0A2E4D', color: '#fff' }
                  : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }
              }
            >
              All countries
            </Link>
            {COUNTRIES.map(c => {
              const isActive = params.country === c
              const searchStr = params.language ? `?country=${c}&language=${params.language}` : `?country=${c}`
              return (
                <Link
                  key={c}
                  href={isActive ? (params.language ? `?language=${params.language}` : '/guides') : `/guides${searchStr}`}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors f-body flex items-center gap-1.5"
                  style={
                    isActive
                      ? { background: '#0A2E4D', color: '#fff' }
                      : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }
                  }
                >
                  <span>{COUNTRY_FLAGS[c]}</span>
                  <span>{c}</span>
                </Link>
              )
            })}
          </div>

          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(10,46,77,0.09)' }} />

          {/* Language filters */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {LANGUAGES.map(lang => {
              const isActive = params.language === lang
              const searchStr = params.country ? `?country=${params.country}&language=${lang}` : `?language=${lang}`
              return (
                <Link
                  key={lang}
                  href={isActive ? (params.country ? `?country=${params.country}` : '/guides') : `/guides${searchStr}`}
                  className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors f-body"
                  style={
                    isActive
                      ? { background: 'rgba(230,126,80,0.15)', color: '#C96030', border: '1px solid rgba(230,126,80,0.25)' }
                      : { background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.45)' }
                  }
                >
                  {lang}
                </Link>
              )
            })}
          </div>

          <p className="ml-auto text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>
            {guides.length} guide{guides.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ─── GUIDES GRID ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {guides.length === 0 ? (
          <div className="py-36 flex flex-col items-center">
            <p
              className="font-bold f-display mb-3 text-center"
              style={{ fontSize: 'clamp(48px, 8vw, 88px)', color: 'rgba(10,46,77,0.05)', fontStyle: 'italic', lineHeight: 1 }}
            >
              No guides found
            </p>
            <p className="text-sm mb-8 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Try broadening your filters to find available guides.
            </p>
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all hover:brightness-110 f-body"
              style={{ background: '#E67E50' }}
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {guides.map(guide => {
              const flag = COUNTRY_FLAGS[guide.country] ?? ''
              const fishPills = guide.fish_expertise.slice(0, 3)

              return (
                <Link key={guide.id} href={`/guides/${guide.id}`} className="group block">
                  <article
                    className="overflow-hidden transition-all duration-300 hover:shadow-[0_20px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1"
                    style={{
                      borderRadius: '28px',
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                    }}
                  >
                    {/* Cover image */}
                    <div className="relative overflow-hidden" style={{ height: '180px' }}>
                      {guide.cover_url != null ? (
                        <Image
                          src={guide.cover_url}
                          alt={`${guide.full_name} — ${guide.country}`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: '#0A2E4D' }} />
                      )}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ background: 'rgba(7,17,28,0.22)' }}
                      />
                    </div>

                    {/* Card body */}
                    <div className="px-6 pb-6">
                      <div className="flex items-end justify-between -mt-8 mb-4" style={{ position: 'relative', zIndex: 10 }}>
                        <div
                          className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0"
                          style={{ border: '3px solid #FDFAF7', boxShadow: '0 2px 12px rgba(10,46,77,0.12)' }}
                        >
                          {guide.avatar_url != null ? (
                            <Image
                              src={guide.avatar_url}
                              alt={guide.full_name}
                              width={64}
                              height={64}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-white text-xl f-display font-bold"
                              style={{ background: '#0A2E4D' }}
                            >
                              {guide.full_name[0]}
                            </div>
                          )}
                        </div>

                        {guide.average_rating != null && (
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
                          >
                            ★ {guide.average_rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-lg leading-tight mb-1 f-display" style={{ color: '#0A2E4D' }}>
                        {guide.full_name}
                      </h3>

                      <p className="text-xs mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {flag} {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
                        {guide.years_experience != null && (
                          <span> · {guide.years_experience} yrs exp</span>
                        )}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {fishPills.map(fish => (
                          <span
                            key={fish}
                            className="text-xs font-medium px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                          >
                            {fish}
                          </span>
                        ))}
                        {guide.fish_expertise.length > 3 && (
                          <span
                            className="text-xs font-medium px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.4)' }}
                          >
                            +{guide.fish_expertise.length - 3} more
                          </span>
                        )}
                      </div>

                      {guide.bio != null && (
                        <p
                          className="text-sm leading-relaxed line-clamp-2 mb-5 f-body"
                          style={{ color: 'rgba(10,46,77,0.55)' }}
                        >
                          {guide.bio}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                          {guide.languages.slice(0, 2).join(', ')}
                          {guide.languages.length > 2 && ` +${guide.languages.length - 2}`}
                        </p>
                        <span
                          className="text-xs font-semibold px-4 py-2 rounded-full transition-all group-hover:brightness-110 f-body"
                          style={{ background: '#E67E50', color: '#fff' }}
                        >
                          View Profile →
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      {/* ─── GUIDE CTA BAND ──────────────────────────────────────── */}
      <section className="px-8 py-20" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
        <div
          className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 px-10 py-10 rounded-3xl"
          style={{ background: '#07111C', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>
              Are you a guide?
            </p>
            <h2 className="text-white text-2xl font-bold f-display" style={{ lineHeight: 1.2, maxWidth: '400px' }}>
              Join our community of guides and earn on FjordAnglers.
            </h2>
          </div>
          <Link
            href="/guides/apply"
            className="text-white font-semibold px-8 py-4 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 f-body"
            style={{ background: '#E67E50' }}
          >
            Apply now →
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer className="py-14 px-8 mt-4" style={{ background: '#05101A', borderTop: '1px solid rgba(230,126,80,0.12)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div>
              <Image src="/brand/white-logo.png" alt="FjordAnglers" width={140} height={36} className="h-7 w-auto mb-4" style={{ opacity: 0.55 }} />
              <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.22)', maxWidth: '240px' }}>
                Connecting anglers with the best fishing experiences in Scandinavia.
              </p>
            </div>
            <div className="flex items-center gap-8 md:gap-12">
              {[
                { label: 'All Guides', href: '/guides' },
                { label: 'Join as Guide', href: '/guides/apply' },
              ].map(item => (
                <Link key={item.label} href={item.href} className="text-sm transition-colors f-body hover:text-white/60" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-10 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>© 2026 FjordAnglers</p>
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.14)' }}>Norway · Sweden · Finland</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
