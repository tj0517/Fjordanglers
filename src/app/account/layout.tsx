import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountSidebar from '@/components/account/sidebar'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login?next=/account/bookings')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Angler'

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <AccountSidebar displayName={displayName} />
      <main className="lg:ml-[240px] pt-14 lg:pt-0" style={{ minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
