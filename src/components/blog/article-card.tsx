/**
 * One article as a card — the Journal list's "All articles" and the article page's "More from the
 * Journal" (docs/design/blog-2026-11): photo with the category and country on it, title, the
 * description, date and read time. Every field is the post's own; a card never prints a placeholder.
 * Plain markup, no state: it renders inside the client list as well as on the server.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatPostDate, type BlogPostSummary } from '@/lib/blog/post'
import { CREAM, LINE, MUTED, NAVY } from '@/components/site/ui'
import { BlogImage } from './article-blocks'

const PILL_TONES = {
  // On a photo: white, lifted off it by a hairline shadow.
  photo: { background: '#FFFFFF', border: '1px solid transparent', boxShadow: '0 1px 2px rgba(11,27,42,.18)' },
  // On the page: cream with a line, the article hero's tags.
  cream: { background: CREAM, border: `1px solid ${LINE}`, boxShadow: 'none' },
} as const

type PillTone = keyof typeof PILL_TONES

function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className="f-body"
      style={{ display: 'inline-block', padding: '5px 11px', borderRadius: 999, color: NAVY, fontSize: '12.5px', fontWeight: 500, ...PILL_TONES[tone] }}
    >
      {children}
    </span>
  )
}

/** Category and country of a post as pills. Nothing for a blank category or no country. */
export function PostPills({ post, tone = 'photo' }: { post: Pick<BlogPostSummary, 'category' | 'country'>; tone?: PillTone }) {
  return (
    <>
      {post.category.trim() !== '' && <Pill tone={tone}>{post.category}</Pill>}
      {post.country != null && post.country.trim() !== '' && <Pill tone={tone}>{post.country}</Pill>}
    </>
  )
}

export function ArticleCard({ post }: { post: BlogPostSummary }) {
  const href = `/blog/${post.slug}`

  return (
    <article className="flex flex-col gap-[14px]">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block overflow-hidden"
        style={{ borderRadius: 16, aspectRatio: '4 / 3', background: CREAM }}
      >
        <BlogImage src={post.imageUrl} alt="" sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        <span className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          <PostPills post={post} />
        </span>
      </Link>
      <div className="flex flex-col gap-2">
        <h3 className="f-display m-0" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>
          <Link href={href} style={{ color: NAVY, textDecoration: 'none' }}>{post.title}</Link>
        </h3>
        <p className="f-body m-0 text-[15px]" style={{ lineHeight: 1.55, color: MUTED }}>{post.description}</p>
        <p className="f-body m-0 text-[13.5px]" style={{ color: MUTED }}>
          {formatPostDate(post.publishedAt)} · {post.readMinutes} min read
        </p>
      </div>
    </article>
  )
}
