import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExperienceForm from '@/components/trips/experience-form'

/**
 * /dashboard/trips/new — Guide creates their own experience.
 *
 * Server component: fetches guide ID from auth, then mounts ExperienceForm.
 * Redirects to login if not authenticated, to /guides/apply if no guide profile.
 */

export const metadata = {
  title: 'New Trip — Guide Dashboard',
}

export default async function DashboardNewExperiencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/trips/new')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/guides/apply')

  const { data: guideAccommodations } = await supabase
    .from('guide_accommodations')
    .select('id, name, type, description, max_guests, location_note')
    .eq('guide_id', guide.id)
    .order('name')

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Dashboard</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/dashboard/trips" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Trips</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>New</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body font-semibold" style={{ color: '#E67E50' }}>
          Create Trip
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Add a new <span style={{ fontStyle: 'italic' }}>fishing trip</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '520px' }}>
          Describe your trip, set your price, add photos. You can save as a draft
          and publish later when you&apos;re ready.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          {[
            { icon: '💶', text: 'You set the price' },
            { icon: '📅', text: 'Publish anytime' },
            { icon: '⚡', text: 'Live immediately on /trips' },
          ].map(pill => (
            <span
              key={pill.text}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              <span>{pill.icon}</span>
              {pill.text}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <ExperienceForm
        guideId={guide.id}
        mode="create"
        guideName={guide.full_name}
        context="guide"
        successPath="/dashboard/trips"
        guideAccommodations={guideAccommodations ?? []}
      />
    </div>
  )
}
