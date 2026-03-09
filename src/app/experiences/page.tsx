import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { getExperiences } from '@/lib/supabase/queries'
import { SearchBar } from './search-bar'
import { FiltersModal } from './filters-modal'
import MapWrapper from './map-wrapper'

const NAV_H = 96

const COUNTRY_FLAGS: Record<string, string> = {
  Norway: '🇳🇴', Sweden: '🇸🇪', Finland: '🇫🇮', Iceland: '🇮🇸', Denmark: '🇩🇰',
}
const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}

type SearchParams = {
  country?: string; fish?: string; difficulty?: string
  sort?: string; minPrice?: string; maxPrice?: string
}

export const revalidate = 60
export const metadata = {
  title: 'Browse Fishing Experiences',
  description: 'Find day trips and multi-day expeditions with verified Scandinavian fishing guides.',
}

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params      = await searchParams
  const experiences = await getExperiences(params)

  return (
    <div style={{ background: '#F3EDE4' }}>

      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center px-6"
        style={{
          height: `${NAV_H}px`,
          background: 'rgba(8,28,52,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 40px rgba(0,0,0,0.28)',
        }}
      >
        <div className="flex-shrink-0" style={{ width: '160px' }}>
          <Link href="/">
            <Image src="/brand/white-logo.png" alt="FjordAnglers" width={140} height={36} className="h-8 w-auto" priority />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center gap-3">
          <Suspense fallback={<div className="rounded-full animate-pulse" style={{ width: '420px', height: '52px', background: 'rgba(255,255,255,0.08)' }} />}>
            <SearchBar />
          </Suspense>
          <Suspense fallback={null}>
            <FiltersModal />
          </Suspense>
        </div>

        <div className="flex-shrink-0 flex items-center justify-end gap-1" style={{ width: '160px' }}>
          <Link href="/login" className="text-white/55 hover:text-white/90 text-sm font-medium px-3 py-2 rounded-full transition-colors hover:bg-white/[0.07] f-body">
            Sign in
          </Link>
          <Link href="/guides/apply" className="text-white text-sm font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body" style={{ background: '#E67E50' }}>
            Join →
          </Link>
        </div>
      </nav>

      <div style={{ height: `${NAV_H}px` }} />

      {/* ── TWO-COLUMN ── */}
      <div className="flex" style={{ height: `calc(100vh - ${NAV_H}px)` }}>

        <main className="flex-1 min-w-0 overflow-y-auto" style={{ padding: '20px 24px 24px', scrollbarWidth: 'none' } as React.CSSProperties}>
          <p className="text-xs font-medium f-body mb-5" style={{ color: 'rgba(10,46,77,0.4)' }}>
            <span className="font-bold" style={{ color: '#0A2E4D' }}>{experiences.length}</span>
            {' '}trip{experiences.length !== 1 ? 's' : ''} found
          </p>

          {experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ borderRadius: '20px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', minHeight: '400px' }}>
              <p className="font-bold f-display mb-3" style={{ fontSize: '44px', color: 'rgba(10,46,77,0.05)', fontStyle: 'italic' }}>No trips found</p>
              <p className="text-sm mb-6 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Try broadening your search.</p>
              <Link href="/experiences" className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body" style={{ background: '#E67E50' }}>Clear all filters</Link>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              {experiences.map(exp => {
                const coverUrl = exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null
                const flag = exp.location_country != null ? (COUNTRY_FLAGS[exp.location_country] ?? '') : ''
                const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : exp.duration_days != null ? `${exp.duration_days} days` : null
                return (
                  <Link key={exp.id} href={`/experiences/${exp.id}`} className="group block">
                    <article className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-[0_16px_48px_rgba(10,46,77,0.13)] hover:-translate-y-1" style={{ borderRadius: '20px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}>
                      <div className="relative overflow-hidden flex-shrink-0" style={{ height: '220px', borderRadius: '20px 20px 0 0' }}>
                        {coverUrl != null ? (
                          <Image src={coverUrl} alt={exp.title} fill sizes="(max-width:1280px) 30vw,420px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                        ) : (
                          <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                        )}
                        <div className="absolute top-3 left-3 text-white text-sm font-bold px-3 py-1.5 rounded-full f-body" style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}>
                          €{exp.price_per_person_eur}<span className="text-xs font-normal opacity-55">/pp</span>
                        </div>
                        {diffLabel != null && (
                          <div className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(5,12,22,0.6)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.85)' }}>{diffLabel}</div>
                        )}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-4" style={{ background: 'linear-gradient(to top,rgba(10,46,77,0.35) 0%,transparent 50%)' }}>
                          <span className="text-sm font-semibold px-4 py-2 rounded-full f-body" style={{ background: '#E67E50', color: 'white' }}>View trip →</span>
                        </div>
                      </div>
                      <div className="px-5 py-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                            {flag}{' '}{exp.location_city != null ? `${exp.location_city}, ` : ''}{exp.location_country}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap justify-end flex-shrink-0">
                            {exp.fish_types.slice(0, 2).map(f => (
                              <span key={f} className="text-[11px] font-medium px-2 py-0.5 rounded-full f-body" style={{ background: 'rgba(201,107,56,0.1)', color: '#9E4820' }}>{f}</span>
                            ))}
                          </div>
                        </div>
                        <h3 className="font-bold leading-snug line-clamp-2 f-display" style={{ fontSize: '15px', color: '#0A2E4D' }}>{exp.title}</h3>
                        {exp.description != null && (
                          <p className="text-xs leading-relaxed line-clamp-2 f-body" style={{ color: 'rgba(10,46,77,0.52)' }}>{exp.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {duration != null && <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.6)' }}>⏱ {duration}</span>}
                          {exp.max_guests != null && <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.6)' }}>👥 max {exp.max_guests}</span>}
                        </div>
                        <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(10,46,77,0.08)' }}>
                              {exp.guide.avatar_url != null ? (
                                <Image src={exp.guide.avatar_url} alt={exp.guide.full_name} width={32} height={32} className="object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#0A2E4D] flex items-center justify-center text-white text-[10px] font-bold f-body">{exp.guide.full_name[0]}</div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>{exp.guide.full_name}</p>
                              <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Verified guide</p>
                            </div>
                          </div>
                          {exp.guide.average_rating != null && (
                            <div className="flex items-center gap-1">
                              <span style={{ color: '#E67E50', fontSize: '14px' }}>★</span>
                              <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{exp.guide.average_rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          )}
        </main>

        <aside className="flex-shrink-0 hidden lg:block" style={{ width: '42%', padding: '16px 16px 16px 0' }}>
          <div className="w-full h-full overflow-hidden" style={{ borderRadius: '20px', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}>
            <MapWrapper experiences={experiences} />
          </div>
        </aside>

      </div>
    </div>
  )
}
