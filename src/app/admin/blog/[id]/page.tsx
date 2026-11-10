import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogPostForm } from '@/components/admin/blog-post-form'
import { getBlogPostForAdmin, listGuideOptionsForBlog } from '@/lib/supabase/blog-admin'
import type { BlogStatus } from '@/lib/blog/editor'

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams
  const [post, guides] = await Promise.all([getBlogPostForAdmin(id), listGuideOptionsForBlog()])

  if (post == null) notFound()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1300px]">

      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/blog" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Blog</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>Edit</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-2">Edit post</h1>
      <p className="text-sm f-body mb-8" style={{ color: 'rgba(10,46,77,0.5)' }}>{post.title}</p>

      <BlogPostForm
        postId={post.id}
        initialStatus={post.status as BlogStatus}
        initialPublishedAt={post.published_at}
        guides={guides}
        notice={saved === '1' ? 'Draft created. It is not public until you publish it.' : null}
        initialValues={{
          title: post.title,
          slug: post.slug,
          seo_title: post.seo_title ?? '',
          description: post.description ?? '',
          body_md: post.body_md,
          image_url: post.image_url,
          image_alt: post.image_alt ?? '',
          category: post.category,
          country: post.country,
          guide_id: post.guide_id,
        }}
      />
    </div>
  )
}
