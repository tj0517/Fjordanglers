// preview/main
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getFeaturedExperiences, getSpeciesCounts, getFeaturedGuides } from '@/lib/supabase/queries'
import type { FeaturedGuide } from '@/lib/supabase/queries'
import { HomeFaq } from '@/components/home/home-faq'
import { FISH_CATALOG } from '@/lib/fish'
import { CountryFlag } from '@/components/ui/country-flag'
import { SpeciesSlider } from '@/components/home/species-slider'
import { ExperiencesSlider } from '@/components/home/experiences-slider'
import { HomeNav } from '@/components/home/home-nav'
import { BgVideo } from '@/components/home/bg-video'
import { Footer } from '@/components/layout/footer'

export const dynamic = 'force-dynamic'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Destination editorial content — taglines curatorial, counts come from DB
const DESTINATIONS = [
  {
    country: 'Norway',
    tagline: 'Barents Sea, Voss salmon, Lofoten halibut.',
    detail: 'Sea & river fly fishing · May to September',
    bg: 'linear-gradient(160deg, #071824 0%, #0D2E47 100%)',
  },
  {
    country: 'Sweden',
    tagline: "Brown trout and grayling in Lapland's forests. Silence you won't find in Central Europe.",
    detail: 'Fly fishing · June to August',
    bg: 'linear-gradient(160deg, #071410 0%, #0E2C1A 100%)',
  },
  {
    country: 'Iceland',
    tagline: 'Atlantic salmon and sea trout on rivers only the initiated fish.',
    detail: 'Salmon & sea trout · July to September',
    bg: 'linear-gradient(160deg, #141018 0%, #221C30 100%)',
  },
  {
    country: 'Finland',
    tagline: 'Taimen, grayling and pike in the land of a thousand lakes.',
    detail: 'Freshwater fly fishing · May to October',
    bg: 'linear-gradient(160deg, #071410 0%, #101C10 100%)',
  },
]

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Tell us what you\'re looking for',
    body: 'Fill in a short form: target species, region, dates, budget, style. Takes 3 minutes.',
  },
  {
    n: '02',
    title: 'We find your guide',
    body: 'Tymon and Krzychu read your brief, call 1–2 of our guides, and check availability. 24–48 hours.',
  },
  {
    n: '03',
    title: 'You get a concrete offer',
    body: 'A specific guide, a specific river or boat, a specific price. No asterisks. Accept or ask further.',
  },
  {
    n: '04',
    title: 'You fish',
    body: "From this point you have direct contact with your guide. We're in the background if anything goes wrong.",
  },
]

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [featured, speciesCounts, featuredGuides] = await Promise.all([
    getFeaturedExperiences(8),
    getSpeciesCounts(),
    getFeaturedGuides(6),
  ])

  const species = FISH_CATALOG.map(s => ({ ...s, count: speciesCounts[s.slug] ?? 0 }))


  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      <HomeNav />

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <section className="relative" style={{ height: '100vh', minHeight: '640px' }}>
        <Image src="/hero.jpg" alt="" fill priority className="object-cover object-center" />
        <BgVideo
          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/bg-cta.mp4`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay — navy-tinted gradient top + bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,46,77,0.60) 0%, rgba(4,10,20,0.10) 35%, rgba(4,10,20,0.20) 60%, rgba(10,46,77,0.80) 100%)',
            zIndex: 1,
          }}
        />


        {/* ── Centred text block ─────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-5"
          style={{ zIndex: 3, paddingBottom: 'clamp(220px, 28vh, 300px)' }}
        >
          {/* Eyebrow */}
          <p
            className="f-body font-semibold uppercase tracking-[0.14em] mb-5 px-4 py-1.5 rounded-full"
            style={{ fontSize: '12px', color: '#E67E50', background: 'rgba(230,126,80,0.12)', border: '1px solid rgba(230,126,80,0.25)' }}
          >
            Guided fishing in Scandinavia
          </p>

          <h1
            className="f-display font-bold text-white"
            style={{ fontSize: 'clamp(32px, 4vw, 64px)', lineHeight: 1.06, letterSpacing: '-0.02em', maxWidth: '860px' }}
          >
            Catch the fish of your life.
            <br />
            <span style={{ color: '#E67E50' }}>In the wild North.</span>
          </h1>
          <p
            className="f-body mt-5 max-w-[460px]"
            style={{ fontSize: 'clamp(14px, 1.4vw, 17px)', color: 'rgba(255,255,255,0.60)', lineHeight: 1.75 }}
          >
            Guided fishing trips across Norway, Sweden and Iceland — hand-picked local guides, real rivers, no tourist routes.
          </p>
          <Link
            href="/trips"
            className="f-body font-semibold mt-8 transition-all hover:brightness-110 active:scale-[0.97]"
            style={{ background: '#E67E50', color: '#fff', fontSize: '15px', padding: '14px 40px', borderRadius: '999px' }}
          >
            Explore trips →
          </Link>
        </div>

        {/* ── Bottom stat cards ─────────────────────────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 md:px-8 lg:px-14 pb-8 md:pb-12"
          style={{ zIndex: 3 }}
        >
          <div className="max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {([
              {
                stat:  '20+',
                title: 'Verified Nordic Guides',
                desc:  'Every guide is personally tested — we waded the rivers with them before they appeared on this site.',
              },
              {
                stat:  '4',
                title: 'Countries. One operator.',
                desc:  'Norway, Sweden, Iceland and Finland. The best salmon, trout and sea fishing in Europe, curated in one place.',
              },
              {
                stat:  '24h',
                title: 'Personal Response',
                desc:  'Every inquiry is read and answered by a real person. No bots, no templates — within 24 hours.',
              },
            ] as const).map(card => (
              <div
                key={card.stat}
                className="px-6 py-7 md:px-8 md:py-8"
                style={{
                  background:           'rgba(10,46,77,0.55)',
                  backdropFilter:       'blur(22px)',
                  WebkitBackdropFilter: 'blur(22px)',
                  border:               '1px solid rgba(255,255,255,0.08)',
                  borderTop:            '1px solid rgba(230,126,80,0.30)',
                  borderRadius:         '16px',
                }}
              >
                <p
                  className="f-display font-bold mb-2"
                  style={{ fontSize: 'clamp(34px, 3.5vw, 50px)', lineHeight: 1, color: '#E67E50' }}
                >
                  {card.stat}
                </p>
                <p className="f-body font-semibold text-white mb-2" style={{ fontSize: '15px' }}>
                  {card.title}
                </p>
                <p className="f-body" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* All sections below slide OVER the sticky hero */}
      <div className="relative" style={{ zIndex: 1 }}>

      {/* ─── S2: POSITIONING STATEMENT ───────────────────────────────── */}
      <section style={{ background: '#07111C' }}>

        <div className="relative px-4 md:px-8 lg:px-14 py-20 md:py-32" style={{ zIndex: 3 }}>
          <div className="max-w-[1360px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

              {/* Left: headline */}
              <div>
                <div className="w-10 h-px mb-10" style={{ background: '#E67E50' }} />
                <h2
                  className="f-display font-bold text-white"
                  style={{ fontSize: 'clamp(32px, 4.5vw, 58px)', lineHeight: 1.1 }}
                >
                  We&apos;re not a travel agency.
                  <br />
                  <span style={{ fontStyle: 'italic', color: '#E67E50' }}>We&apos;re anglers who found their people.</span>
                </h2>
              </div>

              {/* Right: prose */}
              <div className="flex flex-col justify-center gap-7">
                <p className="f-body leading-relaxed" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.9 }}>
                  FjordAnglers started because we went through the same thing you&apos;re going through — we wanted to fish the Lofoten but didn&apos;t know who to trust. We found those people. Twenty guides across Norway, Sweden, and Iceland that we waded rivers with before they ever appeared on this site.
                </p>
                <p className="f-body leading-relaxed" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.9 }}>
                  We don&apos;t package you a &ldquo;Lofoten 7-day all-inclusive&rdquo;. We listen to what you want to catch and how you want to experience it. Then we call the right guide. It takes two days instead of two clicks — and that&apos;s why it works.
                </p>
              </div>
            </div>

            {/* Founders signature */}
            <div className="mt-16 pt-8 flex items-center gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex -space-x-2">
                {['T','K','L'].map((initial, i) => (
                  <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold f-body text-white flex-shrink-0" style={{ background: i === 0 ? '#E67E50' : i === 1 ? '#0A2E4D' : '#1a4a6b', border: '2px solid rgba(255,255,255,0.12)' }}>
                    {initial}
                  </div>
                ))}
              </div>
              <p className="f-body text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                — Tymon, Krzychu &amp; Lukas &nbsp;·&nbsp; Founders
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EXPERIENCES SLIDER ───────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-14 md:py-20" style={{ background: '#F3EDE4' }}>

          {/* Header row */}
          <div className="px-4 md:px-8 lg:px-14 mb-3">
            <div className="max-w-[1360px] mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-px" style={{ background: '#E67E50' }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
                  Our experiences
                </p>
              </div>
              <h2
                className="f-display font-bold text-[#0A2E4D]"
                style={{ fontSize: 'clamp(24px, 3vw, 40px)', lineHeight: 1.1 }}
              >
                Trips you can book.
              </h2>
            </div>
          </div>

          {/* Slider — arrows + track inside component */}
          <div className="relative mt-6">
            <ExperiencesSlider experiences={featured} />
            {/* Right fade */}
            <div
              className="absolute top-0 right-0 bottom-0 pointer-events-none"
              style={{ width: '80px', background: 'linear-gradient(to left, #F3EDE4, transparent)' }}
            />
          </div>

        </section>
      )}

      {/* ─── S3: HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="pb-4" style={{ background: '#F3EDE4' }}>
        <div className="relative overflow-hidden" style={{ background: '#07111C' }}>

          <div className="relative px-4 md:px-8 lg:px-14 py-16 md:py-24" style={{ zIndex: 3 }}>
            <div className="max-w-[1360px] mx-auto">

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-px" style={{ background: '#E67E50' }} />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>How it works</p>
                  </div>
                  <h2 className="text-white font-bold f-display" style={{ fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.08 }}>
                    Not Booking.com.<br />
                    <span style={{ fontStyle: 'italic', color: '#E67E50' }}>Better than going alone.</span>
                  </h2>
                </div>
                <p className="text-sm f-body md:text-right md:max-w-[260px]" style={{ color: 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>
                  The same process in Norway, Sweden, Iceland and Finland — personal, not automated.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {HOW_IT_WORKS.map(item => (
                  <div
                    key={item.n}
                    className="relative overflow-hidden flex flex-col justify-between"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2rem', minHeight: '220px' }}
                  >
                    <span aria-hidden="true" className="absolute bottom-0 right-4 font-bold select-none pointer-events-none f-display" style={{ fontSize: '108px', lineHeight: 0.85, color: 'rgba(230,126,80,0.08)', fontStyle: 'italic' }}>
                      {item.n}
                    </span>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold f-body flex-shrink-0 self-start" style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}>
                      {item.n}
                    </span>
                    <div className="relative mt-6" style={{ zIndex: 1 }}>
                      <h3 className="text-white font-bold mb-2 f-display" style={{ fontSize: '17px' }}>{item.title}</h3>
                      <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.38)' }}>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center mt-12">
                <Link href="/trips" className="flex items-center gap-2 text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:brightness-110 active:scale-[0.97] f-body" style={{ background: '#E67E50', color: '#fff' }}>
                  Plan my trip <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── S4: DESTINATIONS ─────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-14 py-20 md:py-28" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1360px] mx-auto">
          <div className="text-center mb-14">
            <div className="w-10 h-px mx-auto mb-6" style={{ background: '#E67E50' }} />
            <h2 className="f-display font-bold text-[#0A2E4D]" style={{ fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 1.1 }}>
              Four countries. Wild waters.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {DESTINATIONS.map(dest => (
              <Link key={dest.country} href={`/trips?country=${dest.country}`} className="group block">
                <div
                  className="relative overflow-hidden"
                  style={{ height: '460px', borderRadius: '20px', background: dest.bg }}
                >
                  {/* Background photo from /public/{country}.jpg */}
                  <Image
                    src={`/${dest.country.toLowerCase()}.jpg`}
                    alt={dest.country}
                    fill
                    sizes="(max-width:768px) 100vw, (max-width:1280px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  {/* Overlay */}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(4,10,20,0.82) 0%, rgba(4,10,20,0.20) 60%, transparent 100%)' }}
                  />
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6" style={{ zIndex: 2 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <CountryFlag country={dest.country} />
                      <span className="f-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#E67E50' }}>
                        {dest.country}
                      </span>
                    </div>
                    <h3 className="f-display font-bold text-white" style={{ fontSize: '18px', lineHeight: 1.3 }}>
                      {dest.tagline}
                    </h3>
                    <span
                      className="inline-block mt-4 f-body text-xs font-semibold transition-colors group-hover:text-[#E67E50]"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      Explore →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── S5: MEET THE GUIDES ──────────────────────────────────────── */}
      {featuredGuides.length > 0 && (
        <section className="px-4 md:px-8 lg:px-14 py-20 md:py-28" style={{ background: '#F3EDE4' }}>
          <div className="max-w-[1360px] mx-auto">

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>The people behind it</p>
                <h2 className="text-[#0A2E4D] font-bold f-display" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)' }}>
                  People you&apos;ll fish with.
                </h2>
                <p className="f-body mt-3 max-w-[400px]" style={{ fontSize: '15px', color: 'rgba(10,46,77,0.48)', lineHeight: 1.7 }}>
                  Every one of them we know personally. Some for years.
                </p>
              </div>
              <Link href="/guides" className="hidden md:block text-sm font-medium f-body hover:text-[#E67E50] transition-colors" style={{ color: 'rgba(10,46,77,0.38)' }}>
                All guides →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredGuides.map((guide: FeaturedGuide, idx) => (
                <Link key={guide.id} href={`/guides/${guide.id}`} className="group block">
                  <div className="relative overflow-hidden" style={{ borderRadius: '16px', aspectRatio: '3/4', background: '#0A2E4D' }}>
                    {guide.avatar_url != null ? (
                      <Image src={guide.avatar_url} alt={guide.full_name} fill priority={idx < 2} className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center f-display font-bold text-white" style={{ fontSize: '32px', opacity: 0.3 }}>
                        {guide.full_name[0]}
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.80) 0%, rgba(5,10,20,0.10) 55%, transparent 100%)' }} />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="f-display font-bold text-white leading-tight" style={{ fontSize: '13px' }}>{guide.full_name}</p>
                      <p className="f-body text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <CountryFlag country={guide.country} /> {guide.city ?? guide.country}
                      </p>
                      {Array.isArray(guide.fish_expertise) && guide.fish_expertise[0] != null && (
                        <p className="f-body text-[10px] mt-1" style={{ color: '#E67E50' }}>{(guide.fish_expertise as string[])[0]}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex justify-center mt-10">
              <Link href="/guides" className="flex items-center gap-2 text-sm font-semibold px-8 py-3.5 rounded-full border transition-all hover:bg-[#0A2E4D] hover:text-white hover:border-[#0A2E4D] f-body" style={{ borderColor: 'rgba(10,46,77,0.2)', color: '#0A2E4D' }}>
                Meet all guides <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── BROWSE BY SPECIES ────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-14 pb-16 md:pb-24" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1360px] mx-auto">
          <div className="mb-8 md:mb-11 pt-12 md:pt-20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4" style={{ borderTop: '1px solid rgba(10,46,77,0.09)' }}>
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>Browse by species</p>
              <h2 className="text-[#0A2E4D] font-bold f-display" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)' }}>
                What are you<span style={{ fontStyle: 'italic' }}> after?</span>
              </h2>
            </div>
            <Link href="/trips" className="hidden md:block text-sm font-medium hover:text-[#E67E50] transition-colors f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              View all trips →
            </Link>
          </div>
          <SpeciesSlider species={species} />
        </div>
      </section>

      {/* ─── S8: FAQ ──────────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 lg:px-14 py-20 md:py-28" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1360px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
            <div>
              <div className="w-10 h-px mb-6" style={{ background: '#E67E50' }} />
              <h2 className="f-display font-bold text-[#0A2E4D]" style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', lineHeight: 1.12 }}>
                Questions<br />before you write.
              </h2>
              <p className="f-body mt-5" style={{ fontSize: '15px', color: 'rgba(10,46,77,0.48)', lineHeight: 1.75 }}>
                If yours isn&apos;t here, just ask. We reply within 24 hours — in Polish, English, or German.
              </p>
            </div>
            <div className="lg:col-span-2">
              <HomeFaq />
            </div>
          </div>
        </div>
      </section>

      {/* ─── S9: FINAL CTA ────────────────────────────────────────────── */}
      <section style={{ background: '#F3EDE4' }}>
        <div className="relative overflow-hidden" style={{ minHeight: '580px' }}>
          <Image src="/hero.jpg" alt="" fill className="object-cover object-center" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(4,12,22,0.70) 0%, rgba(4,12,22,0.55) 100%)' }} />
  
          <div className="relative flex flex-col items-center justify-center text-center px-4 py-24 md:py-36" style={{ zIndex: 3, minHeight: '580px' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>Season 2026</p>
            <h2 className="f-display font-bold text-white max-w-[680px]" style={{ fontSize: 'clamp(32px, 5vw, 66px)', lineHeight: 1.08 }}>
              The next season starts in May.
            </h2>
            <p className="f-body mt-5 max-w-[460px]" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.52)', lineHeight: 1.8 }}>
              The best guides fill their calendars by January. Write before they do.
            </p>
            <Link
              href="/trips"
              className="inline-flex items-center gap-2 mt-10 font-semibold px-10 py-4 rounded-full text-base transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
              style={{ background: '#E67E50', color: '#fff' }}
            >
              Plan my trip <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <p className="f-body mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              We reply within 24 hours. In Polish, English or German.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <Footer />

      </div>{/* end scroll-over wrapper */}

    </div>
  )
}
