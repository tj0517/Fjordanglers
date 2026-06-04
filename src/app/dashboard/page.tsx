import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'
import { CalendarDays, User, ExternalLink, LogOut } from 'lucide-react'

export const revalidate = 0

export const metadata = { title: 'Dashboard — FjordAnglers' }

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, status')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/login')

  const firstName = guide.full_name?.split(' ')[0] ?? 'there'

  // Fetch guide's published experience pages
  const { data: expPages } = await supabase
    .from('experience_pages')
    .select('id, slug, experience_name')
    .eq('guide_id', guide.id)
    .eq('status', 'active')
    .limit(5)

  const statusLabel: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending review', bg: 'rgba(217,119,6,0.1)',  color: '#B45309' },
    active:    { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    verified:  { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    suspended: { label: 'Suspended',      bg: 'rgba(239,68,68,0.1)',  color: '#DC2626' },
  }
  const statusStyle = statusLabel[guide.status] ?? statusLabel['pending']!

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-lg">

      {/* Header */}
      <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Guide Dashboard
          </p>
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            {greet()}, <span style={{ fontStyle: 'italic' }}>{firstName}.</span>
          </h1>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full f-body mt-1"
          style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </div>

      {/* Action cards */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/calendar"
          className="flex items-center gap-5 px-6 py-5 rounded-2xl transition-all hover:scale-[1.01]"
          style={{ background: '#0A2E4D', textDecoration: 'none' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <CalendarDays size={20} strokeWidth={1.5} style={{ color: '#fff' }} />
          </div>
          <div>
            <p className="text-base font-bold f-body" style={{ color: '#fff' }}>Calendar</p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Manage your availability</p>
          </div>
        </Link>

        <Link
          href="/dashboard/profile/edit"
          className="flex items-center gap-5 px-6 py-5 rounded-2xl transition-all hover:scale-[1.01]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)', textDecoration: 'none' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(10,46,77,0.06)' }}>
            <User size={20} strokeWidth={1.5} style={{ color: '#0A2E4D' }} />
          </div>
          <div>
            <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>Edit profile</p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Update your info, bio & photos</p>
          </div>
        </Link>

        {/* My experience(s) */}
        {(expPages ?? []).length > 0 && (expPages ?? []).map(exp => (
          <Link
            key={exp.id}
            href={`/experiences/${exp.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-5 px-6 py-5 rounded-2xl transition-all hover:scale-[1.01]"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)', textDecoration: 'none' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(230,126,80,0.08)' }}>
              <ExternalLink size={20} strokeWidth={1.5} style={{ color: '#E67E50' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold f-body truncate" style={{ color: '#0A2E4D' }}>{exp.experience_name}</p>
              <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>View live page →</p>
            </div>
          </Link>
        ))}

        {/* Logout */}
        <form action={signOut} className="mt-2">
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

    </div>
  )
}
