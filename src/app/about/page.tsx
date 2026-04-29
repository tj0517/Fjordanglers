import Image from 'next/image'
import Link from 'next/link'
import { HomeNav } from '@/components/home/home-nav'
import { Footer } from '@/components/layout/footer'
import { ExperienceGallery } from '@/components/trips/experience-gallery'

export const metadata = {
  title: 'About — FjordAnglers',
  description: 'Three anglers from Gdańsk who built what they actually wanted.',
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
    role:  'Co-founder',
    line:  'Grew up on Polish rivers. First Norway trip — wrong flies, zero fish. Never stopped going back.',
    photo: '/about/tymon.jpg',
  },
  {
    name:  'Krzychu',
    role:  'Co-founder',
    line:  'Fly fishing obsessive. Seven countries, keeps a spreadsheet of every hatch.',
    photo: '/about/krzychu.jpg',
  },
  {
    name:  'Lukas',
    role:  'Co-founder',
    line:  'Handles guide relationships and quality control. The one who reads the regulations.',
    photo: '/about/lukas.jpg',
  },
]

export default function AboutPage() {
  return (
    <>
      <HomeNav pinned initialVariant="light" />

      <main style={{ background: '#F3EDE4' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <section className="px-5 md:px-14 lg:px-20 pt-28 md:pt-36 pb-12">
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
        <section className="px-5 md:px-14 lg:px-20 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto">
            <ExperienceGallery images={GALLERY_IMAGES} title="FjordAnglers" />
          </div>
        </section>

        {/* ── Story ───────────────────────────────────────────────────── */}
        <section className="px-5 md:px-14 lg:px-20 pb-20 md:pb-28">
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
                "We drove 24 hours to Norway to fish with a guide who'd never seen a salmon."
              </p>
            </div>

            {/* Right: story text */}
            <div className="flex flex-col gap-5" style={{ paddingTop: '28px' }}>
              <p className="f-body" style={{ fontSize: '16px', color: 'rgba(10,46,77,0.6)', lineHeight: 1.85 }}>
                It was 2023. Three students from Gdańsk, one car, one rod each. We booked through a travel agency. The guide arrived late, didn't know the river, and spent most of the day on his phone. Zero fish.
              </p>
              <p className="f-body" style={{ fontSize: '16px', color: 'rgba(10,46,77,0.6)', lineHeight: 1.85 }}>
                We drove home with one question we couldn't shake: why is there no alternative? So we started calling guides directly — fishing with them, building relationships. FjordAnglers is still a small list. Not a platform. Twenty guides we know personally, across four countries we love.
              </p>
            </div>

          </div>
        </section>

        {/* ── Founders ────────────────────────────────────────────────── */}
        <section
          className="px-5 md:px-14 lg:px-20 py-16 md:py-24"
          style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
        >
          <div className="max-w-[1200px] mx-auto">

            <p
              className="f-body font-semibold uppercase tracking-[0.18em] mb-14"
              style={{ fontSize: '11px', color: '#E67E50' }}
            >
              Who we are
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-10">
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
          className="px-5 md:px-14 lg:px-20 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
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

        <Footer />

      </main>
    </>
  )
}
