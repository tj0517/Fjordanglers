import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardSidebar from '@/components/dashboard/sidebar'
import GuideOnboarding from '@/components/dashboard/guide-onboarding'

/**
 * Dashboard layout — server component.
 *
 * Flow:
 *   1. Auth check — middleware already guards /dashboard/*, so user is always present here.
 *   2. Check for guides row linked to this user.
 *   3. If NO guides row → render GuideOnboarding wizard (no sidebar).
 *      The wizard calls createGuideProfile() then router.refresh(),
 *      which causes this layout to re-fetch and show the normal dashboard.
 *   4. If guides row EXISTS → render normal sidebar + page content.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── No auth (shouldn't reach here — middleware redirects) ─────────────────
  if (user == null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3EDE4' }}>
        <p className="text-[#0A2E4D]/45 text-sm f-body">Please sign in to access your dashboard.</p>
      </div>
    )
  }

  // ── Fetch guide profile ───────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, avatar_url, pricing_model, stripe_charges_enabled, stripe_payouts_enabled, status')
    .eq('user_id', user.id)
    .single()

  // ── No guide profile yet ──────────────────────────────────────────────────
  if (guide == null) {
    // Admins don't have a guides row — send them to their panel
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      redirect('/admin')
    }

    // Regular user → show onboarding wizard
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? ''
    return (
      <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
        <GuideOnboarding defaultFullName={fullName} />
      </div>
    )
  }

  // ── Normal dashboard layout ───────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <DashboardSidebar guide={guide} />
      {/* pt-14 = mobile top bar height; lg:pt-0 removes it on desktop */}
      <main className="lg:ml-[240px] pt-14 lg:pt-0" style={{ minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
