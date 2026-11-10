import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBlogPost } from '@/lib/supabase/queries'
import { absoluteImageUrl, buildArticleJsonLd, buildBlogBreadcrumbJsonLd, formatPostDate } from '@/lib/blog/post'
import { extractSections } from '@/lib/blog/article-markdown'
import { serializeJsonLd } from '@/lib/seo/offer-jsonld'
import { ArticleBody } from '@/components/blog/article-body'
import { BlogImage } from '@/components/blog/article-blocks'
import { ReadingProgress } from '@/components/blog/reading-progress'
import { TableOfContents } from '@/components/blog/table-of-contents'
import { SITE_URL } from '@/lib/site'

// The article comes from the table (FA-1.83): rendered on first request, then cached for 5 minutes under
// the `blog` tag. No generateStaticParams — a build must not need the database, and a slug that is not a
// published post is a 404 from `notFound()` below.
export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (post == null) return {}

  const url = `${SITE_URL}/blog/${post.slug}`
  const image = absoluteImageUrl(post.imageUrl)

  return {
    // `absolute`: the <title> is the row's SEO title as written (≤ 60 characters), without the site template.
    title: { absolute: post.seoTitle },
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${post.title} | FjordAnglers`,
      description: post.description,
      type: 'article',
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: image, width: 1200, height: 630, alt: post.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | FjordAnglers`,
      description: post.description,
      images: [image],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (post == null) notFound()

  const sections = extractSections(post.bodyMd)

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildArticleJsonLd(post)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBlogBreadcrumbJsonLd(post)) }} />
      <ReadingProgress />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: 'clamp(380px, 55vh, 640px)' }}>
        <BlogImage src={post.imageUrl} alt={post.imageAlt} priority className="object-cover" />
        {/* Gradient: dark at bottom for legibility */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(5,10,20,0.18) 0%, rgba(5,10,20,0.1) 40%, rgba(5,10,20,0.82) 100%)' }}
        />
      </div>

      {/* ── Title card ───────────────────────────────────────────── */}
      <div style={{ background: '#F3EDE4' }}>
        <div
          className="mx-auto px-6"
          style={{ maxWidth: '800px', paddingTop: '3rem', paddingBottom: '3rem' }}
        >
          {/* Back */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 f-body transition-opacity hover:opacity-60"
            style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(10,46,77,0.4)', marginBottom: '2rem', display: 'flex' }}
          >
            ← Back to Journal
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3" style={{ marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <span
              className="f-body"
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '99px',
                background: 'rgba(230,126,80,0.12)', color: '#E67E50',
                border: '1px solid rgba(230,126,80,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              {post.category}
            </span>
            <span className="f-body" style={{ fontSize: '13px', color: 'rgba(10,46,77,0.4)' }}>
              {formatPostDate(post.publishedAt)}
            </span>
            <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: '12px' }}>·</span>
            <span className="f-body" style={{ fontSize: '13px', color: 'rgba(10,46,77,0.4)' }}>
              {post.readMinutes} min read
            </span>
          </div>

          {/* Title */}
          <h1
            className="f-display font-bold"
            style={{ fontSize: 'clamp(28px, 4vw, 50px)', color: '#0A2E4D', lineHeight: 1.08, maxWidth: '700px' }}
          >
            {post.title}
          </h1>

          {/* Excerpt / lead */}
          <p
            className="f-body"
            style={{
              fontSize: '18px', lineHeight: 1.75, color: 'rgba(10,46,77,0.55)',
              marginTop: '1.25rem', maxWidth: '620px',
            }}
          >
            {post.description}
          </p>

          {/* Rule */}
          <div style={{ height: '1px', background: 'rgba(10,46,77,0.1)', marginTop: '3rem' }} />
        </div>
      </div>

      {/* ── Article body ─────────────────────────────────────────── */}
      <div
        className="mx-auto px-6"
        style={{ maxWidth: '800px', paddingTop: '2.5rem', paddingBottom: '6rem' }}
      >
        {sections.length > 0 && <TableOfContents sections={sections} />}
        <ArticleBody markdown={post.bodyMd} />

        {/* Bottom nav */}
        <div
            style={{
              marginTop: '5rem', paddingTop: '3rem',
              borderTop: '1px solid rgba(10,46,77,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
            }}
          >
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 f-body transition-opacity hover:opacity-60"
              style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(10,46,77,0.5)' }}
            >
              ← Back to Journal
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold f-body px-6 py-2.5 rounded-full text-white transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              More articles →
            </Link>
        </div>
      </div>
    </div>
  )
}
