import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidenav } from '@/components/admin/sidenav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen lg:flex" style={{ background: '#F3EDE4' }}>
      <AdminSidenav />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
