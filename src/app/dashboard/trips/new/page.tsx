import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GuideSubmissionForm from '@/components/guide/GuideSubmissionForm'

/**
 * /dashboard/trips/new — Guide submits their trip info for FA to build.
 *
 * New flow: guide provides raw info (location, species, season, pricing, includes,
 * personal note). FA reviews and builds a polished experience page.
 * No more complex self-serve form.
 */

export const metadata = {
  title: 'Submit Trip Info — Guide Dashboard',
}

export default async function DashboardNewExperiencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/trips/new')

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/guides/apply')

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Dashboard</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/dashboard/trips" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Trips</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>Submit Info</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body font-semibold" style={{ color: '#E67E50' }}>
          New trip
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Tell us about your <span style={{ fontStyle: 'italic' }}>fishing spot</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '560px' }}>
          Fill in the details below and FjordAnglers will build your experience page.
          We aim to deliver a polished, professional listing within{' '}
          <strong className="font-semibold" style={{ color: 'rgba(10,46,77,0.65)' }}>3–5 business days</strong>.
        </p>

        {/* How it works */}
        <div
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          {[
            { icon: '✍️', title: 'You fill the form', desc: 'Location, species, season, price' },
            { icon: '🎨', title: 'We build the page', desc: 'Professional copy, design & SEO' },
            { icon: '🚀', title: 'Goes live', desc: 'You review & approve before publish' },
          ].map(step => (
            <div
              key={step.title}
              className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
            >
              <span className="text-xl flex-shrink-0">{step.icon}</span>
              <div>
                <p className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{step.title}</p>
                <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <GuideSubmissionForm />
    </div>
  )
}
