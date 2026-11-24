/**
 * The sections of /blog around the filterable list (FA-1.97, docs/design/blog-2026-11/list.dc.html):
 * the newest article on a grain block, "Topic hubs", "Browse by destination" and the closing
 * "Plan your trip". Server components; the list between them is `blog-list.tsx`.
 */

import Image from 'next/image'
import Link from 'next/link'
import { PLAN_YOUR_TRIP_HREF } from '@/components/layout/nav'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { hasCategory } from '@/lib/blog/list'
import { formatPostDate, type BlogPostSummary } from '@/lib/blog/post'
import { Arrow, Eyebrow, NAVY, ON_DARK, ON_DARK_SOFT, PrimaryButton, SecondaryButton, SectionHeading } from '@/components/site/ui'
import s from '@/components/site/grain.module.css'
import { BlogImage } from './article-blocks'
import { PostPills } from './article-card'

/** The newest post, big. The photo is the page's LCP image. */
export function FeaturedPost({ post }: { post: BlogPostSummary }) {
  const href = `/blog/${post.slug}`

  return (
    <section
      data-block="featured-article"
      className={`${s.blur} ${s.fjord} flex flex-wrap items-center gap-x-12 gap-y-8`}
      style={{ borderRadius: 24, padding: 'clamp(24px, 4vw, 48px)' }}
    >
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px]">
        <span className="flex flex-wrap gap-1.5"><PostPills post={post} /></span>
        <h2
          className="f-display m-0"
          style={{ fontWeight: 600, fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.08, letterSpacing: '-.015em', color: '#FFFFFF' }}
        >
          {post.title}
        </h2>
        <p className="f-body m-0 max-w-[520px] text-[17px]" style={{ lineHeight: 1.55, color: ON_DARK }}>{post.description}</p>
        <p className="f-body m-0 text-[14px]" style={{ color: ON_DARK_SOFT }}>
          {formatPostDate(post.publishedAt)} · {post.readMinutes} min read
        </p>
        <div><SecondaryButton href={href}>Read the guide</SecondaryButton></div>
      </div>
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block min-w-0 flex-[1_1_380px] overflow-hidden"
        style={{ borderRadius: 16, aspectRatio: '4 / 3', boxShadow: '0 24px 60px rgba(4,14,24,.45)' }}
      >
        <BlogImage src={post.imageUrl} alt={post.imageAlt} priority fetchPriority="high" sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
      </Link>
    </section>
  )
}

/** Topic tiles. There is no page per topic yet (tj, 2026-11-23): a tile opens the list with that category chosen. */
const TOPICS = [
  { category: 'Regulations', title: 'Regulations and licences', body: 'What you need before the first cast, country by country.', bg: s.iceland },
  { category: 'Seasons',     title: 'Seasons',                   body: 'Open months, peak months and what changes on each river.', bg: s.finland },
  { category: 'Species',     title: 'Species',                   body: 'Where each fish lives and how the guides fish for it.', bg: s.guide },
] as const

/** Only a topic somebody has written about gets a tile (case-insensitively); none at all, no section. */
export function TopicHubs({ posts }: { posts: readonly BlogPostSummary[] }) {
  const topics = TOPICS.filter(topic => hasCategory(posts, topic.category))
  if (topics.length === 0) return null

  return (
    <section data-block="topic-hubs">
      <div className="mb-7"><SectionHeading eyebrow="Start here" title="Topic hubs" /></div>
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {topics.map(topic => (
          <Link
            key={topic.category}
            href={`/blog?category=${topic.category}`}
            className={`${s.blur} ${topic.bg} flex flex-col justify-end gap-[10px]`}
            style={{ minHeight: 240, padding: 28, borderRadius: 20, textDecoration: 'none' }}
          >
            <span className="f-display" style={{ fontSize: 28, lineHeight: 1.1, color: '#FFFFFF' }}>{topic.title}</span>
            <span className="f-body text-[15.5px]" style={{ lineHeight: 1.5, color: ON_DARK }}>{topic.body}</span>
            <span className="f-body mt-1.5 inline-flex items-center gap-2 text-[14.5px] font-semibold" style={{ color: '#FFFFFF' }}>
              See the articles<Arrow />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** The mockup's order; a hub that is not in `DESTINATION_HUBS` gets no tile. Patagonia has no photo yet — a navy tile. */
const DESTINATIONS = [
  { slug: 'iceland',     name: 'Iceland',     line: 'Trout, char, salmon',          photo: '/hub/iceland.jpg' },
  { slug: 'norway',      name: 'Norway',      line: 'Fjords, lakes, salmon rivers', photo: '/hub/norway.jpg' },
  { slug: 'sweden',      name: 'Sweden',      line: 'Archipelago and lakes',        photo: '/hub/sweden.jpg' },
  { slug: 'finland',     name: 'Finland',     line: 'Lakes and Lapland',            photo: '/hub/finland.jpg' },
  { slug: 'new-zealand', name: 'New Zealand', line: 'Sight fishing for trout',      photo: '/hub/nzriver.jpg' },
  { slug: 'patagonia',   name: 'Patagonia',   line: 'Argentina and Chile',          photo: null },
] as const

export function DestinationTiles() {
  const tiles = DESTINATIONS.filter(tile => DESTINATION_HUBS.some(hub => hub.slug === tile.slug))

  return (
    <section data-block="destinations">
      <div className="mb-7"><SectionHeading eyebrow="Destinations" title="Browse by destination" /></div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {tiles.map(tile => (
          <Link
            key={tile.slug}
            href={`/${tile.slug}`}
            className="relative flex items-end overflow-hidden"
            style={{ aspectRatio: '3 / 4', borderRadius: 16, textDecoration: 'none', background: NAVY }}
          >
            {tile.photo != null && <Image src={tile.photo} alt="" fill sizes="(min-width: 1024px) 190px, 50vw" className="object-cover" />}
            <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,22,36,0) 40%, rgba(7,22,36,.78) 100%)' }} />
            <span className="relative flex flex-col gap-0.5 p-4">
              <span className="f-display text-[22px]" style={{ color: '#FFFFFF' }}>{tile.name}</span>
              <span className="f-body text-[13.5px]" style={{ color: ON_DARK_SOFT }}>{tile.line}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function PlanYourTripBlock() {
  return (
    <section
      data-block="plan"
      className={`${s.blur} ${s.canyon} flex flex-wrap items-center justify-between gap-8`}
      style={{ borderRadius: 24, padding: '56px clamp(24px, 5vw, 64px)' }}
    >
      <div className="flex max-w-[620px] flex-[1_1_420px] flex-col gap-[14px]">
        <Eyebrow dark>Plan your trip</Eyebrow>
        <h2
          className="f-display m-0"
          style={{ fontWeight: 600, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.08, letterSpacing: '-.015em', color: '#FFFFFF' }}
        >
          Tell us your dates. We check with the guide.
        </h2>
        <p className="f-body m-0 text-[17px]" style={{ lineHeight: 1.55, color: ON_DARK }}>
          We come back with availability and a price within two business days. You pay nothing to ask.
        </p>
      </div>
      <PrimaryButton href={PLAN_YOUR_TRIP_HREF} dark>Plan your trip</PrimaryButton>
    </section>
  )
}
