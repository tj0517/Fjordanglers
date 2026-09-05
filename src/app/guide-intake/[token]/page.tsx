import Link from 'next/link'
import { getFormByToken } from '@/actions/guide-forms'
import { IntakeFormClient } from './IntakeFormClient'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuideIntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const form = await getFormByToken(token)

  // ── Closed or not found ────────────────────────────────────────────────────
  if (form == null) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F8FAFB' }}>
        <div className="max-w-md w-full text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(10,46,77,0.06)' }}>
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Form not found
          </h1>
          <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.55)' }}>
            This link is no longer active or doesn&apos;t exist.
            Please contact FjordAnglers directly if you think this is a mistake.
          </p>
          <a
            href="mailto:contact@fjordanglers.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
            style={{ background: '#E67E50', color: '#fff' }}
          >
            Contact FjordAnglers
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: '#F8FAFB', minHeight: '100vh' }}>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{ background: '#0A2E4D' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="FjordAnglers">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://fjordanglers.com/brand/white-logo.png"
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
