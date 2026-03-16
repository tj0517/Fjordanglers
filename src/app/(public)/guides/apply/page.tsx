import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ApplyForm } from '@/components/guides/apply-form'
import { HomeNav } from '@/components/home/home-nav'

export const metadata: Metadata = {
  title: 'Join as a Guide',
  description: 'Apply to become a verified FjordAnglers guide and reach anglers from across Europe.',
}

export default function GuideApplyPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <HomeNav />

      {/* ─── LEFT — photo hero ───────────────────────────────────── */}
      <div className="relative md:sticky md:top-0 md:h-screen md:w-1/2 flex-shrink-0 overflow-hidden" style={{ minHeight: '420px' }}>

        <Image
          src="/vanern.jpg"
          alt="Fjord fishing"
          fill
          priority
          className="object-cover object-center"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'rgba(5,10,20,0.52)' }} />

        {/* Content */}
        <div className="relative flex flex-col justify-end h-full px-10 pb-14" style={{ zIndex: 2 }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-px" style={{ background: '#E67E50' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
              For Guides
            </p>
          </div>

          <h1 className="text-white font-bold f-display" style={{ fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.08 }}>
            Reach anglers
            <span className="block" style={{ fontStyle: 'italic', color: '#E67E50' }}>from across Europe.</span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed f-body" style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '360px' }}>
            Join our verified network of Scandinavian fishing guides. Fill in the form and we&apos;ll be in touch within 48 hours.
          </p>

          {/* Trust chips */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['✓ Verified within 48h', '🌍 Anglers from 20+ countries', '€ You set your price'].map(t => (
              <span
                key={t}
                className="text-[11px] f-body px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {t}
              </span>
            ))}
          </div>

          <Link
            href="/guides"
            className="inline-flex items-center gap-2 text-xs font-semibold f-body mt-10 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            ← Back to Guides
          </Link>
        </div>
      </div>

      {/* ─── RIGHT — form ────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-24 md:px-12"
        style={{ background: '#FDFAF7' }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <h2 className="f-display font-bold mb-1" style={{ fontSize: '28px', color: '#0A2E4D' }}>
            Apply to join
          </h2>
          <p className="f-body text-sm mb-8" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Takes less than 2 minutes.
          </p>

          <ApplyForm />
        </div>
      </div>

    </div>
  )
}
