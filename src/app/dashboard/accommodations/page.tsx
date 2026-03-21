import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccommodationsManager from './AccommodationsManager'
import type { Database } from '@/lib/supabase/database.types'

export const metadata = { title: 'Accommodations — Guide Dashboard' }

export type GuideAccommodationRow = Database['public']['Tables']['guide_accommodations']['Row']

export default async function DashboardAccommodationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login?next=/dashboard/accommodations')

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/guides/apply')

  const { data: accommodations } = await supabase
    .from('guide_accommodations')
    .select('*')
    .eq('guide_id', guide.id)
    .order('name')

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[840px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body font-semibold" style={{ color: '#E67E50' }}>
          Manage
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Accommodations
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '520px' }}>
          Save your cabins, lodges, and hotels here. You can then link them to specific trips in the experience editor.
        </p>
      </div>

      <AccommodationsManager
        guideId={guide.id}
        initialAccommodations={accommodations ?? []}
      />
    </div>
  )
}
