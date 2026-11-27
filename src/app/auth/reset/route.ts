/**
 * GET /auth/reset — where the password-reset email points.
 *
 * Dedicated callback for the password-reset flow. Unlike /auth/callback,
 * this route has no query params in its URL so it can be whitelisted in
 * Supabase → Authentication → URL Configuration without wildcard issues.
 *
 * We send emails with ?token_hash=...&type=recovery (using the hashed_token
 * from admin.generateLink) rather than the Supabase-hosted action_link.
 *
 * FA-M.15: a GET never verifies the token. It only forwards to the landing page
 * /auth/reset/confirm, whose "Set new password" button POSTs to the
 * confirmPasswordReset server action — the one place verifyOtp runs. Before, every
 * GET verified (and so used up) the one-time token: a refresh, a double request or a
 * link scanner left the user with "invalid or expired" (prod 2026-11-27).
 *
 * Falls back to PKCE code exchange in case an older-format link is clicked (unchanged).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // Primary path: token_hash from our custom email URL → landing page, nothing verified.
  if (tokenHash != null && tokenHash !== '' && type === 'recovery') {
    const landing = new URL('/auth/reset/confirm', origin)
    landing.searchParams.set('token_hash', tokenHash)
    landing.searchParams.set('type', 'recovery')
    return NextResponse.redirect(landing)
  }

  // Fallback: PKCE code exchange (e.g. if Supabase redirected via action_link)
  const code = searchParams.get('code')
  if (code != null) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error == null) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    console.error('[auth/reset] exchangeCodeForSession error:', error.message)
  }

  // Invalid or expired link → send to forgot-password with a clear message
  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
}
