/**
 * Supabase browser client — singleton pattern.
 *
 * Use in Client Components ("use client") that need direct DB access.
 * For auth state + real-time subscriptions.
 *
 * Never import this in Server Components or Server Actions — use server.ts instead.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
