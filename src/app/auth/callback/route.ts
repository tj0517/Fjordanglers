/**
 * GET /auth/callback — Supabase PKCE auth code exchange.
 *
 * Today only Google sign-in reaches this route (GoogleAuthButton). It exchanges the one-time
 * `code` for a session, makes sure the account has a profile row, and redirects to `next`.
 *
 * `next` passes only as a relative path from the allowlist in `src/lib/auth/safe-next.ts`;
 * anything else lands on `/dashboard` (FA-M.08, tj decision D5 condition 2).
 *
 * Nothing here binds an account to a guide listing: the old autolink on
 * `guides.invite_email` is gone (FA-M.08). Listings are bound only by redeeming an invite
 * link (`src/actions/guide-invites.ts`).
 *
 * On failure it redirects to /login with an error flag so AuthTabs can surface a message.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth/safe-next'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const next        = safeNextPath(requestUrl.searchParams.get('next'))
  const origin      = requestUrl.origin

  if (code != null) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error == null) {
      const userId = data.user?.id

      if (userId != null) {
        try {
          // ── Ensure the profile row exists — and nothing more ────────────────
          // The role is never taken from user_metadata: users can edit their own
          // metadata, so it is not evidence of anything (FA-1.93). The DB trigger
          // normally creates this row as 'angler'; this only covers an account that
          // has none, and ignoreDuplicates keeps it from touching an existing row,
          // so it can neither promote nor demote anyone.
          await createServiceClient()
            .from('profiles')
            .upsert(
              { id: userId, role: 'angler' },
              { onConflict: 'id', ignoreDuplicates: true },
            )
        } catch (profileErr) {
          console.error('[auth/callback] profile upsert error:', profileErr)
        }
      }

      // `/dashboard` routes by role itself (admins → /admin, non-guides → /).
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // No code provided, or the exchange failed → back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
