'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { acceptGuideTerms } from '@/actions/dashboard'
import { FileText, Shield, Cookie, Info, Check, Loader2 } from 'lucide-react'

interface TermsGateProps {
  /** If true the modal is hidden entirely — guide already accepted. */
  termsAccepted: boolean
  /** Current value of photo_marketing_consent from the DB. */
  initialMarketingConsent: boolean
}

export function TermsGate({ termsAccepted, initialMarketingConsent }: TermsGateProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agreed, setAgreed] = useState(false)
  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Local flag — hides the modal immediately after success without waiting
  // for the parent Server Component to re-render with termsAccepted=true.
  const [accepted, setAccepted] = useState(false)

  // Guide already accepted — nothing to show
  if (termsAccepted || accepted) return null

  function handleSubmit() {
    if (!agreed) {
      setAgreed(false)
      setError('You must accept the Terms of Use and Privacy Policy to continue.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await acceptGuideTerms({
        marketingConsent: marketing ?? false,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      // Hide immediately — don't wait for the layout server component to re-render
      setAccepted(true)
      // Also refresh so the layout gets fresh data for subsequent navigations
      router.refresh()
    })
  }

  return (
    /* ── Backdrop ────────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,16,26,0.7)', backdropFilter: 'blur(6px)' }}
    >
      {/* ── Card ─────────────────────────────────────────────────────────────── */}
      <div
        className="w-full max-w-[520px] rounded-3xl overflow-hidden"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.1)',
          boxShadow: '0 24px 64px rgba(5,16,26,0.35)',
        }}
      >
        {/* ── Header band ──────────────────────────────────────────────────── */}
        <div
          className="px-8 pt-8 pb-6"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.26em] font-semibold mb-2 f-body"
            style={{ color: '#E67E50' }}
          >
            Before you start
          </p>
          <h2
            className="text-[#0A2E4D] text-2xl font-bold f-display leading-snug"
          >
            Please review and accept<br />our terms
          </h2>
          <p
            className="text-sm f-body mt-2 leading-relaxed"
            style={{ color: 'rgba(10,46,77,0.5)' }}
          >
            To use FjordAnglers you must agree to the documents below.
          </p>
        </div>

        <div className="px-8 py-6 flex flex-col gap-6">

          {/* ── Legal documents list ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            {[
              { icon: FileText, label: 'Terms of Use',   href: '/legal/terms-of-service' },
              { icon: Shield,   label: 'Privacy Notice', href: '/legal/privacy-policy' },
              { icon: Cookie,   label: 'Cookie Policy',  href: '/legal/cookie-policy' },
              { icon: Info,     label: 'Legal Notice',   href: '/legal/legal-notice' },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-[#0A2E4D]/[0.05] group"
                style={{ border: '1px solid rgba(10,46,77,0.09)' }}
              >
                <Icon
                  size={15}
                  strokeWidth={1.5}
                  style={{ color: '#E67E50' }}
                  className="flex-shrink-0"
                />
                <span
                  className="text-sm font-semibold f-body flex-1"
                  style={{ color: '#0A2E4D' }}
                >
                  {label}
                </span>
                <span
                  className="text-[11px] f-body transition-opacity group-hover:opacity-100 opacity-40"
                  style={{ color: '#0A2E4D' }}
                >
                  Open ↗
                </span>
              </Link>
            ))}
          </div>

          {/* ── Terms checkbox ───────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => { setAgreed(v => !v); setError(null) }}
            className="flex items-start gap-3 text-left w-full"
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
              style={{
                background: agreed ? '#0A2E4D' : 'transparent',
                border: `1.5px solid ${agreed ? '#0A2E4D' : 'rgba(10,46,77,0.25)'}`,
                marginTop: '1px',
              }}
            >
              {agreed && <Check size={11} strokeWidth={2.5} style={{ color: '#fff' }} />}
            </span>
            <span
              className="text-sm f-body leading-relaxed"
              style={{ color: 'rgba(10,46,77,0.68)' }}
            >
              I have read and accept the{' '}
              <span className="font-semibold" style={{ color: '#0A2E4D' }}>
                Terms of Use, Privacy Notice, Cookie Policy
              </span>
              {' '}and{' '}
              <span className="font-semibold" style={{ color: '#0A2E4D' }}>Legal Notice</span>.
            </span>
          </button>

          {/* ── Marketing consent ───────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(10,46,77,0.03)',
              border: '1px solid rgba(10,46,77,0.08)',
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.18em] font-bold mb-1 f-body"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              Optional
            </p>
            <p
              className="text-sm font-semibold mb-1 f-body"
              style={{ color: '#0A2E4D' }}
            >
              Marketing data consent
            </p>
            <p
              className="text-xs f-body leading-relaxed mb-4"
              style={{ color: 'rgba(10,46,77,0.55)' }}
            >
              May FjordAnglers use your profile, photos, and name for promotional
              purposes — such as on our website, Instagram, and advertising campaigns?
              You can change this at any time in Account settings.
            </p>
            <div className="flex gap-2">
              {[
                { value: true,  label: 'Yes, I allow' },
                { value: false, label: 'No thanks' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setMarketing(opt.value)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold f-body transition-all"
                  style={{
                    background: marketing === opt.value
                      ? (opt.value ? '#0A2E4D' : 'rgba(10,46,77,0.08)')
                      : 'transparent',
                    color: marketing === opt.value
                      ? (opt.value ? '#fff' : '#0A2E4D')
                      : 'rgba(10,46,77,0.45)',
                    border: `1.5px solid ${marketing === opt.value
                      ? (opt.value ? '#0A2E4D' : 'rgba(10,46,77,0.2)')
                      : 'rgba(10,46,77,0.12)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ───────────────────────────────────────────────────────── */}
          {error != null && (
            <p className="text-xs f-body text-red-500 -mt-2">{error}</p>
          )}

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <button
            type="button"
            disabled={pending || !agreed || marketing === null}
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold f-body text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: '#E67E50' }}
          >
            {pending ? (
              <>
                <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Accept and continue →'
            )}
          </button>

          <p
            className="text-[11px] f-body text-center leading-relaxed -mt-2"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            You must select a marketing consent option (yes or no) to proceed.
          </p>

        </div>
      </div>
    </div>
  )
}
