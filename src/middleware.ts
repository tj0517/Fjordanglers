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
 *
 * Note: Admin role verification (profiles.role = 'admin') is done inside the
 *       /admin layout server component, not here — middleware only checks auth.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
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
  const { supabaseResponse, user } = await updateSession(request)

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
  if (user != null && (pathname === '/login' || pathname === '/register')) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
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
