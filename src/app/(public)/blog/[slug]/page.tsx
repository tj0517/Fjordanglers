import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BLOG_POSTS } from '@/lib/blog-data'
import { HomeNav } from '@/components/home/home-nav'

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
  return { title: `${post.title} — FjordAnglers`, description: post.excerpt }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <HomeNav />

      {/* Hero image */}
      <div className="relative" style={{ height: 'clamp(280px, 40vh, 500px)' }}>
        <Image src={post.img} alt={post.title} fill priority className="object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(5,10,20,0.35) 0%, rgba(5,10,20,0.65) 100%)' }} />
      </div>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link href="/blog" className="inline-flex items-center gap-2 text-xs font-semibold f-body mb-8 transition-opacity hover:opacity-60" style={{ color: 'rgba(10,46,77,0.45)' }}>
          ← Back to Journal
        </Link>

        <div className="flex items-center gap-3 mb-5">
          <span
            className="text-[11px] font-semibold px-3 py-1 rounded-full f-body"
            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.2)' }}
          >
            {post.category}
          </span>
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{post.date} · {post.readTime} read</span>
        </div>

        <h1 className="font-bold f-display mb-6" style={{ fontSize: 'clamp(28px, 4vw, 48px)', color: '#0A2E4D', lineHeight: 1.1 }}>
          {post.title}
        </h1>

        <p className="text-base f-body leading-relaxed mb-12" style={{ color: 'rgba(10,46,77,0.55)', fontSize: '18px', lineHeight: 1.8 }}>
          {post.excerpt}
        </p>

        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          <p className="f-display font-bold text-2xl mb-2" style={{ color: '#0A2E4D' }}>Full article coming soon.</p>
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
      </div>
    </div>
  )
}
