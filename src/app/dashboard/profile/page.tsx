import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (user == null) {
    return (
      <div className="px-10 py-10 max-w-[800px]">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">My Profile</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          Please{' '}
          <Link href="/auth/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to view your profile.
        </p>
      </div>
    )
  }

  // ── Guide profile ───────────────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, bio, avatar_url, cover_url, city, country, fish_expertise')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-10 py-10 max-w-[800px]">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">My Profile</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          No guide profile found.{' '}
          <Link href="/guides/apply" className="text-[#E67E50] underline underline-offset-2">
            Apply to become a guide →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="px-10 py-10 max-w-[800px]">
      <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
        Guide Dashboard
      </p>
      <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-6">My Profile</h1>

      {/* Profile card */}
      <div
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Cover photo */}
        <div className="relative h-36">
          {guide.cover_url != null ? (
            <Image src={guide.cover_url} alt="Cover" fill className="object-cover" />
          ) : (
            <div style={{ background: 'linear-gradient(135deg, #0A1F35 0%, #1B4F72 100%)', height: '100%' }} />
          )}
        </div>

        {/* Avatar + info */}
        <div className="px-8 pb-8">
          <div className="relative z-10 flex items-end justify-between -mt-8 mb-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden"
              style={{ border: '3px solid #FDFAF7', boxShadow: '0 4px 12px rgba(10,46,77,0.12)' }}
            >
              {guide.avatar_url != null ? (
                <Image
                  src={guide.avatar_url}
                  alt={guide.full_name}
                  width={64}
                  height={64}
                  className="object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-xl f-body"
                  style={{ background: '#0A2E4D' }}
                >
                  {guide.full_name[0]}
                </div>
              )}
            </div>

            <Link
              href="/dashboard/profile/edit"
              className="text-xs font-semibold px-4 py-2 rounded-full f-body transition-all hover:brightness-105"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              Edit Profile →
            </Link>
          </div>

          {/* Name + location */}
          <h2 className="text-[#0A2E4D] text-xl font-bold f-display">{guide.full_name}</h2>
          <p className="text-[#0A2E4D]/45 text-sm f-body mb-4">
            {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
          </p>

          {/* Bio */}
          {guide.bio != null && guide.bio.length > 0 && (
            <p className="text-[#0A2E4D]/65 text-sm leading-relaxed f-body max-w-xl mb-6">
              {guide.bio}
            </p>
          )}

          {/* Fish expertise tags */}
          {guide.fish_expertise.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {guide.fish_expertise.map(fish => (
                <span
                  key={fish}
                  className="text-xs font-medium px-3 py-1.5 rounded-full f-body"
                  style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                >
                  {fish}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard/profile/edit"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          Edit full profile →
        </Link>
        <Link
          href={`/guides/${guide.id}`}
          target="_blank"
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          View public profile ↗
        </Link>
      </div>
    </div>
  )
}
