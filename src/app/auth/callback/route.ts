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
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const next        = requestUrl.searchParams.get('next') ?? '/dashboard'
  const origin      = requestUrl.origin

  if (code != null) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error == null) {
      // Session established — send the user to their destination
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // No code provided, or the exchange failed → back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
