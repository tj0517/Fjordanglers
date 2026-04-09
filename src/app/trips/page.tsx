import Link from 'next/link'
import { Suspense } from 'react'
import { getExperiences } from '@/lib/supabase/queries'
import { SearchBar } from './search-bar'
import { FiltersModal } from './filters-modal'
import { ExperiencesNav } from './experiences-nav'
import MapSection from './map-section'

const PAGE_SIZE = 12

type SearchParams = {
  country?: string; fish?: string; difficulty?: string
  sort?: string; minPrice?: string; maxPrice?: string
  technique?: string; duration?: string; catchRelease?: string; guests?: string
  dateFrom?: string; dateTo?: string; page?: string
}

// ── Inline Pagination — Server Component (only Link, no hooks) ─────────────

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
    return `/trips?${sp.toString()}`
  }

  // Smart page-number list: always show 1 and last, collapse middle with …
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
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-8 pb-2">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className={pill} style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}>
          ← Prev
        </Link>
      ) : (
        <span className={pill} style={{ border: '1px solid rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.2)' }}>← Prev</span>
      )}

      {items.map((item, idx) =>
        item === '…' ? (
          <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>…</span>
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

export const revalidate = 60
export const metadata = {
  title: 'Browse Fishing Trips',
  description: 'Find day trips and multi-day expeditions with verified Scandinavian fishing guides.',
}

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { experiences, total } = await getExperiences(params)

  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Preserve all active filters in pagination links (strip 'page' key)
  const baseParams = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => k !== 'page' && v != null) as [string, string][]
  ).toString()

  return (
    <div style={{ background: '#F3EDE4' }}>

      {/* ── NAVBAR ── */}
      <ExperiencesNav>
        <Suspense fallback={<div className="rounded-full animate-pulse" style={{ flex: 1, height: '44px', background: 'rgba(10,46,77,0.06)' }} />}>
          <SearchBar />
        </Suspense>
        <Suspense fallback={null}>
          <FiltersModal />
        </Suspense>
      </ExperiencesNav>

      {/* Spacer: height matches the fixed nav exactly via --nav-h CSS variable */}
      <div style={{ height: 'var(--nav-h, 120px)' }} />

      {/* ── TWO-COLUMN (viewport-filtered map + list) ── */}
      <MapSection
        initialExperiences={experiences}
        initialTotal={total}
        filterKey={baseParams}
        paginationNode={
          total > PAGE_SIZE
            ? <Pagination page={currentPage} totalPages={totalPages} baseParams={baseParams} />
            : null
        }
      />
    </div>
  )
}
