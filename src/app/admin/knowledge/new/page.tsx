import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { KnowledgeForm } from '@/components/admin/knowledge-form'
import type { KnowledgePayload } from '@/actions/knowledge'
import { COUNTRIES } from '@/lib/countries'

export default async function NewKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; country?: string; guide_id?: string }>
}) {
  const { kind, country, guide_id } = await searchParams
  const supabase = createServiceClient()

  const { data: guides } = await supabase
    .from('guides')
    .select('id, full_name')
    .order('full_name')

  const validKinds = ['instructions', 'tone', 'destination', 'guide'] as const
  type ValidKind = typeof validKinds[number]

  const initialKind: ValidKind = validKinds.includes(kind as ValidKind)
    ? (kind as ValidKind)
    : 'destination'

  const initialCountry = COUNTRIES.includes(country as typeof COUNTRIES[number])
    ? (country as typeof COUNTRIES[number])
    : undefined

  const initialValues: Partial<KnowledgePayload> = {
    kind:     initialKind,
    country:  initialCountry ?? null,
    guide_id: guide_id ?? null,
    active:   true,
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/knowledge" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Agent Knowledge</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>New entry</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-8">New knowledge entry</h1>

      <KnowledgeForm
        mode="create"
        initialValues={initialValues}
        guides={guides ?? []}
      />
    </div>
  )
}
