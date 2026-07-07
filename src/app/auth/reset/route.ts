/**
 * GET /auth/reset — password reset token verification.
 *
 * Dedicated callback for the password-reset flow. Unlike /auth/callback,
 * this route has no query params in its URL so it can be whitelisted in
 * Supabase → Authentication → URL Configuration without wildcard issues.
 *
 * We send emails with ?token_hash=...&type=recovery (using the hashed_token
 * from admin.generateLink) rather than the Supabase-hosted action_link.
 * verifyOtp({ token_hash }) works without a PKCE code_verifier, fixing the
 * incompatibility between admin.generateLink() and @supabase/ssr.
 *
 * Falls back to PKCE code exchange in case an older-format link is clicked.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // Primary path: token_hash from our custom email URL
  if (tokenHash != null && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (error == null) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    console.error('[auth/reset] verifyOtp error:', error.message)
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
