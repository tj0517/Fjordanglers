import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * /account — role-based redirect hub.
 * Guides   → /dashboard
 * Anglers  → /account/bookings
 * Unauthed → /login
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  if (profile?.role === 'guide') {
    redirect('/dashboard')
  }

  redirect('/account/bookings')
}
