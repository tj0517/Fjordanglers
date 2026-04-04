import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import DashboardSidebar from '@/components/dashboard/sidebar'
import { TermsGate } from '@/components/dashboard/terms-gate'

/**
 * Dashboard layout — server component.
 *
 * Flow:
 *   1. Auth check — redirect to /login if unauthenticated.
 *   2. Admin accounts → redirect to /admin.
 *   3. If NO guides row yet → auto-create a minimal row (first dashboard visit after
 *      registration).  This replaces the old blocking GuideOnboarding wizard: guides
 *      now land directly in the dashboard and complete their profile via in-page banners.
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
    redirect('/account/bookings')
  }

  // ── Fetch guide profile ───────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, avatar_url, pricing_model, stripe_account_id, stripe_payouts_enabled, status, terms_accepted_at, photo_marketing_consent, iban')
    .eq('user_id', user.id)
    .single()

  // ── Auto-create minimal guide row on first dashboard visit ─────────────────
  // Fires once per guide's lifetime.  Service client bypasses RLS for the insert.
  // The guide then completes their profile from the dashboard home page banners.
  let resolvedGuide = guide

  if (resolvedGuide == null) {
    const service = createServiceClient()
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? ''

    const { data: created, error: insertErr } = await service
      .from('guides')
      .insert({
        user_id:                user.id,
        full_name:              fullName,
        country:                '',   // placeholder — filled via profile edit
        pricing_model:          'commission',
        status:                 'pending',
        is_beta_listing:        false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        total_reviews:          0,
      })
      .select('id, full_name, avatar_url, pricing_model, stripe_account_id, stripe_payouts_enabled, status, terms_accepted_at, photo_marketing_consent, iban')
      .single()

    if (insertErr != null) {
      // Race condition — row was created between our SELECT and INSERT; re-fetch it.
      console.warn('[layout] guide auto-create failed, re-fetching:', insertErr.message)
      const { data: refetched } = await service
        .from('guides')
        .select('id, full_name, avatar_url, pricing_model, stripe_account_id, stripe_payouts_enabled, status, terms_accepted_at, photo_marketing_consent, iban')
        .eq('user_id', user.id)
        .single()
      resolvedGuide = refetched
    } else {
      resolvedGuide = created
    }
  }

  // Extremely unlikely (creation + re-fetch both failed) — render without sidebar
  if (resolvedGuide == null) {
    return (
      <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
        {children}
      </div>
    )
  }

  // ── Normal dashboard layout ───────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <DashboardSidebar guide={resolvedGuide} />
      {/* pt-14 = mobile top bar height; lg:pt-0 removes it on desktop */}
      <main className="lg:ml-[240px] pt-14 lg:pt-0" style={{ minHeight: '100vh' }}>
        {children}
      </main>
      <TermsGate
        termsAccepted={resolvedGuide.terms_accepted_at != null}
        initialMarketingConsent={resolvedGuide.photo_marketing_consent ?? false}
      />
    </div>
  )
}
