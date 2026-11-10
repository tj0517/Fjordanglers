import Link from 'next/link'
import { Plus, Newspaper, ExternalLink } from 'lucide-react'
import { listBlogPostsForAdmin } from '@/lib/supabase/blog-admin'
import { formatPostDate } from '@/lib/blog/post'

export default async function AdminBlogPage() {
  const posts = await listBlogPostsForAdmin()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1100px]">

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Newspaper size={18} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
            <h1 className="text-[#0A2E4D] text-xl font-bold f-display">Blog</h1>
          </div>
          <p className="text-sm f-body max-w-xl" style={{ color: 'rgba(10,46,77,0.5)' }}>
            A draft is visible only here. Publishing puts the article on the site, the blog list and
            the sitemap within a moment — no deploy.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          <Plus size={14} strokeWidth={2} />
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          No posts yet. <Link href="/admin/blog/new" style={{ color: '#E67E50' }}>Write the first one.</Link>
        </p>
      ) : (
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
          <div
            className="hidden sm:grid grid-cols-[1fr_110px_150px_150px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] f-body"
            style={{ background: 'rgba(10,46,77,0.04)', color: 'rgba(10,46,77,0.5)' }}
          >
            <span>Title</span><span>Status</span><span>Published</span><span>Updated</span>
          </div>
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="grid sm:grid-cols-[1fr_110px_150px_150px] gap-x-4 gap-y-1 px-5 py-4 items-center"
              style={{ background: i % 2 === 0 ? '#FDFAF7' : '#FAF6F0', borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : undefined }}
            >
              <div className="min-w-0">
                <Link href={`/admin/blog/${post.id}`} className="text-sm font-semibold f-body hover:underline" style={{ color: '#0A2E4D' }}>
                  {post.title}
                </Link>
                <p className="text-[11px] f-body mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  <span>/blog/{post.slug}</span>
                  {post.country != null && <span>· {post.country}</span>}
                  {post.status === 'published' && (
                    <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 underline">
                      View <ExternalLink size={10} />
                    </Link>
                  )}
                </p>
              </div>
              <span>
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold f-body"
                  style={post.status === 'published'
                    ? { background: 'rgba(10,46,77,0.1)', color: '#0A2E4D' }
                    : { background: 'rgba(230,126,80,0.15)', color: '#9A4A22' }}
                >
                  {post.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </span>
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                {post.published_at != null ? formatPostDate(post.published_at) : '—'}
              </span>
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                {formatPostDate(post.updated_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
