/**
 * Next.js Middleware — session refresh + route protection.
 *
 * Runs on every matched request (see config.matcher below).
 * Uses the Supabase SSR helper to keep JWTs fresh and protects
 * the /dashboard and /admin route groups from unauthenticated access.
 *
 * Flow:
 *  1. updateSession() validates the JWT with Supabase Auth servers
 *     and writes a refreshed token cookie if needed.
 *  2. Unauthenticated requests to /dashboard/* or /admin/* are redirected to /login?next=<path>
 *  3. Already-authenticated users visiting /login or /register are sent to /dashboard.
 *  4. Admins asking for /experiences/<slug>?preview=v2 are rewritten to the
 *     hidden /experiences/<slug>/preview route (FA-1.52) — convenience only,
 *     that route re-checks the session itself.
 *
 * Note: Admin role verification (profiles.role = 'admin') is done inside the
 *       /admin layout server component, not here — middleware only checks auth.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isAdminUser } from '@/lib/supabase/queries'

/** /experiences/<slug> — the public experience route, nothing deeper. */
const EXPERIENCE_PATH = /^\/experiences\/([^/]+)\/?$/

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 0. Guard — if Supabase env vars are missing, pass through silently ─────
  // Prevents middleware from crashing (404) on Vercel when env vars aren't set.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next()
  }

  // ── 1. Refresh the Supabase session JWT on every request ──────────────────
  // IMPORTANT: do not remove — this is what keeps server-side auth alive.
  const { supabaseResponse, user, supabase } = await updateSession(request)

  // ── 2. Protect /dashboard/* — unauthenticated → /login?next=<path> ────────
  if (pathname.startsWith('/dashboard') && user == null) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 3. Protect /admin/* — unauthenticated → /login?next=<path> ────────────
  // Role check (must be admin) is done inside the layout server component.
  if (pathname.startsWith('/admin') && user == null) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 4. Skip login/register if already authenticated ───────────────────────
  // Redirect to /dashboard — dashboard layout routes admins to /admin, non-guides to /.
  if (user != null && (pathname === '/login' || pathname === '/register')) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  // ── 5. Admin preview of the v2 experience template (FA-1.52) ──────────────
  // /experiences/<slug>?preview=v2 is rewritten to the hidden dynamic route
  // /experiences/<slug>/preview for admins. Everyone else — anonymous, angler,
  // guide — falls through untouched to the cached public page.
  // The rewrite is convenience, not authorization: the preview route checks the
  // session itself and 404s for non-admins.
  if (
    EXPERIENCE_PATH.test(pathname) &&
    request.nextUrl.searchParams.get('preview') === 'v2' &&
    user != null &&
    await isAdminUser(supabase, user.id)
  ) {
    const previewUrl = request.nextUrl.clone()
    previewUrl.pathname = `${pathname.replace(/\/$/, '')}/preview`
    const rewriteResponse = NextResponse.rewrite(previewUrl)

    // Carry over any refreshed auth cookies — without this the session written
    // by updateSession() above is lost on this request.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      rewriteResponse.cookies.set(cookie.name, cookie.value, cookie)
    }

    return rewriteResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run middleware on all paths EXCEPT:
     *   - Next.js internals  (_next/static, _next/image)
     *   - favicon.ico, sitemap.xml, robots.txt
     *   - Public assets      (*.png, *.jpg, *.svg, *.woff2, …)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
