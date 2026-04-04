import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChangePasswordForm from './ChangePasswordForm'
import DeleteAccountCard from './DeleteAccountCard'

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Angler'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[600px]">
      <div className="mb-8">
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Account <span style={{ fontStyle: 'italic' }}>Settings</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Manage your password and account.
        </p>
      </div>

      {/* Account info */}
      <div
        className="px-6 py-5 mb-6 flex items-center gap-4"
        style={{
          background:   '#FDFAF7',
          borderRadius: '20px',
          border:       '1px solid rgba(10,46,77,0.07)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0 f-body"
          style={{ background: '#0A2E4D', border: '2px solid rgba(230,126,80,0.25)' }}
        >
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-[#0A2E4D] text-sm font-semibold f-body">{displayName}</p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>{user.email}</p>
        </div>
      </div>

      {/* Change password */}
      <ChangePasswordForm />

      {/* Delete account */}
      <DeleteAccountCard />
    </div>
  )
}
