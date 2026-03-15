import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileEditForm, { type ProfileDefaults } from '@/components/dashboard/profile-edit-form'

export const metadata = {
  title: 'Edit Profile — Guide Dashboard',
}

export default async function ProfileEditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/profile/edit')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, city, bio, fish_expertise, languages, years_experience, instagram_url, youtube_url, avatar_url, cover_url, landscape_url')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  const defaults: ProfileDefaults = {
    full_name:        guide.full_name,
    country:          guide.country,
    city:             guide.city,
    bio:              guide.bio,
    fish_expertise:   guide.fish_expertise,
    languages:        guide.languages,
    years_experience: guide.years_experience,
    instagram_url:    guide.instagram_url,
    youtube_url:      guide.youtube_url,
    avatar_url:       guide.avatar_url,
    cover_url:        guide.cover_url,
    landscape_url:    guide.landscape_url,
  }

  return (
    <div className="px-10 py-10 max-w-[840px]">

      {/* ─── Breadcrumb ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Dashboard
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/dashboard/profile" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Profile
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>Edit</span>
      </div>

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body font-semibold" style={{ color: '#E67E50' }}>
          Guide Profile
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Edit your <span style={{ fontStyle: 'italic' }}>profile</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '500px' }}>
          All changes are saved immediately and appear on your public guide page.
        </p>
      </div>

      <ProfileEditForm defaults={defaults} />

    </div>
  )
}
