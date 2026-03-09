import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getExperience, getMoreFromGuide } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { ExperienceGallery } from '@/components/experiences/experience-gallery'
import { SpeciesCard } from '@/components/experiences/species-card'
import type { SpeciesInfo, FishVariant } from '@/components/experiences/species-card'
import type { ExperienceWithGuide } from '@/types'
import { HomeNav } from '@/components/home/home-nav'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const COUNTRY_FLAGS: Record<string, string> = {
  Norway: '🇳🇴', Sweden: '🇸🇪', Finland: '🇫🇮',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}

// satisfies ensures every entry conforms to SpeciesInfo (with correct variant literal)
const v = (x: FishVariant) => x

const FISH_INFO: Record<string, SpeciesInfo> = {
  'Salmon': {
    variant: v('salmon'),
    tagline: 'The King of the River',
    desc: 'Powerful, acrobatic fighters that run from the sea into Nordic rivers each summer. Fresh-run fish are chrome-bright and explosive on the take.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(230,126,80,0.14) 0%, rgba(230,126,80,0.06) 100%)',
    accent: '#E67E50',
    photo: '/fish_catalog/salmon.jpg',
  },
  'Sea Trout': {
    variant: v('salmon'),
    tagline: 'The Silver Ghost',
    desc: 'Sea-run brown trout that return to estuaries and rivers — notoriously wary, nocturnally active, and one of fly fishing\'s greatest challenges.',
    trophy: 'up to 10 kg',
    bg: 'linear-gradient(135deg, rgba(100,160,200,0.14) 0%, rgba(100,160,200,0.06) 100%)',
    accent: '#4A9FC0',
    photo: '/fish_catalog/trout.jpg',
  },
  'Brown Trout': {
    variant: v('salmon'),
    tagline: 'The Wild Trout',
    desc: 'Beautifully spotted residents of cold mountain streams. Selective dry-fly feeders that reward precise presentation and careful wading.',
    trophy: 'up to 8 kg',
    bg: 'linear-gradient(135deg, rgba(160,100,50,0.14) 0%, rgba(160,100,50,0.06) 100%)',
    accent: '#A06432',
    photo: '/fish_catalog/trout.jpg',
  },
  'Grayling': {
    variant: v('perch'),
    tagline: 'Lady of the Stream',
    desc: 'Fast-water fish with a striking sail-like dorsal fin. Found in the clearest, coldest Scandinavian rivers — a perfect dry-fly quarry.',
    trophy: 'up to 3 kg',
    bg: 'linear-gradient(135deg, rgba(130,100,200,0.14) 0%, rgba(130,100,200,0.06) 100%)',
    accent: '#8264C8',
    photo: '/fish_catalog/graling.jpeg',
  },
  'Pike': {
    variant: v('pike'),
    tagline: 'The Apex Predator',
    desc: 'Ambush hunters lurking in weed beds and lily pads. Explosive strikers that hit big lures hard — Northern Europe\'s most exciting lure target.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(60,130,80,0.14) 0%, rgba(60,130,80,0.06) 100%)',
    accent: '#3C8250',
    photo: '/fish_catalog/pike.jpg',
  },
  'Perch': {
    variant: v('perch'),
    tagline: 'The Bold Striker',
    desc: 'Boldly striped schooling predators found throughout Scandinavian lakes. Aggressive biters on small lures — superb on light tackle.',
    trophy: 'up to 3 kg',
    bg: 'linear-gradient(135deg, rgba(80,150,60,0.14) 0%, rgba(80,150,60,0.06) 100%)',
    accent: '#509640',
    photo: '/fish_catalog/perch.jpg',
  },
  'Zander': {
    variant: v('pike'),
    tagline: 'The Shadow Predator',
    desc: 'Elusive deep-water hunters with glassy eyes adapted for low light. Prized for their delicious white flesh and challenging, finesse-focused fishing.',
    trophy: 'up to 12 kg',
    bg: 'linear-gradient(135deg, rgba(60,80,120,0.14) 0%, rgba(60,80,120,0.06) 100%)',
    accent: '#3C5078',
    photo: '/fish_catalog/zander.jpg',
  },
  'Arctic Char': {
    variant: v('salmon'),
    tagline: 'The Glacial Relic',
    desc: 'A living relic of the Ice Age, found only in the coldest Nordic lakes. Rarely targeted and breathtakingly beautiful — a true bucket-list catch.',
    trophy: 'up to 6 kg',
    bg: 'linear-gradient(135deg, rgba(80,180,220,0.14) 0%, rgba(80,180,220,0.06) 100%)',
    accent: '#50B4DC',
    photo: '/fish_catalog/arctic-char.jpg',
  },
  'Cod': {
    variant: v('pike'),
    tagline: 'The Ocean Giant',
    desc: 'A staple of Nordic coastal fishing, cod are powerful bottom-dwellers found in the cold fjords of Norway. Heavy fighters on light sea gear.',
    trophy: 'up to 40 kg',
    bg: 'linear-gradient(135deg, rgba(100,130,100,0.14) 0%, rgba(100,130,100,0.06) 100%)',
    accent: '#6A8C5A',
    photo: '/fish_catalog/cod.jpg',
  },
  'Trout': {
    variant: v('salmon'),
    tagline: 'The Wild Trout',
    desc: 'Beautifully spotted residents of cold Nordic streams and lakes. Selective feeders that reward precise presentation and careful wading.',
    trophy: 'up to 10 kg',
    bg: 'linear-gradient(135deg, rgba(160,100,50,0.14) 0%, rgba(160,100,50,0.06) 100%)',
    accent: '#A06432',
    photo: '/fish_catalog/trout.jpg',
  },
}

