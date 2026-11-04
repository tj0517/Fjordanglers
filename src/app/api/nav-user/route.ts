/**
 * GET /api/nav-user — the caller's own nav profile (FA-1.80).
 *
 * The public pages are cached and render the nav as a signed-out shell; a small
 * client island calls this to learn who is signed in. The answer is per-user, so
 * it must never be cached by the browser, Vercel's CDN or any proxy
 * (`private, no-store`) — a cached response would show one user's profile to
 * another. The profile is looked up by the id from the verified session, never by
 * anything in the request URL.
 *
 * 401 + empty body when there is no session. Display only: protected pages keep
 * their own server-side checks.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNavUser } from '@/lib/supabase/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    return new NextResponse(null, { status: 401, headers: NO_STORE })
  }

  const navUser = await getNavUser(supabase, user.id)
  if (navUser == null) {
    return new NextResponse(null, { status: 401, headers: NO_STORE })
  }

  return NextResponse.json(navUser, { headers: NO_STORE })
}
