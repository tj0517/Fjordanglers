import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BLOG_POSTS } from '@/lib/blog-data'
import { HomeNav } from '@/components/home/home-nav'

export const metadata: Metadata = {
  title: 'Journal — FjordAnglers',
  description: 'Guides, tips, and destination stories from the world of Scandinavian fishing.',
}

const CATEGORY_COLORS: Record<string, string> = {
  Destinations: '#1B4F72',
  Sweden: '#1B4F72',
  'Tips & Tactics': '#7B4A1E',
  Planning: '#2E6B4A',
  Species: '#5B3A8A',
}

export default function BlogPage() {
  const [featured, ...rest] = BLOG_POSTS

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <HomeNav initialVariant="light" />

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-4 md:px-6">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-px" style={{ background: '#E67E50' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
              From the Journal
            </p>
          </div>
          <h1 className="font-bold f-display" style={{ fontSize: 'clamp(40px, 5vw, 72px)', color: '#0A2E4D', lineHeight: 1.06 }}>
            Stories from<br />
            <span style={{ fontStyle: 'italic' }}>the water.</span>
          </h1>
        </div>
      </section>

      {/* ─── FEATURED + GRID ──────────────────────────────────────────── */}
      <section className="px-4 md:px-6 pb-24">
        <div className="max-w-[1440px] mx-auto">

          {/* Featured post */}
          <Link href={`/blog/${featured.slug}`} className="group block mb-5">
            <article
              className="relative overflow-hidden"
              style={{ borderRadius: '24px', height: 'clamp(320px, 44vw, 560px)' }}
            >
              <Image
                src={featured.img}
                alt={featured.title}
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.88) 0%, rgba(5,10,20,0.3) 55%, transparent 100%)' }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                <span
                  className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-4 f-body"
                  style={{ background: 'rgba(230,126,80,0.22)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.3)' }}
                >
                  {featured.category}
                </span>
                <h2 className="text-white font-bold f-display mb-3" style={{ fontSize: 'clamp(22px, 3vw, 36px)', maxWidth: '680px', lineHeight: 1.15 }}>
                  {featured.title}
                </h2>
                <p className="text-sm f-body mb-4" style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '540px' }}>
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>{featured.date}</span>
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>{featured.readTime} read</span>
                </div>
              </div>
            </article>
          </Link>

          {/* Rest of posts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {rest.map(post => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                <article
                  className="overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(10,46,77,0.11)]"
                  style={{ borderRadius: '20px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
                >
                  <div className="relative overflow-hidden flex-shrink-0" style={{ height: '180px' }}>
                    <Image
                      src={post.img}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                    <div className="absolute top-3 left-3">
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                        style={{
                          background: 'rgba(5,12,22,0.65)',
                          color: 'rgba(255,255,255,0.82)',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-semibold f-display mb-2 line-clamp-2" style={{ fontSize: '15px', color: '#0A2E4D', lineHeight: 1.35 }}>
                      {post.title}
                    </h3>
                    <p className="text-xs f-body line-clamp-2 mb-auto" style={{ color: 'rgba(10,46,77,0.45)', lineHeight: 1.65 }}>
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                      <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{post.date}</span>
                      <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: '10px' }}>·</span>
                      <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{post.readTime} read</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
