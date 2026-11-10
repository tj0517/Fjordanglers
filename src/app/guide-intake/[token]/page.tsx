import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormByToken } from '@/actions/guide-forms'
import { IntakeFormClient } from './IntakeFormClient'
import { SITE_URL } from '@/lib/site'

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  robots: { index: false },
}

export default async function GuideIntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const form = await getFormByToken(token)

  // Unknown, expired and inactive links alike (FA-1.91 D1).
  if (form == null) notFound()

  return (
    <main style={{ background: '#F8FAFB', minHeight: '100vh' }}>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{ background: '#0A2E4D' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="FjordAnglers">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${SITE_URL}/brand/white-logo.png`}
              alt="FjordAnglers"
              style={{ height: '28px', width: 'auto' }}
            />
          </Link>
          <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Guide Intake Form
          </span>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{ background: '#0A2E4D', paddingBottom: '48px' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-0">
          <p className="text-sm font-semibold f-body mb-2" style={{ color: '#E67E50' }}>
            FjordAnglers
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold f-display" style={{ color: '#FFFFFF', lineHeight: '1.2' }}>
            {form.title}
          </h1>
          {form.description != null && form.description.trim() !== '' && (
            <p className="text-sm f-body mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '480px' }}>
              {form.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6" style={{ marginTop: '-24px', paddingBottom: '60px' }}>
        <IntakeFormClient form={form} />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="pb-8 text-center">
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
          FjordAnglers. Independent guides in Iceland, Scandinavia, Patagonia and New Zealand.
        </p>
      </div>

    </main>
  )
}
