/**
 * NavWithUser — server component wrapper for SiteNav.
 *
 * Fetches the current user and profile, then passes NavUser to SiteNav.
 * Use this anywhere SiteNav needs to be rendered outside the (public) layout.
 */

import { createClient } from '@/lib/supabase/server'
import { SiteNav } from './nav'
import type { NavUser } from './nav'

export async function NavWithUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let navUser: NavUser | null = null

  if (user != null) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    if (profile != null) {
      navUser = {
        name: profile.full_name,
        role: profile.role as NavUser['role'],
        avatarUrl: profile.avatar_url,
      }
    }
  }

  return <SiteNav user={navUser} />
}
