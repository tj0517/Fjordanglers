import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PasswordResetButton } from './AccountActions'
import { MarketingConsentToggle } from './MarketingConsentToggle'
import { HelpWidget } from '@/components/ui/help-widget'
import { Lock, LogOut } from 'lucide-react'
import { signOut } from '@/actions/auth'

export const revalidate = 0

export const metadata = { title: 'Account — FjordAnglers Dashboard' }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, status, photo_marketing_consent')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  const email       = user.email ?? '—'
  const provider    = user.app_metadata?.provider ?? 'email'
  const isGoogle    = provider === 'google'
  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Account
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Login credentials and preferences
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Sign-in ──────────────────────────────────────────────────────── */}
        <Card title="Sign-in" help={
          <HelpWidget title="Sign-in" items={[
            { icon: '📧', title: 'Email', text: 'Your login email — contact support if you need to change it.' },
            { icon: '🔒', title: 'Password', text: 'Click "Reset password" to get a reset link sent to your email. For Google sign-in, manage your password via Google.' },
          ]} />
        }>
          <Row label="Email">
            <span className="text-sm f-body font-medium" style={{ color: '#0A2E4D' }}>{email}</span>
          </Row>
          <Row label="Sign-in method">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold f-body px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              {isGoogle ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                    <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/>
                    <path d="M4.5 10.48A4.8 4.8 0 014.5 7.5V5.43H1.83a8 8 0 000 7.12l2.67-2.07z" fill="#FBBC05"/>
                    <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35L14.6 2.75A8 8 0 001.83 5.43L4.5 7.5c.66-1.97 2.48-3.92 4.48-3.92z" fill="#EA4335"/>
                  </svg>
                  Google
                </>
              ) : (
                <>
                  <Lock size={10} strokeWidth={1.5} />
                  Email & password
                </>
              )}
            </span>
          </Row>
          <Row label="Member since">
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{memberSince}</span>
          </Row>
          {!isGoogle && (
            <Row label="Password">
              <PasswordResetButton email={email} />
            </Row>
          )}
        </Card>

        {/* ── Photo & marketing consent ─────────────────────────────────────── */}
        <Card title="Photo & marketing consent" help={
          <HelpWidget title="Photo & marketing consent" items={[
            { icon: '📸', title: 'What this covers', text: 'Photos and videos from your trips (shared by you or your anglers) used on the FjordAnglers website, Instagram, and ads.' },
            { icon: '✍️', title: 'Credit', text: 'Your name is always credited as the guide when FjordAnglers uses your content.' },
            { icon: '🔄', title: 'Can be changed', text: 'You can turn this on or off at any time from this settings page.' },
          ]} />
        }>
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Allow FjordAnglers to use your photos for platform promotion (website, Instagram, ads).
              Your name will always be credited as the owner.
            </p>
          </div>
          <MarketingConsentToggle current={guide.photo_marketing_consent ?? false} />
        </Card>

      </div>

      {/* Logout */}
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="flex items-center gap-2 text-sm f-body font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ color: 'rgba(10,46,77,0.4)', background: 'transparent' }}
        >
          <LogOut size={14} strokeWidth={1.6} />
          Log out
        </button>
      </form>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, help, children }: { title: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <div
        className="px-6 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          {title}
        </p>
        {help}
      </div>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-6 px-6 py-4"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
    >
      <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}>
        {label}
      </span>
      <div className="flex items-center gap-3 justify-end">
        {children}
      </div>
    </div>
  )
}
