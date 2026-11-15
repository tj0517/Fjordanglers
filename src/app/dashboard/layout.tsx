import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TermsGate } from '@/components/dashboard/terms-gate'
import { DashboardSidenav } from '@/components/dashboard/sidenav'
import { signOut } from '@/actions/auth'

/**
 * Dashboard layout — server component.
 *
 * Flow:
 *   1. Auth check — redirect to /login if unauthenticated.
 *   2. Admin accounts → redirect to /admin; non-guide accounts → /.
 *   3. A guide account must already be bound to a guides row — bound only by redeeming an
 *      invite link (FA-M.08). The layout never creates a row: an account with role 'guide'
 *      and no listing sees a notice instead of the dashboard.
 *   4. Render normal sidebar + page content.
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

  // ── Non-guide (angler) accounts don't belong here ────────────────────────
  if (profile?.role !== 'guide') {
    redirect('/')
  }

  // ── The guide's own listing ───────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, avatar_url, terms_accepted_at, photo_marketing_consent')
    .eq('user_id', user.id)
    .maybeSingle()

  if (guide == null) {
    return <NoListingNotice />
  }

  // ── Normal dashboard layout ───────────────────────────────────────────────
  return (
    <div className="min-h-screen lg:flex" style={{ background: '#F3EDE4' }}>
      <DashboardSidenav
        guideName={guide.full_name ?? ''}
        avatarUrl={guide.avatar_url ?? null}
      />
      <main className="flex-1 min-w-0">
        {children}
      </main>
      <TermsGate
        termsAccepted={guide.terms_accepted_at != null}
        initialMarketingConsent={guide.photo_marketing_consent ?? false}
      />
    </div>
  )
}

/** A guide account with no listing bound to it (e.g. a role set by hand, or a removed listing). */
function NoListingNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F3EDE4' }}>
      <div className="max-w-md text-center">
        <h1 className="f-display text-2xl font-bold" style={{ color: '#0A2E4D' }}>
          Your account isn&apos;t linked to a guide listing yet
        </h1>
        <p className="f-body text-sm mt-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
          FjordAnglers links guide accounts through a personal invite link. If you expected to see
          your assignments here, get in touch with us and we&apos;ll send you one.
        </p>
        <form action={signOut} className="mt-6">
          <button type="submit" className="f-body text-sm font-semibold underline" style={{ color: '#0A2E4D' }}>
            Log out
          </button>
        </form>
      </div>
    </div>
  )
}
