import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuide, getGuideExperiences } from '@/lib/supabase/queries'
import { ExperienceGallery } from '@/components/trips/experience-gallery'
import { CountryFlag } from '@/components/ui/country-flag'
import { heroFull, avatarImg, cardThumb } from '@/lib/image'
import { getLandscapeUrl } from '@/lib/landscapes'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`


const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels',
  intermediate: 'Intermediate',
  expert: 'Expert',
}

const BOAT_TYPE_LABEL: Record<string, string> = {
  center_console:   'Center Console',
  cabin:            'Cabin Boat',
  rib:              'RIB',
  drift_boat:       'Drift Boat',
  kayak:            'Kayak',
  rigid_inflatable: 'Rigid Inflatable',
}

const CANCELLATION_POLICY_INFO: Record<string, { label: string; detail: string }> = {
  flexible: { label: 'Flexible cancellation',  detail: 'Full refund up to 48h before' },
  moderate: { label: 'Moderate cancellation',  detail: 'Full refund up to 7 days before' },
  strict:   { label: 'Strict cancellation',    detail: 'No refund within 14 days' },
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
  const guide = await getGuide(id)
  if (guide == null) return {}
  return {
    title: `${guide.full_name} — Fishing Guide in ${guide.country} | FjordAnglers`,
    description: guide.bio != null ? guide.bio.slice(0, 160) : undefined,
    openGraph: {
      title: `${guide.full_name} — FjordAnglers`,
      description: guide.bio != null ? guide.bio.slice(0, 160) : undefined,
      images: guide.cover_url != null ? [guide.cover_url] : [],
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function GuideProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Parallel fetch: guide profile + their published experiences
  const [guide, guideExperiences] = await Promise.all([
    getGuide(id),
    getGuideExperiences(id),
  ])

  if (guide == null) notFound()

  // flag rendered as <CountryFlag> below
  const landscapeUrl = getLandscapeUrl(guide.country, guide.id)

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: '480px', paddingTop: '80px', background: '#07111C' }}
      >
        {/* Landscape background */}
        <Image
          src={landscapeUrl}
          alt=""
          fill
          priority
          className="object-cover"
          style={{ objectPosition: 'center 50%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(4,12,22,0.45) 0%, rgba(4,12,22,0.22) 35%, rgba(4,12,22,0.68) 70%, #07111C 100%)',
          }}
        />
        <GrainOverlay />

        {/* Back button */}
        <div className="absolute top-0 inset-x-0 px-8" style={{ paddingTop: 'calc(88px + 12px)', zIndex: 3 }}>
          <div className="max-w-7xl mx-auto">
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 text-xs font-semibold f-body transition-all hover:opacity-80"
              style={{
                color: 'rgba(255,255,255,0.75)',
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '999px',
                padding: '6px 14px',
              }}
            >
              ← All Guides
            </Link>
          </div>
        </div>

        {/* Bottom-anchored guide identity */}
        <div className="absolute bottom-0 inset-x-0 px-8 pb-10" style={{ zIndex: 3 }}>
          <div className="max-w-7xl mx-auto">
            <div
              className="w-20 h-20 rounded-full overflow-hidden mb-5"
              style={{ border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            >
              {guide.avatar_url != null ? (
                <Image src={avatarImg(guide.avatar_url) ?? guide.avatar_url} alt={guide.full_name} width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-2xl f-display font-bold" style={{ background: '#0A2E4D' }}>
                  {guide.full_name[0]}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {guide.fish_expertise.map(fish => (
                <span
                  key={fish}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                  style={{ background: 'rgba(230,126,80,0.18)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.22)' }}
                >
                  {fish}
                </span>
              ))}
            </div>

            <h1 className="text-white font-bold f-display" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
              {guide.full_name}
            </h1>

            <div className="flex items-center gap-4 mt-2">
              <p className="text-white/45 text-sm f-body">
                <CountryFlag country={guide.country} /> {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
              </p>
              {guide.average_rating != null && (
                <p className="text-white/55 text-sm f-body">
                  ★ {guide.average_rating.toFixed(1)}
                  <span className="text-white/28 ml-1">({guide.total_reviews} reviews)</span>
                </p>
              )}
            </div>

            {guide.tagline != null && (
              <p className="italic f-body mt-3" style={{ color: 'rgba(255,255,255,0.70)', fontSize: '1.125rem' }}>
                &ldquo;{guide.tagline}&rdquo;
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="px-8 pb-24" style={{ background: '#F3EDE4' }}>
        <div className="max-w-7xl mx-auto pt-10">
          <div className="flex gap-12 items-start">

            {/* ─── LEFT ────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Bio */}
              <section className="mb-12">
                <SalmonRule />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body" style={{ color: '#E67E50' }}>
                  About
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-5 f-display">
                  {guide.full_name.split(' ')[0]}&apos;s story
                </h2>
                {guide.bio != null && (
                  <p className="text-base leading-[1.8] f-body" style={{ color: 'rgba(10,46,77,0.65)', maxWidth: '600px' }}>
                    {guide.bio}
                  </p>
                )}
              </section>

              {/* Gallery */}
              {guide.images != null && guide.images.length > 0 && (
                <section className="mb-12">
                  <SalmonRule />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-4 f-body" style={{ color: '#E67E50' }}>
                    Photos
                  </p>
                  <ExperienceGallery
                    images={guide.images}
                    title={guide.full_name}
                  />
                </section>
              )}

              {/* Specialties */}
              {guide.specialties != null && guide.specialties.length > 0 && (
                <section className="mb-12">
                  <SalmonRule />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body" style={{ color: '#E67E50' }}>
                    Specialties
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {guide.specialties.map(specialty => (
                      <span
                        key={specialty}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                        style={{ background: 'rgba(230,126,80,0.18)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.22)' }}
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Expertise */}
              <section className="mb-12">
                <SalmonRule />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body" style={{ color: '#E67E50' }}>
                  Expertise
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">Skills &amp; knowledge</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 rounded-3xl" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-4 f-body" style={{ color: '#E67E50' }}>Target species</p>
                    <div className="flex flex-wrap gap-2">
                      {guide.fish_expertise.map(fish => (
                        <span key={fish} className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}>
                          {fish}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-4 f-body" style={{ color: '#E67E50' }}>Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {guide.languages.map(lang => (
                        <span key={lang} className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Google reviews card */}
                  {guide.google_rating != null && (
                    <div className="p-6 rounded-3xl" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-4 f-body" style={{ color: '#E67E50' }}>Google Reviews</p>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#4285F4' }}
                        >
                          <span className="text-white font-bold text-xs">G</span>
                        </div>
                        <div>
                          {guide.google_profile_url != null ? (
                            <a
                              href={guide.google_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              <span className="font-bold text-sm f-body" style={{ color: '#0A2E4D' }}>★ {guide.google_rating.toFixed(1)}</span>
                              {guide.google_review_count != null && (
                                <span className="text-xs f-body ml-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>({guide.google_review_count} reviews)</span>
                              )}
                            </a>
                          ) : (
                            <>
                              <span className="font-bold text-sm f-body" style={{ color: '#0A2E4D' }}>★ {guide.google_rating.toFixed(1)}</span>
                              {guide.google_review_count != null && (
                                <span className="text-xs f-body ml-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>({guide.google_review_count} reviews)</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-6 py-6 px-7 rounded-3xl mt-4" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}>
                  {[
                    { label: 'Trip',    value: guide.years_experience != null ? `${guide.years_experience} years` : '—' },
                    { label: 'Total reviews', value: guide.total_reviews.toString() },
                    { label: 'Rating',        value: guide.average_rating != null ? `★ ${guide.average_rating.toFixed(1)}` : '—' },
                    { label: 'Location',      value: `${guide.city != null ? `${guide.city}, ` : ''}${guide.country}` },
                    ...(guide.certifications != null ? [{ label: 'Certification', value: guide.certifications }] : []),
                  ].map(fact => (
                    <div key={fact.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                        {fact.label}
                      </p>
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{fact.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Boat section */}
              {(guide.boat_name != null || guide.boat_type != null) && (
                <section className="mb-12">
                  <SalmonRule />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body" style={{ color: '#E67E50' }}>
                    The boat
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                    ⚓ {guide.boat_name ?? 'The vessel'}
                  </h2>
                  <div
                    className="p-6 rounded-3xl"
                    style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
                  >
                    <div className="flex flex-wrap gap-2">
                      {guide.boat_type != null && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                          {BOAT_TYPE_LABEL[guide.boat_type] ?? guide.boat_type}
                        </span>
                      )}
                      {guide.boat_length_m != null && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                          {guide.boat_length_m}m
                        </span>
                      )}
                      {guide.boat_engine != null && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                          {guide.boat_engine}
                        </span>
                      )}
                      {guide.boat_capacity != null && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                          {guide.boat_capacity} persons max
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Guide's experiences */}
              {guideExperiences.length > 0 && (
                <section id="experiences">
                  <SalmonRule />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body" style={{ color: '#E67E50' }}>
                    Experiences
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                    Book a trip with {guide.full_name.split(' ')[0]}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {guideExperiences.map(exp => {
                      const coverUrl = cardThumb(exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url)
                      // expFlag rendered as <CountryFlag> below
                      const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                      const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : exp.duration_days != null ? `${exp.duration_days} days` : null

                      return (
                        <Link key={exp.id} href={`/trips/${exp.id}`} className="group block">
                          <article
                            className="overflow-hidden transition-all duration-300 hover:shadow-[0_20px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1"
                            style={{ borderRadius: '28px', background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
                          >
                            <div className="relative overflow-hidden" style={{ height: '200px' }}>
                              {coverUrl != null ? (
                                <Image src={coverUrl} alt={exp.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                              ) : (
                                <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                              )}
                              <div
                                className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                style={{ background: 'rgba(7,17,28,0.28)' }}
                              >
                                <span className="text-white text-sm font-semibold px-5 py-2 rounded-full translate-y-3 group-hover:translate-y-0 transition-transform duration-200 f-body" style={{ background: '#E67E50' }}>
                                  View Trip →
                                </span>
                              </div>
                              <div className="absolute top-3 right-3 text-white text-sm font-bold px-3 py-1.5 rounded-full f-body" style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}>
                                €{exp.price_per_person_eur}<span className="text-xs font-normal opacity-55">/pp</span>
                              </div>
                            </div>

                            <div className="p-5">
                              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                <span className="text-xs f-body flex items-center gap-1" style={{ color: 'rgba(10,46,77,0.5)' }}><CountryFlag country={exp.location_country} /> {exp.location_country}</span>
                                <span className="text-xs" style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
                                {exp.fish_types.slice(0, 2).map(fish => (
                                  <span key={fish} className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}>
                                    {fish}
                                  </span>
                                ))}
                                {diffLabel != null && (
                                  <span className="text-xs font-medium px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.05)', color: '#0A2E4D' }}>
                                    {diffLabel}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-sm leading-snug mb-3 line-clamp-2 f-display" style={{ color: '#0A2E4D' }}>
                                {exp.title}
                              </h3>
                              {(duration != null || exp.max_guests != null) && (
                                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                                  {duration}{duration != null && exp.max_guests != null && ' · '}{exp.max_guests != null && `max ${exp.max_guests}`}
                                </p>
                              )}
                            </div>
                          </article>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* ─── RIGHT — sticky contact card ─────────────────── */}
            <aside
              className="hidden lg:block flex-shrink-0"
              style={{ width: '340px', position: 'sticky', top: '81px', alignSelf: 'flex-start' }}
            >
              <div className="p-7" style={{ background: '#FDFAF7', borderRadius: '28px', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 8px 40px rgba(10,46,77,0.1)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(10,46,77,0.08)' }}>
                    {guide.avatar_url != null ? (
                      <Image src={avatarImg(guide.avatar_url) ?? guide.avatar_url} alt={guide.full_name} width={56} height={56} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-lg f-display font-bold" style={{ background: '#0A2E4D' }}>
                        {guide.full_name[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold f-display text-base" style={{ color: '#0A2E4D' }}>{guide.full_name}</h3>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      <CountryFlag country={guide.country} /> {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pb-6 mb-6" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                  {[
                    { label: 'Years exp.',  value: guide.years_experience != null ? `${guide.years_experience}` : '—' },
                    { label: 'Trips',       value: guideExperiences.length.toString() },
                    { label: 'Rating',      value: guide.average_rating != null ? `★ ${guide.average_rating.toFixed(1)}` : '—' },
                  ].map(stat => (
                    <div key={stat.label} className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{stat.label}</p>
                      <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <Link
                    href="#experiences"
                    className="block w-full text-center text-white font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
                    style={{ background: '#E67E50' }}
                  >
                    Browse Experiences →
                  </Link>
                  <button
                    type="button"
                    className="w-full text-center font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:bg-[#0A2E4D]/[0.06] active:scale-[0.98] f-body"
                    style={{ border: '1px solid rgba(10,46,77,0.18)', color: 'rgba(10,46,77,0.65)' }}
                  >
                    Send Message
                  </button>
                </div>

                {(guide.instagram_url != null || guide.youtube_url != null) && (
                  <>
                    <div className="my-5" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />
                    <div className="flex flex-col gap-2.5">
                      {guide.instagram_url != null && (
                        <a href={guide.instagram_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm f-body transition-opacity hover:opacity-70"
                          style={{ color: 'rgba(10,46,77,0.5)' }}
                        >
                          <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0" style={{ background: 'rgba(10,46,77,0.06)' }}>IG</span>
                          <span className="truncate">{guide.instagram_url.replace('https://instagram.com/', '@')}</span>
                        </a>
                      )}
                      {guide.youtube_url != null && (
                        <a href={guide.youtube_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm f-body transition-opacity hover:opacity-70"
                          style={{ color: 'rgba(10,46,77,0.5)' }}
                        >
                          <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0" style={{ background: 'rgba(10,46,77,0.06)' }}>YT</span>
                          <span className="truncate">YouTube channel</span>
                        </a>
                      )}
                    </div>
                  </>
                )}

                {guide.verified_at != null && (
                  <>
                    <div className="my-5" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>
                        ✓
                      </span>
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Verified by FjordAnglers</span>
                    </div>
                  </>
                )}

                {/* Cancellation policy */}
                {CANCELLATION_POLICY_INFO[guide.cancellation_policy] != null && (
                  <>
                    <div className="my-5" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />
                    <div className="flex items-start gap-2.5">
                      <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: 'rgba(10,46,77,0.35)' }}>🛡️</span>
                      <div>
                        <p className="text-xs font-semibold f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                          {CANCELLATION_POLICY_INFO[guide.cancellation_policy]!.label}
                        </p>
                        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.35)' }}>
                          {CANCELLATION_POLICY_INFO[guide.cancellation_policy]!.detail}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </aside>

          </div>
        </div>
      </div>

    </div>
  )
}
