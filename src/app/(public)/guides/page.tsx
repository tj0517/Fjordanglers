import Image from 'next/image'
import Link from 'next/link'
import { getGuides, getPlatformStats } from '@/lib/supabase/queries'
import { GuidesFilters } from './guides-filters'
import { CountryFlag } from '@/components/ui/country-flag'

const PAGE_SIZE = 12

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
    return `/guides?${sp.toString()}`
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
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-10 pb-2">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className={pill} style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
          ← Prev
        </Link>
      ) : (
        <span className={pill} style={{ border: '1px solid rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.2)' }}>← Prev</span>
      )}

      {items.map((item, idx) =>
        item === '…' ? (
          <span key={`e-${idx}`} className="w-9 h-9 flex items-center justify-center text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>…</span>
        ) : item === page ? (
          <span key={item} className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold f-body" style={{ background: '#0A2E4D', color: '#fff' }}>
            {item}
          </span>
        ) : (
          <Link key={item} href={pageHref(item)} className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium f-body transition-colors" style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
            {item}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={pageHref(page + 1)} className={pill} style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
          Next →
        </Link>
      ) : (
        <span className={pill} style={{ border: '1px solid rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.2)' }}>Next →</span>
      )}
    </nav>
  )
}

export const dynamic = 'force-dynamic'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── TYPES ────────────────────────────────────────────────────────────────────

type SearchParams = {
  country?: string
  language?: string
  page?: string
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
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const totalPages  = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [{ guides, total }, stats] = await Promise.all([
    getGuides({ country: params.country, language: params.language, page: currentPage }),
    getPlatformStats(),
  ])

  const baseParams = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => k !== 'page' && v != null) as [string, string][]
  ).toString()

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── PHOTO HERO ──────────────────────────────────────────── */}
      <header className="relative overflow-hidden" style={{ minHeight: '380px', height: 'clamp(380px, 55vw, 580px)' }}>

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
          className="relative max-w-7xl mx-auto px-4 md:px-8 flex flex-col justify-end h-full pb-10 md:pb-16"
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
              <h1 className="text-white font-bold f-display" style={{ fontSize: 'clamp(28px, 5vw, 54px)', lineHeight: 1.06 }}>
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
      <div className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <GuidesFilters country={params.country} language={params.language} />
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
            {total} guide{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ─── GUIDES GRID ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
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
              // flag rendered as <CountryFlag> below
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
                        <CountryFlag country={guide.country} /> {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
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

        {totalPages(total) > 1 && (
          <Pagination page={currentPage} totalPages={totalPages(total)} baseParams={baseParams} />
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

    </div>
  )
}
