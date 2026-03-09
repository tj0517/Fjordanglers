/**
 * Supabase session refresh helper for Next.js middleware.
 *
 * Call updateSession() inside middleware.ts on every request so the
 * server-side session token stays fresh (Supabase uses short-lived JWTs).
 * Returns both the updated response and the current user (null if unauthenticated).
 */

import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from './database.types'

export async function updateSession(request: NextRequest) {
  // Start with a pass-through response; will be mutated if cookies need updating
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Mirror cookies into both the request and the response so the
          // session is visible to downstream Server Components
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getUser() must be called to refresh the session.
  // Do NOT remove this line — it validates the JWT with Supabase Auth servers.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
