import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BLOG_POSTS } from '@/lib/blog-data'
import { HomeNav } from '@/components/home/home-nav'
import { NorwayRegulationsContent, NORWAY_SECTIONS } from '@/lib/blog-content/norway-regulations-2026'
import { ReadingProgress } from '@/components/blog/reading-progress'
import { TableOfContents } from '@/components/blog/table-of-contents'

const ARTICLE_CONTENT: Record<string, React.ComponentType> = {
  'fishing-regulations-norway-2026': NorwayRegulationsContent,
}

const ARTICLE_SECTIONS: Record<string, readonly { id: string; label: string }[]> = {
  'fishing-regulations-norway-2026': NORWAY_SECTIONS,
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return BLOG_POSTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) return {}
  return {
    title: `${post.title} — FjordAnglers`,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} — FjordAnglers`,
      description: post.excerpt,
      type: 'article',
      images: [{ url: post.img, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — FjordAnglers`,
      description: post.excerpt,
      images: [post.img],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) notFound()

  const ContentComponent = ARTICLE_CONTENT[slug]
  const sections = ARTICLE_SECTIONS[slug]

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <HomeNav />
      {ContentComponent && <ReadingProgress />}

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: 'clamp(380px, 55vh, 640px)' }}>
        <Image src={post.img} alt={post.title} fill priority className="object-cover" />
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
              {post.date}
            </span>
            <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: '12px' }}>·</span>
            <span className="f-body" style={{ fontSize: '13px', color: 'rgba(10,46,77,0.4)' }}>
              {post.readTime} read
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
            {post.excerpt}
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
        {ContentComponent ? (
          <>
            {sections && <TableOfContents sections={sections} />}
            <ContentComponent />
          </>
        ) : (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
          >
            <p className="f-display font-bold text-2xl mb-2" style={{ color: '#0A2E4D' }}>
              Full article coming soon.
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.45)' }}>
              We&apos;re writing this one up. Check back shortly.
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold f-body px-6 py-2.5 rounded-full text-white transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              Read other articles →
            </Link>
          </div>
        )}

        {/* Bottom nav */}
        {ContentComponent && (
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
        )}
      </div>
    </div>
  )
}
