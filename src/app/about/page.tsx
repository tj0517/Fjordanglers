import Image from 'next/image'
import Link from 'next/link'
import { NavWithUser } from '@/components/layout/nav-with-user'
import { SiteFooter } from '@/components/layout/footer'
import { ExperienceGallery } from '@/components/trips/experience-gallery'

export const metadata = {
  title: 'Our Story — Who We Are',
  description: 'FjordAnglers was built by three Polish anglers who backpacked Norway, Sweden and Iceland with a rod. We only list guided fishing trips we\'d book ourselves.',
  alternates: { canonical: 'https://fjordanglers.com/about' },
  openGraph: { url: 'https://fjordanglers.com/about', type: 'website' },
}

const GALLERY_IMAGES = [
  { id: '1', url: '/about/gallery-1.jpg', is_cover: true },
  { id: '2', url: '/about/gallery-2.jpg', is_cover: false },
  { id: '3', url: '/about/gallery-3.jpg', is_cover: false },
  { id: '4', url: '/about/gallery-4.jpg', is_cover: false },
  { id: '5', url: '/about/gallery-5.jpg', is_cover: false },
]

const FOUNDERS = [
  {
    name:  'Tymon',
    role:  'CEO & Co-founder',
    line:  'Passionate angler and builder. The one who actually built the website you&apos;re looking at.',
    photo: '/about/tymon.jpg',
  },
  {
    name:  'Krzychu',
    role:  'Head of Fishing & Co-founder',
    line:  'The biggest fishing passionate of the group. The one who would fish every day if he could.',
    photo: '/about/krzychu.jpg',
  },
  {
    name:  'Lukas',
    role:  'Co-founder & Social Media Manager',
    line:  'The one who makes sure you see our photos on Instagram and keeps the vibe right.',
    photo: '/about/lukas.jpg',
  },
]

export default function AboutPage() {
  return (
    <>
      <NavWithUser />
      <main style={{ background: '#F3EDE4' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <section className="px-4 sm:px-8 md:px-14 lg:px-20 pt-28 md:pt-36 pb-12">
          <div className="max-w-[1200px] mx-auto">
            <p
              className="f-body font-semibold uppercase tracking-[0.18em] mb-6"
              style={{ fontSize: '11px', color: '#E67E50' }}
            >
              About FjordAnglers
            </p>
            <h1
              className="f-display font-bold"
              style={{
                fontSize: 'clamp(44px, 6vw, 88px)',
                lineHeight: 1.03,
                letterSpacing: '-0.02em',
                color: '#0A2E4D',
                maxWidth: '700px',
              }}
            >
              Three anglers.
              <br />
              <span style={{ fontStyle: 'italic', color: '#E67E50' }}>One obsession.</span>
            </h1>
          </div>
        </section>

        {/* ── Gallery ─────────────────────────────────────────────────── */}
        <section className="px-4 sm:px-8 md:px-14 lg:px-20 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto">
            <ExperienceGallery images={GALLERY_IMAGES} title="FjordAnglers" />
          </div>
        </section>

        {/* ── Story ───────────────────────────────────────────────────── */}
        <section className="px-4 sm:px-8 md:px-14 lg:px-20 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Left: pull quote */}
            <div>
              <div className="w-8 h-px mb-8" style={{ background: '#E67E50' }} />
              <p
                className="f-display font-bold"
                style={{
                  fontSize: 'clamp(22px, 2.4vw, 30px)',
                  lineHeight: 1.35,
                  color: '#0A2E4D',
                  letterSpacing: '-0.01em',
                }}
              >
                "We&apos;ve slept in tents on Norwegian coastlines with rods propped against the tent. We know the water. We found the guides who know it even better."
              </p>
            </div>

            {/* Right: story text */}
            <div className="flex flex-col gap-5" style={{ paddingTop: '28px' }}>
              <p className="f-body" style={{ fontSize: '16px', color: 'rgba(10,46,77,0.6)', lineHeight: 1.85 }}>
                We&apos;re students from Gdańsk who&apos;ve been backpacking Nordic countires every summer we could - with rods, sleeping in tents. Not package tours. We fell in love with Nordic nature the hard way: figuring it out ourselves.
              </p>
              <p className="f-body" style={{ fontSize: '16px', color: 'rgba(10,46,77,0.6)', lineHeight: 1.85 }}>
                The problem is real: when you&apos;re surrounded by hundreds of rivers, lakes, and miles of coastline, knowing where to fish — and when — is everything. Without local knowledge, you&apos;re guessing. So we started reaching out to local guides cold — some found us first — and built a list of the ones we&apos;d actually book ourselves.
              </p>
              <p className="f-body" style={{ fontSize: '16px', color: 'rgba(10,46,77,0.6)', lineHeight: 1.85 }}>
                Every trip we list is one we&apos;d go on ourselves. We don&apos;t force a lodge package on you — if you want to fly in and stay in a cabin for a week, we have that. If you want to backpack the country and just hire a guide for a day to learn the water and catch something serious, we have that too. You choose how you travel. We just make sure the guide is worth it.
              </p>
            </div>

          </div>
        </section>

        {/* ── Founders ────────────────────────────────────────────────── */}
        <section
          className="px-4 sm:px-8 md:px-14 lg:px-20 py-16 md:py-24"
          style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
        >
          <div className="max-w-[1200px] mx-auto">

            <p
              className="f-body font-semibold uppercase tracking-[0.18em] mb-14"
              style={{ fontSize: '11px', color: '#E67E50' }}
            >
              Who we are
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-10">
              {FOUNDERS.map(f => (
                <div key={f.name}>
                  {/* Photo */}
                  <div
                    className="relative w-full overflow-hidden mb-5"
                    style={{ aspectRatio: '4/5', borderRadius: '14px', background: 'rgba(10,46,77,0.06)' }}
                  >
                    <Image
                      src={f.photo}
                      alt={f.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                    <div
                      className="absolute inset-0 flex items-end p-4"
                      style={{ border: '1px dashed rgba(10,46,77,0.12)' }}
                    >
                      <span className="f-body text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: 'rgba(10,46,77,0.18)' }}>
                        Photo
                      </span>
                    </div>
                  </div>

                  {/* Text */}
                  <p className="f-display font-bold text-[20px]" style={{ color: '#0A2E4D' }}>{f.name}</p>
                  <p className="f-body font-semibold uppercase tracking-[0.13em] mt-1 mb-3" style={{ fontSize: '10px', color: '#E67E50' }}>
                    {f.role}
                  </p>
                  <p className="f-body" style={{ fontSize: '13px', color: 'rgba(10,46,77,0.5)', lineHeight: 1.75 }}>
                    {f.line}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── Footer strip ────────────────────────────────────────────── */}
        <div
          className="px-4 sm:px-8 md:px-14 lg:px-20 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
        >
          <p className="f-body text-[13px]" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Questions? We reply within 24 hours — in Polish, English or German.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="mailto:contact@fjordanglers.com"
              className="f-body text-[13px] font-medium transition-colors hover:text-[#E67E50]"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              contact@fjordanglers.com
            </a>
            <Link
              href="/trips"
              className="f-body text-[13px] font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110"
              style={{ background: '#E67E50', color: '#fff' }}
            >
              Browse trips →
            </Link>
          </div>
        </div>

      </main>
      <SiteFooter />
    </>
  )
}
