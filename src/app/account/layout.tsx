import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountTopNav from '@/components/account/top-nav'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Angler'
  const email       = user.email ?? ''

  return (
    <div style={{ background: '#F3EDE4', minHeight: '100vh' }}>
      <AccountTopNav displayName={displayName} email={email} />
      <main className="flex flex-col items-center w-full">{children}</main>
    </div>
  )
}
