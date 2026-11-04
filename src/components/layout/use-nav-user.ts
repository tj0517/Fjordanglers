'use client'

/**
 * useNavUser — who is signed in, for the site nav (FA-1.80).
 *
 * The public pages are cached, so the server HTML is always the signed-out nav.
 * After hydration this hook asks the browser auth client whether a session exists
 * (a local read, no network for the common anonymous visitor) and, only if so,
 * fetches the caller's own profile from GET /api/nav-user.
 *
 * States: 'anonymous' (also what the server rendered) → 'pending' (session
 * exists, profile not back yet) → 'ready'. Display only: it grants nothing.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { NavUser } from '@/lib/supabase/queries'

export type NavUserState =
  | { status: 'anonymous' }
  | { status: 'pending' }
  | { status: 'ready'; user: NavUser }

export function useNavUser(): NavUserState {
  const [state, setState] = useState<NavUserState>({ status: 'anonymous' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { session } } = await createClient().auth.getSession()
      if (cancelled || session == null) return

      setState({ status: 'pending' })
      try {
        const res = await fetch('/api/nav-user', { cache: 'no-store', credentials: 'same-origin' })
        if (cancelled) return
        setState(res.ok
          ? { status: 'ready', user: (await res.json()) as NavUser }
          : { status: 'anonymous' })
      } catch {
        if (!cancelled) setState({ status: 'anonymous' })
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return state
}
