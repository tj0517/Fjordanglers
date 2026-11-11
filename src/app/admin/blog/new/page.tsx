import Link from 'next/link'
import { BlogPostForm } from '@/components/admin/blog-post-form'
import { listGuideOptionsForBlog } from '@/lib/supabase/blog-admin'

export default async function NewBlogPostPage() {
  const guides = await listGuideOptionsForBlog()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1300px]">

      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/blog" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Blog</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>New</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-8">New post</h1>

      <BlogPostForm
        postId={null}
        initialStatus="draft"
        initialPublishedAt={null}
        guides={guides}
        initialValues={{
          title: '', slug: '', seo_title: '', description: '', body_md: '',
          image_url: null, image_alt: '', category: 'Planning', country: null, guide_id: null,
        }}
      />
    </div>
  )
}
