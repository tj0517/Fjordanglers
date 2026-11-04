/**
 * GET /auth/callback — Supabase PKCE auth code exchange.
 *
 * Supabase redirects here after:
 *   - Email confirmation links  (signup flow)
 *   - Password reset links      (forgot-password flow)
 *   - Magic link sign-ins       (future)
 *   - OAuth provider logins     (future)
 *
 * It exchanges the one-time `code` query param for a proper session,
 * writes the session cookies, then redirects to /dashboard
 * (or the `next` param if the middleware passed one along).
 *
 * On failure it redirects to /login with an error flag so AuthTabs
 * can surface a human-readable message.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileRole } from '@/lib/supabase/queries'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const explicitNext = requestUrl.searchParams.get('next')
  const next        = explicitNext ?? '/dashboard'
  const origin      = requestUrl.origin

  if (code != null) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error == null) {
      // ── Auto-link beta guide listing if invite_email matches ─────────────
      // When a guide registers with the email stored in guides.invite_email,
      // we immediately pin their auth account to the listing and grant dashboard access.
      // Non-fatal: on any error the session is still valid, admin can link manually.
      const userEmail = data.user?.email
      const userId    = data.user?.id

      if (userEmail != null && userId != null) {
        try {
          const service = createServiceClient()

          // ── Ensure the profile row exists — and nothing more ────────────────
          // The role is never taken from user_metadata: users can edit their own
          // metadata, so it is not evidence of anything (FA-1.93). The DB trigger
          // normally creates this row as 'angler'; this only covers an account that
          // has none, and ignoreDuplicates keeps it from touching an existing row,
          // so it can neither promote nor demote anyone.
          await service
            .from('profiles')
            .upsert(
              { id: userId, role: 'angler' },
              { onConflict: 'id', ignoreDuplicates: true },
            )

          // ── Auto-link guide listing if invite_email matches ─────────────────
          const { data: guide } = await service
            .from('guides')
            .select('id')
            .eq('invite_email', userEmail)
            .is('user_id', null)
            .maybeSingle()

          if (guide != null) {
            await Promise.all([
              service
                .from('guides')
                .update({ user_id: userId, is_beta_listing: false })
                .eq('id', guide.id),
              service
                .from('profiles')
                .upsert({ id: userId, role: 'guide' }, { onConflict: 'id' }),
            ])
          }
        } catch (linkErr) {
          console.error('[auth/callback] auto-link error:', linkErr)
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Session established — send to role-appropriate destination.
      // Guides go straight to the dashboard ONLY when no explicit `next` was set
      // (e.g. password reset passes next=/reset-password and must not be overridden).
      // The role is the one stored in profiles (read after the writes above, so a guide
      // that was just auto-linked is seen as a guide).
      const role = userId != null ? await getProfileRole(supabase, userId) : null
      const destination = (explicitNext == null && role === 'guide') ? '/dashboard' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // No code provided, or the exchange failed → back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