// ─── MICRO-COMPONENTS ─────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div
    aria-hidden="true"
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: GRAIN_BG,
      backgroundSize: '200px 200px',
      opacity: 0.06,
      mixBlendMode: 'screen',
      zIndex: 2,
    }}
  />
)

const SalmonRule = () => (
  <div className="w-10 h-px" style={{ background: '#E67E50' }} />
)

// ─── METADATA ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exp = await getExperience(id)
  if (!exp) return {}
  return {
    title: exp.title,
    description: exp.description,
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── Fetch with auth client (no published filter) ─────────────────────────
  // The auth client respects RLS:
  //   • published + guide.status=active → visible to everyone (anon included)
  //   • draft → visible only to the guide who owns it (via "Guide reads own experiences" policy)
  //   • admins → can preview via /admin; for public page we show their own drafts too
  //
  // This means guides can visit /experiences/[id] to preview their draft BEFORE publishing.
  // Anon visitors hitting a draft URL still get 404 (RLS returns null).
  const supabase = await createClient()

  const { data: rawExp } = await supabase
    .from('experiences')
    .select('*, guide:guides(id, full_name, avatar_url, country, city, average_rating), images:experience_images(id, experience_id, url, is_cover, sort_order, created_at)')
    .eq('id', id)
    .single()

  if (rawExp == null) notFound()

  const exp: ExperienceWithGuide = {
    ...(rawExp as unknown as ExperienceWithGuide),
    images: [...(rawExp.images ?? []) as ExperienceWithGuide['images']]
      .sort((a, b) => a.sort_order - b.sort_order),
  }

  const isDraft = !exp.published

  const moreFromGuide = await getMoreFromGuide(exp.guide_id, exp.id, 3)

  const coverUrl = exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null
  const flag = exp.location_country != null ? (COUNTRY_FLAGS[exp.location_country] ?? '') : ''
  const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
  const duration =
    exp.duration_hours != null
      ? `${exp.duration_hours} hours`
      : exp.duration_days != null
      ? `${exp.duration_days} ${exp.duration_days === 1 ? 'day' : 'days'}`
      : null

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── DRAFT PREVIEW BANNER ────────────────────────────────── */}
      {isDraft && (
        <div
          className="fixed top-0 inset-x-0 z-[60] flex items-center justify-between px-6 py-2.5"
          style={{ background: '#E67E50' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded f-body"
              style={{ background: 'rgba(0,0,0,0.18)', color: 'white' }}
            >
              Draft
            </span>
            <p className="text-white text-xs font-medium f-body">
              This experience is not published yet — only you can see this preview.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/dashboard/experiences"
              className="text-white/80 text-xs f-body hover:text-white transition-colors"
            >
              ← Dashboard
            </Link>
            <Link
              href={`/dashboard/experiences/${exp.id}/edit`}
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full f-body transition-opacity hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'white' }}
            >
              Edit &amp; Publish →
            </Link>
          </div>
        </div>
      )}

      <HomeNav pinned topOffset={isDraft ? 38 : 0} />

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ height: '560px', paddingTop: '80px', background: '#07111C' }}
      >
        {/* Cover image */}
        {coverUrl != null && (
          <Image
            src={coverUrl}
            alt={exp.title}
            fill
            priority
            className="object-cover"
            style={{ objectPosition: 'center 40%' }}
          />
        )}

        {/* Gradients */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(4,12,22,0.55) 0%, rgba(4,12,22,0.28) 40%, rgba(4,12,22,0.72) 75%, #07111C 100%)',
          }}
        />

        <GrainOverlay />

        {/* Bottom content — breadcrumb + title */}
        <div
          className="absolute bottom-0 inset-x-0 px-8 pb-10"
          style={{ zIndex: 3 }}
        >
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5">
              <Link
                href="/experiences"
                className="text-white/42 hover:text-white/75 text-xs font-medium transition-colors f-body"
              >
                Experiences
              </Link>
              <span className="text-white/22 text-xs">›</span>
              <span className="text-white/42 text-xs f-body">
                {flag} {exp.location_country}
              </span>
              <span className="text-white/22 text-xs">›</span>
              <span className="text-white/60 text-xs f-body line-clamp-1 max-w-xs">
                {exp.title}
              </span>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {exp.fish_types.map(fish => (
                <span
                  key={fish}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                  style={{ background: 'rgba(230,126,80,0.18)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.22)' }}
                >
                  {fish}
                </span>
              ))}
              {diffLabel != null && (
                <span
                  className="text-xs font-medium px-3 py-1.5 rounded-full f-body"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {diffLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-white font-bold f-display"
              style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1, maxWidth: '680px' }}
            >
              {exp.title}
            </h1>

            {/* Location */}
            <p className="text-white/45 text-sm mt-3 f-body">
              {flag} {exp.location_city != null ? `${exp.location_city}, ` : ''}{exp.location_country}
            </p>
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      {/*
        Hero bottom merges into #07111C then the content area starts with
        a thin dark-to-cream band so the transition is deliberate, not abrupt.
      */}
      <div style={{ background: '#07111C', height: '32px' }} />

      <div className="px-8 pb-24" style={{ background: '#F3EDE4' }}>
        <div className="max-w-7xl mx-auto">

          {/* Gallery */}
          <div className="pt-10">
            <ExperienceGallery images={exp.images} title={exp.title} />
          </div>

          <div className="flex gap-12 items-start">

            {/* ─── LEFT — main content ─────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Description */}
              <section className="mb-12">
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  About this trip
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-5 f-display">
                  What to expect
                </h2>
                <p
                  className="text-base leading-[1.8] f-body"
                  style={{ color: 'rgba(10,46,77,0.65)', maxWidth: '600px' }}
                >
                  {exp.description}
                </p>
              </section>

              {/* Target Species */}
              <section className="mb-12">
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Target species
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                  What you&apos;ll be chasing
                </h2>
                <div
                  className={
                    exp.fish_types.length >= 4
                      ? 'grid grid-cols-2 sm:grid-cols-3 gap-2'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                  }
                >
                  {exp.fish_types.map(fish => (
                    <SpeciesCard
                      key={fish}
                      fish={fish}
                      info={FISH_INFO[fish]}
                      compact={exp.fish_types.length >= 4}
                    />
                  ))}
                </div>
              </section>

              {/* Catch & Release callout */}
              {exp.catch_and_release && (
                <div
                  className="flex items-start gap-4 px-6 py-5 rounded-2xl mb-12"
                  style={{
                    background: 'rgba(46,160,100,0.07)',
                    border: '1px solid rgba(46,160,100,0.18)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: 'rgba(46,160,100,0.12)' }}
                  >
                    ♻
                  </div>
                  <div>
                    <p className="text-sm font-semibold f-body mb-0.5" style={{ color: '#1d7a4a' }}>
                      Catch &amp; Release
                    </p>
                    <p className="text-xs leading-relaxed f-body" style={{ color: 'rgba(29,122,74,0.72)' }}>
                      All fish are returned alive. This experience follows strict conservation practices to protect Scandinavia&apos;s wild fish populations.
                    </p>
                  </div>
                </div>
              )}

              {/* Quick facts strip */}
              <div
                className="flex flex-wrap gap-6 py-7 px-8 rounded-3xl mb-6"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                }}
              >
                {[
                  { label: 'Duration', value: duration ?? '—' },
                  { label: 'Group size', value: exp.max_guests != null ? `Max ${exp.max_guests} anglers` : '—' },
                  { label: 'Technique', value: exp.technique ?? '—' },
                  { label: 'Level', value: diffLabel ?? '—' },
                  { label: 'Location', value: exp.location_city ?? exp.location_country ?? '—' },
                ].map(fact => (
                  <div key={fact.label}>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1 f-body"
                      style={{ color: 'rgba(10,46,77,0.35)' }}
                    >
                      {fact.label}
                    </p>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {fact.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Included / Excluded */}
              <section className="mb-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* Included */}
                  <div
                    className="p-7 rounded-3xl"
                    style={{
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.22em] mb-5 f-body"
                      style={{ color: '#E67E50' }}
                    >
                      Included
                    </p>
                    <ul className="flex flex-col gap-3">
                      {exp.what_included.map(item => (
                        <li key={item} className="flex items-start gap-3">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
                            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
                          >
                            ✓
                          </span>
                          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.7)' }}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Not included */}
                  <div
                    className="p-7 rounded-3xl"
                    style={{
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.22em] mb-5 f-body"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                    >
                      Not included
                    </p>
                    <ul className="flex flex-col gap-3">
                      {exp.what_excluded.map(item => (
                        <li key={item} className="flex items-start gap-3">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px]"
                            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}
                          >
                            ✕
                          </span>
                          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Location + Map */}
              {(exp.location_lat != null || exp.meeting_point != null) && (
                <section className="mb-12">
                  <SalmonRule />
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                    style={{ color: '#E67E50' }}
                  >
                    Location
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-5 f-display">
                    Where you&apos;ll fish
                  </h2>

                  {/* Map embed */}
                  {exp.location_lat != null && exp.location_lng != null && (
                    <div
                      className="overflow-hidden mb-4"
                      style={{ borderRadius: '20px', height: '220px', border: '1px solid rgba(10,46,77,0.08)' }}
                    >
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${exp.location_lng - 0.9},${exp.location_lat - 0.45},${exp.location_lng + 0.9},${exp.location_lat + 0.45}&layer=mapnik&marker=${exp.location_lat},${exp.location_lng}`}
                        width="100%"
                        height="220"
                        style={{ border: 0, display: 'block' }}
                        title={`Map of ${exp.location_city ?? exp.location_country ?? 'fishing location'}`}
                      />
                    </div>
                  )}

                  {/* Meeting point row */}
                  {exp.meeting_point != null && (
                    <div
                      className="flex items-center gap-4 px-6 py-4 rounded-2xl"
                      style={{
                        background: '#FDFAF7',
                        border: '1px solid rgba(10,46,77,0.07)',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: 'rgba(230,126,80,0.1)' }}
                      >
                        📍
                      </div>
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.22em] mb-0.5 f-body"
                          style={{ color: 'rgba(10,46,77,0.35)' }}
                        >
                          Meeting point
                        </p>
                        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                          {exp.meeting_point}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Guide card */}
              <section>
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-6 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Your guide
                </p>

                <div
                  className="p-7 rounded-3xl"
                  style={{
                    background: '#FDFAF7',
                    border: '1px solid rgba(10,46,77,0.07)',
                    boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                  }}
                >
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                      style={{ border: '2px solid rgba(10,46,77,0.08)' }}
                    >
                      {exp.guide.avatar_url != null ? (
                        <Image
                          src={exp.guide.avatar_url}
                          alt={exp.guide.full_name}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#0A2E4D] flex items-center justify-center text-white text-xl f-display">
                          {exp.guide.full_name[0]}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="text-[#0A2E4D] font-bold text-lg f-display">
                            {exp.guide.full_name}
                          </h3>
                          <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                            {exp.guide.city != null ? `${exp.guide.city}, ` : ''}
                            {exp.guide.country}
                            {exp.guide.average_rating != null && (
                              <span className="ml-3">★ {exp.guide.average_rating.toFixed(1)}</span>
                            )}
                          </p>
                        </div>
                        <Link
                          href={`/guides/${exp.guide_id}`}
                          className="text-xs font-semibold px-4 py-2 rounded-full transition-colors f-body"
                          style={{
                            border: '1px solid rgba(10,46,77,0.18)',
                            color: 'rgba(10,46,77,0.6)',
                          }}
                        >
                          View profile →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ─── RIGHT — booking widget (sticky) ─────────────── */}
            <aside
              className="hidden lg:block flex-shrink-0"
              style={{ width: '360px', position: 'sticky', top: "81px", alignSelf: 'flex-start' }}
            >
              <div
                className="p-8"
                style={{
                  background: '#FDFAF7',
                  borderRadius: '28px',
                  border: '1px solid rgba(10,46,77,0.08)',
                  boxShadow: '0 8px 40px rgba(10,46,77,0.1)',
                }}
              >
                {/* Price */}
                <div className="mb-7">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1 f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    Price per person
                  </p>
                  <div className="flex items-end gap-2">
                    <span
                      className="font-bold f-display"
                      style={{ fontSize: '48px', color: '#0A2E4D', lineHeight: 1 }}
                    >
                      €{exp.price_per_person_eur}
                    </span>
                    <span className="text-sm pb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      / person
                    </span>
                  </div>
                </div>

                {/* Meta row */}
                <div
                  className="flex gap-4 pb-7 mb-7"
                  style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
                >
                  {duration != null && (
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1 f-body"
                        style={{ color: 'rgba(10,46,77,0.35)' }}
                      >
                        Duration
                      </p>
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        {duration}
                      </p>
                    </div>
                  )}
                  {exp.max_guests != null && (
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1 f-body"
                        style={{ color: 'rgba(10,46,77,0.35)' }}
                      >
                        Group
                      </p>
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        Max {exp.max_guests}
                      </p>
                    </div>
                  )}
                  {diffLabel != null && (
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1 f-body"
                        style={{ color: 'rgba(10,46,77,0.35)' }}
                      >
                        Level
                      </p>
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        {diffLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Guests input — hidden for drafts */}
                {!isDraft && (
                  <div className="mb-7">
                    <label
                      className="block text-[10px] font-semibold uppercase tracking-[0.2em] mb-2 f-body"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                    >
                      Anglers
                    </label>
                    <select
                      className="w-full px-4 py-3 text-sm rounded-2xl appearance-none f-body"
                      defaultValue="1"
                      style={{
                        background: '#F3EDE4',
                        border: '1px solid rgba(10,46,77,0.12)',
                        color: '#0A2E4D',
                      }}
                    >
                      {Array.from(
                        { length: exp.max_guests ?? 4 },
                        (_, i) => i + 1
                      ).map(n => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'angler' : 'anglers'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* CTA — booking for published, publish prompt for drafts */}
                {isDraft ? (
                  <>
                    <div
                      className="flex items-start gap-3 px-4 py-4 rounded-2xl mb-5"
                      style={{ background: 'rgba(230,126,80,0.08)', border: '1px solid rgba(230,126,80,0.18)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#E67E50" strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
                        <circle cx="8" cy="8" r="6.5" />
                        <line x1="8" y1="5" x2="8" y2="8.5" />
                        <circle cx="8" cy="11" r="0.6" fill="#E67E50" />
                      </svg>
                      <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
                        This experience is a draft. Publish it from your dashboard to accept bookings.
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/experiences/${exp.id}/edit`}
                      className="block w-full text-center text-white font-semibold py-4 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
                      style={{ background: '#E67E50' }}
                    >
                      Edit &amp; Publish →
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/book/${exp.id}`}
                      className="block w-full text-center text-white font-semibold py-4 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
                      style={{ background: '#E67E50' }}
                    >
                      Request to Book →
                    </Link>
                    <p className="text-center text-xs mt-4 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
                      No charge yet — confirm with your guide first.
                    </p>
                  </>
                )}

                {/* Divider */}
                <div
                  className="my-6"
                  style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }}
                />

                {/* Trust micro-signals */}
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '✓', text: 'Guide verified by FjordAnglers' },
                    { icon: '€', text: 'Price shown — no hidden fees' },
                    { icon: '⌚', text: 'Confirmed within 24 hours' },
                    ...(exp.catch_and_release ? [{ icon: '♻', text: 'Catch & Release — fish returned alive' }] : []),
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                        style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
                      >
                        {item.icon}
                      </span>
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

          </div>
        </div>
      </div>

      {/* ─── MOBILE BOOKING BAR (fixed bottom) — hidden for drafts ─ */}
      <div
        className={`${isDraft ? 'hidden' : 'lg:hidden'} fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-6 py-4`}
        style={{
          background: '#FDFAF7',
          borderTop: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 -8px 32px rgba(10,46,77,0.1)',
        }}
      >
        <div>
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>per person</p>
          <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            €{exp.price_per_person_eur}
          </p>
        </div>
        <Link
          href={`/book/${exp.id}`}
          className="text-white font-semibold px-8 py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          Request to Book →
        </Link>
      </div>

      {/* ─── MORE FROM GUIDE ─────────────────────────────────────── */}
      {moreFromGuide.length > 0 && (
        <section className="px-8 py-20" style={{ background: '#F3EDE4' }}>
          <div className="max-w-7xl mx-auto">
            <div
              className="mb-12 pb-0 flex items-end justify-between"
              style={{ borderTop: '1px solid rgba(10,46,77,0.09)', paddingTop: '4rem' }}
            >
              <div>
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Same guide
                </p>
                <h2 className="text-[#0A2E4D] text-3xl font-bold f-display">
                  More trips with{' '}
                  <span style={{ fontStyle: 'italic' }}>{exp.guide.full_name}</span>
                </h2>
              </div>
              <Link
                href={`/guides/${exp.guide_id}`}
                className="hidden md:block text-sm font-medium transition-colors hover:text-[#E67E50] f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                View guide profile →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {moreFromGuide.map(related => {
                const relCover =
                  related.images.find(i => i.is_cover)?.url ?? related.images[0]?.url ?? null
                const relDuration =
                  related.duration_hours != null
                    ? `${related.duration_hours}h`
                    : related.duration_days != null
                    ? `${related.duration_days} days`
                    : null

                return (
                  <Link key={related.id} href={`/experiences/${related.id}`} className="group block">
                    <article
                      className="overflow-hidden transition-all duration-300 hover:shadow-[0_20px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1"
                      style={{
                        borderRadius: '28px',
                        background: '#FDFAF7',
                        border: '1px solid rgba(10,46,77,0.07)',
                        boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                      }}
                    >
                      <div className="relative overflow-hidden" style={{ height: '220px' }}>
                        {relCover != null ? (
                          <Image
                            src={relCover}
                            alt={related.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                        )}
                        <div
                          className="absolute top-4 right-4 text-white text-sm font-bold px-3.5 py-1.5 rounded-full f-body"
                          style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}
                        >
                          €{related.price_per_person_eur}
                          <span className="text-xs font-normal opacity-55">/pp</span>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                          {related.fish_types.slice(0, 2).map(fish => (
                            <span
                              key={fish}
                              className="text-xs font-medium px-2.5 py-1 rounded-full f-body"
                              style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                            >
                              {fish}
                            </span>
                          ))}
                        </div>
                        <h3
                          className="font-semibold text-sm leading-snug mb-3 line-clamp-2 f-display"
                          style={{ color: '#0A2E4D' }}
                        >
                          {related.title}
                        </h3>
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          {relDuration}
                          {relDuration != null && related.max_guests != null && ' · '}
                          {related.max_guests != null && `max ${related.max_guests}`}
                        </p>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer
        className="py-14 px-8"
        style={{ background: '#05101A', borderTop: '1px solid rgba(230,126,80,0.12)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div>
              <Image
                src="/brand/white-logo.png"
                alt="FjordAnglers"
                width={140}
                height={36}
                className="h-7 w-auto mb-4"
                style={{ opacity: 0.55 }}
              />
              <p
                className="text-sm leading-relaxed f-body"
                style={{ color: 'rgba(255,255,255,0.22)', maxWidth: '240px' }}
              >
                Connecting anglers with the best fishing experiences in Scandinavia.
              </p>
            </div>
            <div className="flex items-center gap-8 md:gap-12">
              {[
                { label: 'Experiences', href: '/experiences' },
                { label: 'Guides', href: '/guides' },
                { label: 'License Map', href: '/license-map' },
                { label: 'Join as Guide', href: '/guides/apply' },
              ].map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm transition-colors f-body hover:text-white/60"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div
            className="mt-10 pt-6 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>© 2026 FjordAnglers</p>
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.14)' }}>Norway · Sweden · Finland</p>
          </div>
        </div>
      </footer>

      {/* Spacer so mobile booking bar doesn't overlap footer */}
      <div className="lg:hidden h-20" />

    </div>
  )
}
