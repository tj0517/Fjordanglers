import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login')
  }

  return (
    <div style={{ background: '#F3EDE4', minHeight: '100vh' }}>
      <main className="flex flex-col items-center w-full">{children}</main>
    </div>
  )
}
