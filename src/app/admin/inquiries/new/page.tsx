import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { NewInquiryForm } from './NewInquiryForm'

export const metadata = { title: 'New Inquiry — Admin' }

export default async function NewInquiryPage() {
  const svc = createServiceClient()

  // Fetch active experiences + guide names for the trip dropdown
  const { data: experiences } = await svc
    .from('experiences')
    .select('id, title, guide_id')
    .order('title', { ascending: true })

  const guideIds = [...new Set((experiences ?? []).map(e => e.guide_id).filter(Boolean))]
  const { data: guides } = guideIds.length > 0
    ? await svc.from('guides').select('id, full_name').in('id', guideIds)
    : { data: [] as Array<{ id: string; full_name: string }> }

  const guideMap = new Map((guides ?? []).map(g => [g.id, g.full_name]))

  const trips = (experiences ?? []).map(e => ({
    id:         e.id,
    title:      e.title,
    guide_name: e.guide_id != null ? (guideMap.get(e.guide_id) ?? null) : null,
  }))

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/inquiries" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Inquiries</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>New</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Manual entry</p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          New <span style={{ fontStyle: 'italic' }}>Inquiry</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          For leads from Instagram, WhatsApp, or any channel outside the website.
        </p>
      </div>

      <NewInquiryForm trips={trips} />

    </div>
  )
}
