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
  /**
   * Set when the guide registered via /invite/[guideId].
   * The guideId travels inside the confirmation email URL as ?claim=GUID
   * so no DB token storage is needed.
   */
  const claim       = requestUrl.searchParams.get('claim')

  if (code != null) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error == null) {
      const userEmail = data.user?.email
      const userId    = data.user?.id

      if (userId != null) {
        try {
          const service = createServiceClient()

          // ── Ensure profile row exists with correct role ─────────────────────
          // For email signups: role comes from user_metadata set during signUp().
          // For Google OAuth: default to 'angler' (guides sign up via invite flow).
          const metaRole = (data.user?.user_metadata?.role as string | undefined) ?? 'angler'
          await service
            .from('profiles')
            .upsert(
              { id: userId, role: metaRole },
              { onConflict: 'id', ignoreDuplicates: true },
            )

          // ── Priority 1: claim token (link-based, email-agnostic) ────────────
          // Guide registered via /invite/[guideId] — pin by guide ID directly.
          // More reliable than email matching: works with any email the guide uses.
          if (claim != null) {
            const { data: claimGuide } = await service
              .from('guides')
              .select('id')
              .eq('id', claim)
              .is('user_id', null)   // only claim if still unclaimed (race-condition guard)
              .maybeSingle()

            if (claimGuide != null) {
              await Promise.all([
                service
                  .from('guides')
                  .update({ user_id: userId, is_beta_listing: false })
                  .eq('id', claimGuide.id),
                service
                  .from('profiles')
                  .upsert({ id: userId, role: 'guide' }, { onConflict: 'id' }),
              ])
            }
          // ── Priority 2: invite_email fallback (email-based, legacy) ──────────
          // Kept for backward compat: guides who register without the invite link
          // but whose email was stored as guides.invite_email still get auto-linked.
          } else if (userEmail != null) {
            const { data: emailGuide } = await service
              .from('guides')
              .select('id')
              .eq('invite_email', userEmail)
              .is('user_id', null)
              .maybeSingle()

            if (emailGuide != null) {
              await Promise.all([
                service
                  .from('guides')
                  .update({ user_id: userId, is_beta_listing: false })
                  .eq('id', emailGuide.id),
                service
                  .from('profiles')
                  .upsert({ id: userId, role: 'guide' }, { onConflict: 'id' }),
              ])
            }
          }
        } catch (linkErr) {
          console.error('[auth/callback] auto-link error:', linkErr)
          // Non-fatal — session is still valid, admin can link manually
        }
      }

      // Session established — send the user to their destination
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // No code provided, or the exchange failed → back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
