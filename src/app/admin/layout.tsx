import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/sidebar'

/**
 * Admin layout — server component.
 *
 * Guards the entire /admin/* route group:
 *  1. User must be authenticated (middleware already checks this, but double-check here)
 *  2. User must have profiles.role = 'admin'
 *
 * Non-admins are redirected to / (not /dashboard — they might not be guides either).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Should not happen (middleware handles this), but guard anyway
  if (user == null) {
    redirect('/login?next=/admin')
  }

  // Check admin role in profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  const adminName = profile.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  // Badge count for sidebar — new leads awaiting action
  const { count: newLeadsCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <AdminSidebar adminName={adminName} newLeadsCount={newLeadsCount ?? 0} />
      <main style={{ marginLeft: '240px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
