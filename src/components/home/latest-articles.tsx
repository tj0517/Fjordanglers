/**
 * Home page: the three newest published articles (FA-1.90). Not rendered when there are none —
 * including when the blog could not be read (`getLatestBlogPosts` answers empty and logs).
 */

import Link from 'next/link'
import { BlogImage } from '@/components/blog/article-blocks'
import { formatPostDate, type BlogPostSummary } from '@/lib/blog/post'

export function LatestArticles({ posts }: { posts: BlogPostSummary[] }) {
  if (posts.length === 0) return null

  return (
    <section data-block="latest-articles" className="px-4 md:px-8 lg:px-14 pb-16 md:pb-24" style={{ background: '#F3EDE4' }}>
      <div className="max-w-[1360px] mx-auto">
        <div className="mb-8 md:mb-11 pt-12 md:pt-20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4" style={{ borderTop: '1px solid rgba(10,46,77,0.09)' }}>
          <div>
            <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>From the journal</p>
            <h2 className="text-[#0A2E4D] font-bold f-display" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)' }}>
              Read before you go.
            </h2>
          </div>
          <Link href="/blog" className="text-sm font-medium f-body hover:text-[#E67E50] transition-colors" style={{ color: 'rgba(10,46,77,0.38)' }}>
            All articles →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <article
                className="overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(10,46,77,0.11)]"
                style={{ borderRadius: '20px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
              >
                <div className="relative overflow-hidden flex-shrink-0" style={{ height: '200px' }}>
                  <BlogImage src={post.imageUrl} alt={post.imageAlt} className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold f-display mb-2 line-clamp-2" style={{ fontSize: '17px', color: '#0A2E4D', lineHeight: 1.35 }}>
                    {post.title}
                  </h3>
                  <p className="text-sm f-body line-clamp-2 mb-auto" style={{ color: 'rgba(10,46,77,0.5)', lineHeight: 1.65 }}>
                    {post.description}
                  </p>
                  <p className="text-xs f-body mt-4" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    {formatPostDate(post.publishedAt)} · {post.readMinutes} min read
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
