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
 * On failure it redirects to /login with an error flag so the
 * LoginForm can surface a human-readable message.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const next        = requestUrl.searchParams.get('next') ?? '/account'
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

      // For email signups: role comes from user_metadata set during signUp().
      // For Google OAuth: default to 'angler' (guides sign up via invite flow).
      const metaRole = (data.user?.user_metadata?.role as string | undefined) ?? 'angler'

      if (userEmail != null && userId != null) {
        try {
          const service = createServiceClient()

          // ── Ensure profile row exists with correct role ─────────────────────
          // NOTE: do NOT use ignoreDuplicates: true here — the DB trigger may
          // auto-create the row with role='angler' before this runs, and we
          // must overwrite that with the user's chosen role (guide/angler).
          await service
            .from('profiles')
            .upsert(
              { id: userId, role: metaRole },
              { onConflict: 'id' },
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
      // Guides go straight to the dashboard (setup banners guide them from there).
      // All other roles use the `next` param (defaults to /account).
      const destination = metaRole === 'guide' ? '/dashboard' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // No code provided, or the exchange failed → back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
