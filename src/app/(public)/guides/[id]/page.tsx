import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { getGuide, getGuideExperiencePages, type GuideWithImages } from '@/lib/supabase/queries'
import { ExperienceGallery } from '@/components/trips/experience-gallery'
import { avatarImg } from '@/lib/image'
import { getLandscapeUrl } from '@/lib/landscapes'
import { formatPrice } from '@/lib/format-price'
import { SITE_URL } from '@/lib/site'
import { guideProfilePath } from '@/lib/guide-url'
import { retiredGuideTarget } from '@/lib/guide-redirects'
import { PhotoHero } from '@/components/site/photo-hero'
import { TripCard } from '@/components/site/trip-card'
import {
  CREAM, Eyebrow, INK, LINE, MUTED, NAVY, ON_DARK_SOFT, SALMON_ON_DARK, SAND, Tag, initials, primaryButtonStyle,
} from '@/components/site/ui'
import s from '@/components/site/grain.module.css'

/**
 * /guides/[id] — the guide profile, built from docs/design/site-2026-11/guide-profile.dc.html:
 * photo hero, then About, Photos, Specialties, Skills & knowledge, the boat and the guide's trips
 * on the left and the contact card on the right. Sections and the conditions they draw on are the
 * ones the page had before the redesign; the "Total reviews" and "Rating" figures are left out
 * while the guide has no reviews (tj, 2026-11-17).
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

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

/** Eyebrow + h2 of a left-column section; every section after the first has a rule above it. */
function Section({ eyebrow, title, first = false, id, testId, children }: {
  eyebrow: string; title?: string; first?: boolean; id?: string; testId?: string; children: ReactNode
}) {
  return (
    <section
      id={id}
      data-section={testId}
      className={`flex flex-col ${first ? 'gap-4' : 'gap-5 pt-11'}`}
      style={first ? undefined : { borderTop: `1px solid ${LINE}` }}
    >
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        {title != null && (
          <h2 className="f-display" style={{ margin: 0, fontWeight: 700, fontSize: 30, lineHeight: 1.12, letterSpacing: '-.01em', color: NAVY }}>{title}</h2>
        )}
      </div>
      {children}
    </section>
  )
}

/** The guide's photo, or their initials on navy. */
function Avatar({ guide, size, radius, border }: { guide: GuideWithImages; size: number; radius: number | string; border: string }) {
  return (
    <span
      className="f-display relative flex flex-none items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, border, background: NAVY, color: SALMON_ON_DARK, fontWeight: 700, fontSize: Math.round(size / 3) }}
    >
      {guide.avatar_url != null
        ? <Image src={avatarImg(guide.avatar_url) ?? guide.avatar_url} alt={guide.full_name} fill sizes={`${size}px`} className="object-cover" />
        : <span aria-hidden="true">{initials(guide.full_name)}</span>}
    </span>
  )
}

