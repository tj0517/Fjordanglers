/**
 * GET /auth/reset — password reset code exchange.
 *
 * Dedicated callback for the password-reset flow. Unlike /auth/callback,
 * this route has no query params in its URL so it can be whitelisted in
 * Supabase → Authentication → URL Configuration without wildcard issues.
 *
 * Supabase redirects here after the user clicks the email reset link.
 * We exchange the PKCE code for a session, then send the user straight
 * to /reset-password where they can set their new password.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
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
