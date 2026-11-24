import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticleRelated, getBlogPost, getLatestBlogPosts } from '@/lib/supabase/queries'
import { absoluteImageUrl, buildArticleJsonLd, buildBlogBreadcrumbJsonLd, formatPostDate } from '@/lib/blog/post'
import { extractArticleFaq, extractSections } from '@/lib/blog/article-markdown'
import { buildFaqPageJsonLd } from '@/lib/seo/faq-jsonld'
import { serializeJsonLd } from '@/lib/seo/offer-jsonld'
import { ArticleBody } from '@/components/blog/article-body'
import { ArticleCard, PostPills } from '@/components/blog/article-card'
import { ArticleHubCta } from '@/components/blog/article-hub-cta'
import { BlogImage } from '@/components/blog/article-blocks'
import { TableOfContents } from '@/components/blog/table-of-contents'
import ArticleRelated from '@/components/blog/article-related'
import { HeadingLink, MUTED, NAVY, SectionHeading, CREAM } from '@/components/site/ui'
import { SITE_URL } from '@/lib/site'

// The article comes from the table (FA-1.83): rendered on first request, then cached for 5 minutes under
// the `blog` tag. A slug that is not a published post is a 404 from `notFound()` below.
export const revalidate = 300

// No slugs prebuilt — a build has no database (CI). The empty list is what makes the route ISR rather
// than `ƒ` (the FA-1.80 pattern on /experiences/[slug]; FA-1.90 D4): each slug renders on its first
// request and is then served from the cache.
export function generateStaticParams() {
  return []
}

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

function Chevron() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A949C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

const crumbStyle = { color: MUTED, textDecoration: 'none' } as const

/** The UTC day of an ISO timestamp — "updated" is shown only when it is a different day from "published". */
const utcDay = (iso: string): string => iso.slice(0, 10)

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (post == null) notFound()

  const sections = extractSections(post.bodyMd)
  const faq = extractArticleFaq(post.bodyMd)
  const faqJsonLd = faq == null ? null : buildFaqPageJsonLd(faq.entries.map(entry => ({ question: entry.question, answer: entry.answerText })))
  const [related, latest] = await Promise.all([getArticleRelated({ country: post.country }), getLatestBlogPosts(4)])
  // The current post is never "more from the Journal"; up to three others.
  const more = latest.filter(other => other.slug !== post.slug).slice(0, 3)
  const updated = utcDay(post.updatedAt) !== utcDay(post.publishedAt)

  return (
    <div className="f-body min-h-screen" style={{ background: '#F3EDE4', color: NAVY }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildArticleJsonLd(post)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBlogBreadcrumbJsonLd(post)) }} />
      {faqJsonLd != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
      )}

      {/* The nav is fixed and this page has no photo hero behind it: 72 px for the bar, 32 px of air. */}
      <main className="mx-auto flex flex-col gap-[72px] px-6 pt-[104px]" style={{ maxWidth: 1200 }}>
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section data-block="article-hero" className="flex flex-col gap-7">
          <nav aria-label="Breadcrumb" className="f-body flex flex-wrap items-center gap-2 text-[14px]">
            <Link href="/" style={crumbStyle}>Home</Link>
            <Chevron />
            <Link href="/blog" style={crumbStyle}>Journal</Link>
            {post.country != null && post.country.trim() !== '' && (
              <>
                <Chevron />
                {related.hub != null
                  ? <Link href={`/${related.hub.slug}`} style={crumbStyle}>{post.country}</Link>
                  : <span style={{ color: MUTED }}>{post.country}</span>}
              </>
            )}
            <Chevron />
            <span aria-current="page" style={{ color: NAVY }}>{post.title}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-x-14 gap-y-9">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
              <span className="flex flex-wrap gap-1.5"><PostPills post={post} tone="cream" /></span>
              <h1
                className="f-display"
                style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(36px, 4.6vw, 56px)', lineHeight: 1.05, letterSpacing: '-.02em', color: NAVY }}
              >
                {post.title}
              </h1>
              <p className="f-body m-0 text-[19px]" style={{ lineHeight: 1.55, color: MUTED }}>{post.description}</p>
              <p className="f-body m-0 flex flex-wrap items-center gap-x-[14px] gap-y-1.5 text-[14.5px]" style={{ color: MUTED }}>
                <span style={{ fontWeight: 600, color: NAVY }}>FjordAnglers</span>
                <span>{formatPostDate(post.publishedAt)}</span>
                <span>{post.readMinutes} min read</span>
              </p>
            </div>
            <div className="relative min-w-0 flex-[1_1_420px] overflow-hidden" style={{ borderRadius: 20, aspectRatio: '5 / 4' }}>
              <BlogImage src={post.imageUrl} alt={post.imageAlt} priority fetchPriority="high" sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            </div>
          </div>
        </section>

        {/* ── Contents + article ───────────────────────────────────── */}
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-[72px]">
          {sections.length > 0 && <TableOfContents sections={sections} />}
          <article className="flex min-w-0 max-w-[760px] flex-[1_1_0] flex-col gap-6">
            <ArticleBody markdown={post.bodyMd} country={post.country} />
            <div
              className="flex flex-wrap items-center justify-between gap-4"
              style={{ padding: 24, marginTop: 16, borderRadius: 16, background: CREAM }}
            >
              <p className="f-body m-0 flex flex-col gap-1">
                <span style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Written by FjordAnglers</span>
                <span style={{ fontSize: '14.5px', color: MUTED }}>
                  Published {formatPostDate(post.publishedAt)}
                  {updated && ` · Updated ${formatPostDate(post.updatedAt)}`}
                </span>
              </p>
            </div>
          </article>
        </div>

        <ArticleRelated related={related} country={post.country} />
        <ArticleHubCta hub={related.hub} country={post.country} />

        {more.length > 0 && (
          <section data-block="more-from-journal">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <SectionHeading eyebrow="Keep reading" title="More from the Journal" />
              <HeadingLink href="/blog">All articles</HeadingLink>
            </div>
            <div className="grid gap-x-8 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {more.map(other => <ArticleCard key={other.slug} post={other} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