/** A frosted fact tile on the Skills grain block. */
function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${s.fq} flex flex-col gap-1`} style={{ padding: '13px 18px' }}>
      <span className="f-body text-[11.5px] font-bold uppercase" style={{ letterSpacing: '.1em', color: SALMON_ON_DARK }}>{label}</span>
      <span className="f-body break-words text-[15.5px] font-semibold" style={{ lineHeight: 1.35, color: '#FFFFFF' }}>{value}</span>
    </div>
  )
}

const socialLinkClass = 'f-body flex min-h-[44px] items-center gap-[10px] text-[14.5px] font-semibold transition-opacity hover:opacity-70'

function SocialIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="flex h-[30px] w-[30px] flex-none items-center justify-center text-[11px] font-bold" style={{ borderRadius: 9, background: SAND }}>
      {children}
    </span>
  )
}

// ─── METADATA ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const guide = await getGuide(id)
  if (guide == null) return {}
  const profilePath = guideProfilePath(guide)
  // A profile with no active offer is thin content → noindex (tj D3). One without a slug has no
  // canonical URL to point at, so it is noindex as well and carries no canonical.
  const hasOffer = (await getGuideExperiencePages(guide.id)).length > 0
  const indexable = profilePath != null && hasOffer
  const desc = `Fish with ${guide.full_name} — verified local fishing guide in ${guide.country}. ${guide.fish_expertise?.slice(0, 3).join(', ') ?? 'Salmon, sea trout & more'}. Book via FjordAnglers.`
  const ogTitle = `${guide.full_name} — Fishing Guide in ${guide.country} | FjordAnglers`
  const ogImages = guide.cover_url != null
    ? [{ url: guide.cover_url, width: 1200, height: 630, alt: `${guide.full_name} — fishing guide in ${guide.country}` }]
    : []
  return {
    title: `${guide.full_name} — Fishing Guide in ${guide.country}`,
    description: desc,
    ...(indexable ? {} : { robots: { index: false } }),
    ...(profilePath != null ? { alternates: { canonical: `${SITE_URL}${profilePath}` } } : {}),
    openGraph: {
      title: ogTitle,
      description: desc,
      ...(profilePath != null ? { url: `${SITE_URL}${profilePath}` } : {}),
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: ogTitle,
      description: desc,
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

  // A retired duplicate redirects to the profile it was merged into. This runs before the
  // lookup below, which 404s for hidden / inactive rows (FA-1.86, D2).
  const mergedInto = retiredGuideTarget(id)
  if (mergedInto != null) {
    const target = await getGuide(mergedInto)
    const targetPath = target != null ? guideProfilePath(target) : null
    if (targetPath != null) permanentRedirect(targetPath)
  }

  // Fetch guide first — needed to resolve slug → UUID before fetching experiences
  const guide = await getGuide(id)

  if (guide == null) notFound()

  // Redirect UUID URLs to slug URLs permanently (SEO: slug carries keyword value)
  const profilePath = guideProfilePath(guide)
  if (UUID_RE.test(id) && profilePath != null) {
    permanentRedirect(profilePath)
  }

  // Use guide.id (UUID) so getGuideExperiencePages can filter by the UUID FK
  const guideExperiences = await getGuideExperiencePages(guide.id)

  const profileUrl = profilePath != null ? `${SITE_URL}${profilePath}` : null

  const landscapeUrl = (guide as { landscape_url?: string | null }).landscape_url ?? getLandscapeUrl(guide.country, guide.id)

  const sameAs = [
    guide.instagram_url,
    guide.youtube_url,
    guide.facebook_url,
    guide.website_url,
  ].filter((url): url is string => url != null)

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: guide.full_name,
    ...(guide.bio != null ? { description: guide.bio } : {}),
    ...(guide.avatar_url != null ? { image: guide.avatar_url } : {}),
    ...(profileUrl != null ? { url: profileUrl } : {}),
    jobTitle: 'Fishing Guide',
    address: {
      '@type': 'PostalAddress',
      addressCountry: guide.country,
      ...(guide.city != null ? { addressLocality: guide.city } : {}),
    },
    ...(guide.fish_expertise.length > 0 ? { knowsAbout: guide.fish_expertise } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(guide.average_rating != null ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: guide.average_rating,
        reviewCount: guide.total_reviews,
      },
    } : {}),
    worksFor: { '@type': 'Organization', name: 'FjordAnglers', url: SITE_URL },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.full_name, ...(profileUrl != null ? { item: profileUrl } : {}) },
    ],
  }


  const firstName  = guide.full_name.split(' ')[0]
  const place      = `${guide.city != null ? `${guide.city}, ` : ''}${guide.country}`
  const hasReviews = guide.total_reviews > 0
  const rating     = guide.average_rating != null ? `★ ${guide.average_rating.toFixed(1)}` : '—'
  const policy     = CANCELLATION_POLICY_INFO[guide.cancellation_policy]
  /** The newest published trip: `getGuideExperiencePages` returns active pages, newest first. */
  const newestTrip = guideExperiences[0] ?? null

  const facts = [
    { label: 'Experience', value: guide.years_experience != null ? `${guide.years_experience} years` : '—' },
    ...(hasReviews ? [
      { label: 'Total reviews', value: guide.total_reviews.toString() },
      { label: 'Rating',        value: rating },
    ] : []),
    { label: 'Location', value: place },
    ...(guide.certifications != null && guide.certifications.length > 0 ? [{ label: 'Certification', value: guide.certifications.join(', ') }] : []),
  ]

  const cardStats = [
    { label: 'Experience',  value: guide.years_experience != null ? `${guide.years_experience} yrs` : '—' },
    { label: 'Experiences', value: guideExperiences.length.toString() },
    ...(hasReviews ? [{ label: 'Rating', value: rating }] : []),
  ]

  const boatSpecs = [
    guide.boat_type != null ? (BOAT_TYPE_LABEL[guide.boat_type] ?? guide.boat_type) : null,
    guide.boat_length_m != null ? `${guide.boat_length_m}m` : null,
    guide.boat_engine,
    guide.boat_capacity != null ? `${guide.boat_capacity} persons max` : null,
  ].filter((spec): spec is string => spec != null)

  return (
    <div className="min-h-screen pb-[120px]" style={{ background: '#F3EDE4' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <PhotoHero image={landscapeUrl} minHeight={540}>
        <div className="flex flex-col gap-[18px]">
          <nav aria-label="Breadcrumb" className="f-body flex flex-wrap items-center gap-2 text-[14px]" style={{ color: ON_DARK_SOFT }}>
            <Link href="/guides" style={{ color: ON_DARK_SOFT, textDecoration: 'none' }}>Guides</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page" style={{ color: '#FFFFFF' }}>{guide.full_name}</span>
          </nav>
          <div className="flex flex-wrap items-end gap-6">
            <Avatar guide={guide} size={112} radius={24} border="4px solid rgba(255,255,255,.85)" />
            <div className="flex flex-[1_1_420px] flex-col gap-3">
              {(guide.fish_expertise.length > 0 || guide.years_experience != null) && (
                <div className="flex flex-wrap gap-1.5">
                  {guide.fish_expertise.map(fish => <Tag key={fish}>{fish}</Tag>)}
                  {guide.years_experience != null && <Tag tone="salmon">{guide.years_experience} yrs exp</Tag>}
                </div>
              )}
              <h1
                className="f-display"
                style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(36px, 4.8vw, 60px)', lineHeight: 1.02, letterSpacing: '-.02em', color: '#FFFFFF' }}
              >
                {guide.full_name}
              </h1>
              <p className="f-body m-0 text-[17px]" style={{ color: '#F4F7F9' }}>
                {place}
                {guide.average_rating != null && (
                  <span style={{ color: ON_DARK_SOFT }}> · ★ {guide.average_rating.toFixed(1)} ({guide.total_reviews} reviews)</span>
                )}
              </p>
              {guide.tagline != null && (
                <p className="f-body m-0 text-[17px] italic" style={{ color: ON_DARK_SOFT }}>&ldquo;{guide.tagline}&rdquo;</p>
              )}
            </div>
          </div>
        </div>
      </PhotoHero>

      {/* ─── MAIN ────────────────────────────────────────────────── */}
      <main className="mx-auto px-6 pt-14" style={{ maxWidth: 1200 }}>
        <div className="flex flex-wrap items-start gap-12">

          {/* ─── LEFT ────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-11">

            <Section eyebrow="About" title={`${firstName}'s story`} first testId="about">
              {guide.bio != null && (
                <p className="f-body m-0 whitespace-pre-line break-words text-[16.5px]" style={{ lineHeight: 1.7, color: INK }}>{guide.bio}</p>
              )}
            </Section>

            {guide.images != null && guide.images.length > 0 && (
              <Section eyebrow="Photos" title="Gallery" testId="photos">
                <ExperienceGallery images={guide.images} title={guide.full_name} />
              </Section>
            )}

            {guide.specialties != null && guide.specialties.length > 0 && (
              <Section eyebrow="Specialties" testId="specialties">
                <div className="flex flex-wrap gap-1.5">
                  {guide.specialties.map(specialty => <Tag key={specialty} tone="sand">{specialty}</Tag>)}
                </div>
              </Section>
            )}

            <Section eyebrow="What they know" title="Skills & knowledge" testId="skills">
              <div className={`${s.blur} ${s.guide} flex flex-col gap-5`} style={{ borderRadius: 20, padding: 24 }}>
                <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <div className="flex flex-col gap-[10px]">
                    <Eyebrow dark>Target species</Eyebrow>
                    <div className="flex flex-wrap gap-1.5">
                      {guide.fish_expertise.map(fish => <Tag key={fish}>{fish}</Tag>)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-[10px]">
                    <Eyebrow dark>Languages</Eyebrow>
                    <div className="flex flex-wrap gap-1.5">
                      {guide.languages.map(lang => <Tag key={lang}>{lang}</Tag>)}
                    </div>
                  </div>
                  {guide.google_rating != null && (
                    <div className="flex flex-col gap-[10px]" data-testid="google-reviews">
                      <Eyebrow dark>Google reviews</Eyebrow>
                      {(() => {
                        const text = (
                          <span className="f-body text-[15.5px] font-semibold" style={{ color: '#FFFFFF' }}>
                            ★ {guide.google_rating.toFixed(1)}
                            {guide.google_review_count != null && (
                              <span className="font-normal" style={{ color: ON_DARK_SOFT }}> ({guide.google_review_count} reviews)</span>
                            )}
                          </span>
                        )
                        return guide.google_profile_url != null
                          ? <a href={guide.google_profile_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#FFFFFF', textDecorationColor: SALMON_ON_DARK }}>{text}</a>
                          : text
                      })()}
                    </div>
                  )}
                </div>
                <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]" data-testid="guide-facts">
                  {facts.map(fact => <FactTile key={fact.label} label={fact.label} value={fact.value} />)}
                </div>
              </div>
            </Section>

            {(guide.boat_name != null || guide.boat_type != null) && (
              <Section eyebrow="The boat" title={guide.boat_name ?? 'The vessel'} testId="boat">
                {boatSpecs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {boatSpecs.map(spec => <Tag key={spec} tone="sand">{spec}</Tag>)}
                  </div>
                )}
              </Section>
            )}

            {guideExperiences.length > 0 && (
              <Section eyebrow="Trips" title={`Book a trip with ${firstName}`} id="experiences" testId="trips">
                <ul className="m-0 grid list-none gap-x-7 gap-y-10 p-0 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                  {guideExperiences.map(exp => (
                    <li key={exp.id} className="min-w-0">
                      <TripCard
                        trip={{
                          slug:      exp.slug,
                          name:      exp.experience_name,
                          region:    exp.country,
                          cover:     exp.hero_image_url ?? exp.gallery_image_urls?.[0] ?? null,
                          species:   exp.target_species ?? [],
                          priceText: formatPrice({ priceFrom: exp.price_from, priceType: exp.price_type, currency: exp.currency }),
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          {/* ─── RIGHT — contact card ───────────────────────── */}
          <aside
            className="w-full overflow-hidden lg:sticky lg:top-24 lg:w-[340px] lg:flex-none"
            style={{ borderRadius: 20, background: CREAM, border: `1px solid ${LINE}`, boxShadow: '0 18px 44px rgba(10,46,77,.10)' }}
            data-testid="guide-contact-card"
          >
            <div className={`${s.blur} ${s.nz} flex items-center gap-[14px]`} style={{ padding: '22px 24px' }}>
              <Avatar guide={guide} size={60} radius="50%" border="3px solid rgba(255,255,255,.8)" />
              <div className="flex min-w-0 flex-col gap-[3px]">
                <h3 className="f-display" style={{ margin: 0, fontWeight: 700, fontSize: 19, lineHeight: 1.2, color: '#FFFFFF' }}>{guide.full_name}</h3>
                <span className="f-body text-[14px]" style={{ color: ON_DARK_SOFT }}>{place}</span>
              </div>
            </div>
            <div className="flex flex-col gap-[18px]" style={{ padding: '20px 24px 24px' }}>
              <div className="flex gap-3">
                {cardStats.map(stat => (
                  <div key={stat.label} className="flex flex-[1_1_0] flex-col gap-[3px]">
                    <span className="f-body text-[11px] font-bold uppercase" style={{ letterSpacing: '.1em', color: MUTED }}>{stat.label}</span>
                    <span className="f-body text-[15.5px] font-bold" style={{ color: NAVY }}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* One trip → its page only; several → the list and the newest; none → the list link alone (tj, 2026-11-18). */}
              <div className="flex flex-col gap-[10px]" data-testid="guide-card-buttons">
                {guideExperiences.length !== 1 && (
                  <Link href="#experiences" className="f-body" style={{ ...primaryButtonStyle, minHeight: 50 }}>View trips</Link>
                )}
                {newestTrip != null && (
                  <Link href={`/experiences/${newestTrip.slug}`} className="f-body" style={{ ...primaryButtonStyle, minHeight: 50, background: CREAM, color: NAVY }}>
                    Show the trip
                  </Link>
                )}
              </div>

              {(guide.instagram_url != null || guide.youtube_url != null || guide.facebook_url != null || guide.website_url != null) && (
                <div className="flex flex-col">
                  {guide.instagram_url != null && (
                    <a href={guide.instagram_url} target="_blank" rel="noopener noreferrer" className={socialLinkClass} style={{ color: NAVY, textDecoration: 'none' }}>
                      <SocialIcon>IG</SocialIcon>
                      <span className="truncate">{guide.instagram_url.replace('https://instagram.com/', '@')}</span>
                    </a>
                  )}
                  {guide.youtube_url != null && (
                    <a href={guide.youtube_url} target="_blank" rel="noopener noreferrer" className={socialLinkClass} style={{ color: NAVY, textDecoration: 'none' }}>
                      <SocialIcon>YT</SocialIcon>
                      <span className="truncate">YouTube channel</span>
                    </a>
                  )}
                  {guide.facebook_url != null && (
                    <a href={guide.facebook_url} target="_blank" rel="noopener noreferrer" className={socialLinkClass} style={{ color: NAVY, textDecoration: 'none' }}>
                      <SocialIcon>FB</SocialIcon>
                      <span className="truncate">Facebook page</span>
                    </a>
                  )}
                  {guide.website_url != null && (
                    <a href={guide.website_url} target="_blank" rel="noopener noreferrer" className={socialLinkClass} style={{ color: NAVY, textDecoration: 'none' }}>
                      <SocialIcon>WWW</SocialIcon>
                      <span className="truncate">{guide.website_url.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
              )}

              {(guide.verified_at != null || policy != null) && (
                <div className="flex flex-col gap-[10px] pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
                  {guide.verified_at != null && (
                    <p className="f-body m-0 flex items-center gap-2 text-[14px]" style={{ color: MUTED }}>
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                      Verified by FjordAnglers
                    </p>
                  )}
                  {policy != null && (
                    <p className="f-body m-0 flex flex-col gap-0.5">
                      <span className="text-[14.5px] font-bold" style={{ color: NAVY }}>{policy.label}</span>
                      <span className="text-[14px]" style={{ color: MUTED }}>{policy.detail}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
