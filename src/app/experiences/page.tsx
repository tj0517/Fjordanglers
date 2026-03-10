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
  const params = await searchParams
  const experiences = await getExperiences(params)

  return (
    <div style={{ background: '#F3EDE4' }}>

      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center px-6"
        style={{
          height: `${NAV_H}px`,
          background: '#F3EDE4',
          borderBottom: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 1px 12px rgba(10,46,77,0.04)',
        }}
      >
        <div className="flex-shrink-0" style={{ width: '160px' }}>
          <Link href="/">
            <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={140} height={36} className="h-8 w-auto" priority />
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
          <Link href="/login" className="text-sm font-medium px-3 py-2 rounded-full transition-colors f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
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

        <main className="overflow-y-auto" style={{ width: '50%', padding: '28px 56px 32px', scrollbarWidth: 'none' } as React.CSSProperties}>
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
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {experiences.map(exp => {
                const coverUrl = exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null
                const flag = exp.location_country != null ? (COUNTRY_FLAGS[exp.location_country] ?? '') : ''
                const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : exp.duration_days != null ? `${exp.duration_days} days` : null
                return (
                  <Link key={exp.id} href={`/experiences/${exp.id}`} className="group block">
                    <article
                      className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
                      style={{ borderRadius: '20px', height: '300px' }}
                    >
                      {/* Photo */}
                      {coverUrl != null ? (
                        <Image src={coverUrl} alt={exp.title} fill sizes="25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                      ) : (
                        <div className="absolute inset-0" style={{ background: '#EDE6DB' }} />
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.88) 0%, rgba(5,10,20,0.2) 55%, transparent 100%)' }} />

                      {/* Top badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <div className="text-white text-sm font-bold px-3 py-1.5 rounded-full f-body" style={{ background: 'rgba(5,12,22,0.65)', backdropFilter: 'blur(8px)' }}>
                          €{exp.price_per_person_eur}<span className="text-xs font-normal opacity-55">/pp</span>
                        </div>
                        {diffLabel != null && (
                          <div className="text-xs font-semibold px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(5,12,22,0.55)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.85)' }}>{diffLabel}</div>
                        )}
                      </div>

                      {/* Bottom text */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-[11px] f-body" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {flag}{' '}{exp.location_city != null ? `${exp.location_city}, ` : ''}{exp.location_country}
                          </span>
                          {exp.fish_types[0] != null && (
                            <>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>·</span>
                              <span className="text-[11px] f-body" style={{ color: 'rgba(255,255,255,0.55)' }}>{exp.fish_types[0]}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-bold leading-snug line-clamp-2 f-display text-white mb-3" style={{ fontSize: '15px' }}>{exp.title}</h3>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                              {exp.guide.avatar_url != null ? (
                                <Image src={exp.guide.avatar_url} alt={exp.guide.full_name} width={24} height={24} className="object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#E67E50] flex items-center justify-center text-white text-[9px] font-bold f-body">{exp.guide.full_name[0]}</div>
                              )}
                            </div>
                            <span className="text-[11px] font-medium f-body" style={{ color: 'rgba(255,255,255,0.6)' }}>{exp.guide.full_name}</span>
                          </div>
                          {duration != null && (
                            <span className="text-[11px] f-body" style={{ color: 'rgba(255,255,255,0.45)' }}>{duration}</span>
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

        <aside className="flex-shrink-0 hidden lg:block" style={{ width: '50%', padding: '12px 16px 12px 0' }}>
          <div className="w-full h-full overflow-hidden" style={{ borderRadius: '20px' }}>
            <MapWrapper experiences={experiences} />
          </div>
        </aside>

      </div>
    </div>
  )
}
