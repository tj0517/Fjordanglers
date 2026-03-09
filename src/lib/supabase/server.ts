/**
 * Supabase server client — reads/writes cookies via next/headers.
 *
 * Use in:
 *   - Server Components
 *   - Server Actions
 *   - Route Handlers (GET/POST)
 *
 * Returns an anon-key client scoped to the current user's session.
 * For privileged operations (webhooks, admin) use createServiceClient() below.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — the session will be refreshed
            // by the middleware on the next request, so this is safe to ignore.
          }
        },
      },
    },
  )
}

/**
 * Service-role client — bypasses RLS entirely.
 *
 * Only use in:
 *   - Stripe webhook handler
 *   - Admin Server Actions
 *   - Scheduled jobs / cron routes
 *
 * NEVER expose this client to the browser.
 */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Intentionally silent — see createClient() above.
          }
        },
      },
    },
  )
}
