import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardSidebar from '@/components/dashboard/sidebar'

/**
 * Dashboard layout — server component.
 *
 * Flow:
 *   1. Auth check — redirect to /login if unauthenticated.
 *   2. Admin accounts → redirect to /admin.
 *   3. If NO guides row → render content without sidebar (each page handles its own empty state).
 *   4. If guides row EXISTS → render normal sidebar + page content.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── No auth → send to login ───────────────────────────────────────────────
  if (user == null) {
    redirect('/login')
  }

  // ── Check profile role first (admin gets their own panel) ─────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  // ── Fetch guide profile ───────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, avatar_url, pricing_model, stripe_charges_enabled, stripe_payouts_enabled, status')
    .eq('user_id', user.id)
    .single()

  // ── No guide row yet — render page content directly (no sidebar) ──────────
  // Each page handles its own empty/pending state. This avoids aggressive
  // redirects that break navigation for newly registered or angler accounts.
  if (guide == null) {
    return (
      <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
        {children}
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
