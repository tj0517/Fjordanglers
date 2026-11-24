'use client'

/**
 * "All articles" on /blog (FA-1.97, docs/design/blog-2026-11/list.dc.html): the filter chips (category,
 * country — both from the posts) and the grid, filtered in the browser over the whole list.
 *
 * The page hands it the starting filter read from `?category=` / `?country=`; the first render — on the
 * server too — already shows the filtered grid. The page keys this component by that filter, so a click
 * on a "Topic hubs" tile (a new URL) starts the list over instead of keeping the chips' state.
 */

import { useState, type CSSProperties } from 'react'
import { filterPosts, listFacets, LIST_PAGE_SIZE, NO_FILTER, type ListFilter } from '@/lib/blog/list'
import type { BlogPostSummary } from '@/lib/blog/post'
import { CREAM, LINE, MUTED, NAVY, SALMON, SectionHeading, buttonClass } from '@/components/site/ui'
import { ArticleCard } from './article-card'

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 999,
  fontSize: '14.5px', fontWeight: 600, cursor: 'pointer',
}
const chipOn: CSSProperties  = { ...chipBase, background: NAVY, color: '#FFFFFF', border: `1px solid ${NAVY}` }
const chipOff: CSSProperties = { ...chipBase, background: CREAM, color: NAVY, border: `1px solid ${LINE}` }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`f-body ${buttonClass.chip}`} style={on ? chipOn : chipOff}>
      {children}
    </button>
  )
}

export function BlogList({ posts, initial }: { posts: BlogPostSummary[]; initial: ListFilter }) {
  const [filter, setFilter] = useState<ListFilter>(initial)
  const [shown, setShown] = useState(LIST_PAGE_SIZE)

  const { categories, countries } = listFacets(posts)
  const matching = filterPosts(posts, filter)
  const visible = matching.slice(0, shown)

  // A new filter starts at the first page again.
  const change = (next: ListFilter) => {
    setFilter(next)
    setShown(LIST_PAGE_SIZE)
  }

  return (
    <section id="articles" data-block="article-list" className="scroll-mt-24">
      <div className="mb-7"><SectionHeading eyebrow="Latest" title="All articles" /></div>

      <div className="mb-9 flex flex-col gap-3">
        {categories.length > 0 && (
          <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
            <Chip on={filter.category == null} onClick={() => change({ ...filter, category: null })}>All</Chip>
            {categories.map(category => (
              <Chip key={category} on={filter.category === category} onClick={() => change({ ...filter, category: filter.category === category ? null : category })}>
                {category}
              </Chip>
            ))}
          </div>
        )}
        {countries.length > 0 && (
          <div role="group" aria-label="Filter by destination" className="flex flex-wrap gap-2">
            {countries.map(country => (
              <Chip key={country} on={filter.country === country} onClick={() => change({ ...filter, country: filter.country === country ? null : country })}>
                {country}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="f-body m-0 text-[16px]" style={{ color: MUTED }}>
          No articles match that yet.{' '}
          <button type="button" onClick={() => change(NO_FILTER)} className="f-body underline" style={{ color: NAVY, cursor: 'pointer', textDecorationColor: SALMON, textUnderlineOffset: 3 }}>
            Show all articles
          </button>
        </p>
      ) : (
        <div className="grid gap-x-8 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {visible.map(post => <ArticleCard key={post.slug} post={post} />)}
        </div>
      )}

      {matching.length > shown && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => setShown(count => count + LIST_PAGE_SIZE)}
            className={`f-body ${buttonClass.secondary}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 22px', borderRadius: 12,
              fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', background: CREAM, color: NAVY, border: `1.5px solid ${SALMON}`, cursor: 'pointer',
            }}
          >
            Load more articles
          </button>
        </div>
      )}
    </section>
  )
}
