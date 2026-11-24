import type { Metadata } from 'next'
import Link from 'next/link'
import { getBlogPosts } from '@/lib/supabase/queries'
import { initialFilter } from '@/lib/blog/list'
import { BlogList } from '@/components/blog/blog-list'
import { DestinationTiles, FeaturedPost, PlanYourTripBlock, TopicHubs } from '@/components/blog/blog-index'
import { Eyebrow, MUTED, NAVY } from '@/components/site/ui'
import { SITE_URL } from '@/lib/site'

// Published posts come from the table (FA-1.83); the data layer caches them for 5 minutes under the `blog` tag.
// Rendered per request, not at build: a build (CI, a preview without env) has no database to read, and
// `getBlogPosts` throws on a failed read rather than cache "no articles" — a prerender would fail the build.
// `?category=` / `?country=` only choose the list's starting filter (FA-1.97), which is one more reason.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Fishing Journal — Tips, Guides & Destination Stories',
  description: 'Season dates, licence rules and tactics, written from the rivers we actually send people to.',
  // Always /blog: a filter is a view of the same page, not another page to index.
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    url: `${SITE_URL}/blog`,
    type: 'website',
    // Page-level openGraph replaces the layout's wholesale, so the default image is restated here.
    images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: 'Fishing Journal | FjordAnglers' }],
  },
}

interface Props {
  searchParams: Promise<{ category?: string | string[]; country?: string | string[] }>
}

export default async function BlogPage({ searchParams }: Props) {
  const [posts, params] = await Promise.all([getBlogPosts(), searchParams])
  const [newest] = posts
  const initial = initialFilter(posts, params)

  return (
    <div className="f-body min-h-screen" style={{ background: '#F3EDE4', color: NAVY }}>
      <main className="mx-auto flex flex-col gap-20 px-6 pt-[128px]" style={{ maxWidth: 1200 }}>
        <section data-block="journal-intro" className="flex flex-col gap-9">
          <div className="flex max-w-[760px] flex-col gap-[14px]">
            <Eyebrow>Journal</Eyebrow>
            <h1
              className="f-display"
              style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(40px, 5.4vw, 64px)', lineHeight: 1.04, letterSpacing: '-.02em', color: NAVY }}
            >
              Read before you go
            </h1>
            <p className="f-body m-0 text-[19px]" style={{ lineHeight: 1.55, color: MUTED }}>
              Regulations, seasons and water notes for the places our guides fish.
            </p>
          </div>
          {newest != null && <FeaturedPost post={newest} />}
        </section>

        {newest == null ? (
          <p className="f-body m-0 text-base" style={{ color: MUTED }}>
            The first articles are on their way. In the meantime, <Link href="/trips" className="underline">browse the trips</Link>.
          </p>
        ) : (
          <>
            <TopicHubs posts={posts} />
            {/* Keyed by the starting filter: a tile click is a new URL and starts the chips over. */}
            <BlogList key={`${initial.category ?? ''}|${initial.country ?? ''}`} posts={posts} initial={initial} />
          </>
        )}

        <DestinationTiles />
        <PlanYourTripBlock />
      </main>
    </div>
  )
}
