/**
 * Home page: the three newest published articles (FA-1.90), in the 2026-11 redesign's "Journal"
 * section. Not rendered when there are none — including when the blog could not be read
 * (`getLatestBlogPosts` answers empty and logs). Each card is one link (photo, title, description).
 */

import Link from 'next/link'
import { BlogImage } from '@/components/blog/article-blocks'
import { formatPostDate, type BlogPostSummary } from '@/lib/blog/post'
import { CREAM, MUTED, NAVY, SecondaryButton, Tag } from '@/components/site/ui'
import s from './home.module.css'

export function LatestArticles({ posts }: { posts: BlogPostSummary[] }) {
  if (posts.length === 0) return null

  return (
    <section data-block="latest-articles" style={{ paddingTop: 160 }}>
      <div className={`${s.wrap} flex flex-col gap-9`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col items-start gap-[14px]">
            <span className={`${s.pill} f-body`}>Journal</span>
            <h2 className={`${s.h2} f-display m-0 max-w-[720px]`} style={{ color: NAVY }}>Read before you go.</h2>
          </div>
          <SecondaryButton href="/blog">All articles →</SecondaryButton>
        </div>
        <div className={s.arts}>
          {posts.map(post => (
            <article key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="flex flex-col gap-[14px]" style={{ textDecoration: 'none' }}>
                <span className="relative block overflow-hidden" style={{ borderRadius: 16, aspectRatio: '4 / 3', background: CREAM }}>
                  <BlogImage src={post.imageUrl} alt={post.imageAlt} className="object-cover" />
                  <span className="absolute bottom-3 left-3 flex gap-1.5">
                    {post.category.trim() !== '' && <Tag tone="sand">{post.category}</Tag>}
                    {post.country != null && <Tag>{post.country}</Tag>}
                  </span>
                </span>
                <span className="flex flex-col gap-2">
                  <h3 className="f-display m-0" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2, color: NAVY }}>{post.title}</h3>
                  <span className="f-body text-[15px]" style={{ lineHeight: 1.55, color: MUTED }}>{post.description}</span>
                  <span className="f-body text-[13.5px]" style={{ color: MUTED }}>
                    {formatPostDate(post.publishedAt)} · {post.readMinutes} min read
                  </span>
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
