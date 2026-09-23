import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { KnowledgeForm } from '@/components/admin/knowledge-form'
import type { KnowledgePayload } from '@/actions/knowledge'

export default async function EditKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: entry }, { data: guides }] = await Promise.all([
    supabase
      .from('agent_knowledge')
      .select('id, kind, country, guide_id, title, body, active')
      .eq('id', id)
      .single(),
    supabase
      .from('guides')
      .select('id, full_name')
      .order('full_name'),
  ])

  if (entry == null) notFound()

  const initialValues: Partial<KnowledgePayload> = {
    kind:     entry.kind as KnowledgePayload['kind'],
    country:  entry.country as KnowledgePayload['country'],
    guide_id: entry.guide_id,
    title:    entry.title,
    body:     entry.body,
    active:   entry.active,
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/knowledge" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Agent Knowledge</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>Edit</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-2">Edit knowledge entry</h1>
      <p className="text-sm f-body mb-8" style={{ color: 'rgba(10,46,77,0.5)' }}>{entry.title}</p>

      <KnowledgeForm
        mode="edit"
        entryId={entry.id}
        initialValues={initialValues}
        guides={guides ?? []}
      />
    </div>
  )
}
