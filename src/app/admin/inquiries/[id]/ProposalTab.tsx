'use client'

import { useState, useTransition, useCallback } from 'react'
import { saveRichOffer } from '@/actions/inquiries'
import type { GuideOption } from '@/actions/inquiries'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CUR: Record<string, string> = { EUR: '€', USD: '$', ISK: 'kr' }
const sym = (c?: string | null) => CUR[c ?? 'EUR'] ?? '€'

function totalForOption(opt: GuideOption): number {
  return (Number(opt.guide_price ?? 0)) + (Number(opt.license_price ?? 0))
}

function suggestedTotal(opts: GuideOption[]): number {
  if (opts.length === 0) return 0
  // Use first option as default suggestion
  return totalForOption(opts[0])
}

const inputCls: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 13,
  color: '#FFFFFF',
  outline: 'none',
  fontFamily: 'inherit',
}

const labelCls: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 6,
}

// ─── Guide option card (improved display) ─────────────────────────────────────

function OptionCard({ opt, index }: { opt: GuideOption; index: number }) {
  const allSpecies = [
    ...(Array.isArray(opt.species) ? opt.species : []),
  ]
  const currency = opt.currency ?? 'EUR'
  const s = sym(currency)
  const guideP   = opt.guide_price   != null ? Number(opt.guide_price)   : null
  const licenseP = opt.license_price != null ? Number(opt.license_price) : null
  const total    = (guideP ?? 0) + (licenseP ?? 0)
  const photos   = Array.isArray(opt.photos) ? opt.photos : []

  return (
    <div
      className="rounded-[22px] overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      {/* Photo strip */}
      {photos.length > 0 && (
        <div className="flex gap-1 p-2 overflow-x-auto"
          style={{ background: 'rgba(10,46,77,0.03)' }}>
          {photos.map((url, pi) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={pi}
              src={url}
              alt=""
              className="flex-shrink-0 rounded-xl object-cover"
              style={{ width: 120, height: 80, border: '1px solid rgba(10,46,77,0.07)' }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-0.5"
              style={{ color: 'rgba(10,46,77,0.38)' }}>Option {index + 1}</p>
            <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
              {opt.spot || 'Unnamed spot'}
            </p>
          </div>
          {total > 0 && (
            <div className="flex-shrink-0 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(230,126,80,0.1)', border: '1px solid rgba(230,126,80,0.2)' }}>
              <p className="text-sm font-bold f-body" style={{ color: '#C05A2E' }}>
                {s}{total.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Species chips */}
        {allSpecies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allSpecies.map(sp => (
              <span key={sp}
                className="text-[10px] font-bold f-body px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(230,126,80,0.1)', color: '#C05A2E', border: '1px solid rgba(230,126,80,0.2)' }}>
                {sp}
              </span>
            ))}
          </div>
        )}

        {/* Price breakdown */}
        {(guideP != null || licenseP != null) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 py-2.5 px-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}>
            {guideP != null && (
              <p className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                Guide fee: <strong>{s}{guideP.toLocaleString()}</strong>
              </p>
            )}
            {licenseP != null && (
              <p className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                License: <strong>{s}{licenseP.toLocaleString()}</strong>
              </p>
            )}
            {guideP != null && licenseP != null && (
              <p className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                Total: {s}{total.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {opt.description != null && opt.description.trim() !== '' && (
          <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
            {opt.description}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inquiryId:          string
  anglerName:         string
  experienceTitle:    string | null
  guideOptions:       GuideOption[]
  guideFinalDates:    string | null
  // existing offer (from previous saveRichOffer call)
  existingToken:      string | null
  existingTotalEur:   number | null
  existingDepositEur: number | null
  existingSentAt:     string | null
  depositPaidAt:      string | null
  baseUrl:            string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProposalTab({
  inquiryId,
  anglerName,
  experienceTitle,
  guideOptions,
  guideFinalDates,
  existingToken,
  existingTotalEur,
  existingDepositEur,
  existingSentAt,
  depositPaidAt,
  baseUrl,
}: Props) {

  const defaultTotal   = existingTotalEur   ?? suggestedTotal(guideOptions)
  const defaultDeposit = existingDepositEur ?? (defaultTotal > 0 ? Math.round(defaultTotal * 0.3) : 0)

  const [total,   setTotal]   = useState(defaultTotal > 0 ? String(defaultTotal) : '')
  const [deposit, setDeposit] = useState(defaultDeposit > 0 ? String(defaultDeposit) : '')
  const [notes,   setNotes]   = useState('')
  const [token,   setToken]   = useState(existingToken)
  const [sentAt,  setSentAt]  = useState(existingSentAt)
  const [copied,  setCopied]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [pending, start]      = useTransition()

  const offerUrl = token != null ? `${baseUrl}/offers/${token}` : null

  const copy = useCallback(() => {
    if (offerUrl == null) return
    navigator.clipboard.writeText(offerUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [offerUrl])

  function handleGenerate() {
    const totalNum   = parseFloat(total)
    const depositNum = parseFloat(deposit)
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      setErr('Enter a valid total price')
      return
    }
    if (!Number.isFinite(depositNum) || depositNum < 0.5) {
      setErr('Deposit must be at least €0.50')
      return
    }
    if (depositNum > totalNum) {
      setErr('Deposit cannot exceed the total')
      return
    }
    setErr(null)

    // Collect all photos from guide options
    const allPhotos = guideOptions.flatMap(o => Array.isArray(o.photos) ? o.photos : [])

    start(async () => {
      const res = await saveRichOffer(inquiryId, {
        totalPriceEur:   totalNum,
        depositEur:      depositNum,
        notes:           notes.trim() || null,
        tripPlan:        null,
        licenseInfo:     null,
        licenseHeading:  null,
        inclusions:      [],
        questions:       [],
        refundReason:    null,
        photos:          allPhotos,
        location:        null,
        whatToBring:     [],
        schedule:        [],
        locationLat:     null,
        locationLng:     null,
        locationZoom:    10,
        locationGeoJson: null,
      })

      if (!res.success) {
        setErr(res.error ?? 'Failed to generate proposal')
      } else {
        if (res.offerUrl != null) {
          const newToken = res.offerUrl.split('/offers/')[1]
          setToken(newToken ?? null)
          setSentAt(new Date().toISOString())
        }
      }
    })
  }

  const hasOptions = guideOptions.length > 0
  const isPaid     = depositPaidAt != null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

      {/* ── LEFT: Guide's offer (improved display) ──────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="mb-1">
          <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Guide&apos;s Submitted Options</p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Use these as reference to build the angler&apos;s proposal.
          </p>
        </div>

        {/* Final dates */}
        {guideFinalDates != null && guideFinalDates.trim() !== '' && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-[14px]"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] f-body flex-shrink-0"
              style={{ color: 'rgba(10,46,77,0.38)' }}>Confirmed dates</span>
            <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{guideFinalDates}</span>
          </div>
        )}

        {!hasOptions ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-[22px] text-center"
            style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.1)' }}>
            <p className="text-sm f-display" style={{ color: 'rgba(10,46,77,0.4)' }}>
              No guide options yet
            </p>
            <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.3)' }}>
              The guide hasn&apos;t submitted their offer yet. Check the Trip Setup tab.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {guideOptions.map((opt, i) => (
              <OptionCard key={i} opt={opt} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Proposal builder ─────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6">
        <div
          className="rounded-[22px] overflow-hidden"
          style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(10,46,77,0.2)' }}
        >
          {/* Header */}
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Angler proposal</p>
            <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>
              {anglerName} · {experienceTitle ?? 'Your trip'}
            </p>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">

            {/* ── Payment status (if deposit paid) ── */}
            {isPaid && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <span className="text-sm font-bold f-body" style={{ color: '#6EE7B7' }}>
                  ✅ Deposit paid — booking confirmed
                </span>
              </div>
            )}

            {/* ── Existing offer link ── */}
            {offerUrl != null && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {sentAt != null
                    ? `Sent ${new Date(sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : 'Offer link'}
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[11px] f-body truncate"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    /offers/{token?.slice(0, 16)}…
                  </div>
                  <button type="button" onClick={copy}
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold f-body transition-all"
                    style={{
                      background: copied ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.1)',
                      color:      copied ? '#6EE7B7'               : 'rgba(255,255,255,0.7)',
                      border:     '1px solid rgba(255,255,255,0.12)',
                      cursor:     'pointer',
                    }}>
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Form ── */}
            <div>
              <label style={labelCls}>Total price (EUR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>€</span>
                <input
                  type="number" min={1} step={1}
                  value={total}
                  onChange={e => setTotal(e.target.value)}
                  placeholder="0"
                  style={{ ...inputCls, paddingLeft: 24 }}
                />
              </div>
            </div>

            <div>
              <label style={labelCls}>Deposit (EUR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>€</span>
                <input
                  type="number" min={0.5} step={1}
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  placeholder="0"
                  style={{ ...inputCls, paddingLeft: 24 }}
                />
              </div>
              {total !== '' && deposit !== '' && (
                <p className="text-[10px] f-body mt-1.5"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>
                  Angler pays €{deposit} now · €{Math.max(0, parseFloat(total || '0') - parseFloat(deposit || '0')).toFixed(0)} to guide
                </p>
              )}
            </div>

            <div>
              <label style={labelCls}>Notes for angler (optional)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any extra context for the angler…"
                style={{ ...inputCls, resize: 'vertical' }}
              />
            </div>

            {err != null && (
              <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>{err}</p>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={pending}
              className="w-full py-3 rounded-xl text-sm font-bold f-body transition-all"
              style={{
                background: '#E67E50',
                color: '#FFFFFF',
                border: 'none',
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending
                ? 'Generating…'
                : offerUrl != null
                  ? 'Update & resend to angler'
                  : 'Generate & send to angler'}
            </button>

            {offerUrl != null && !pending && (
              <p className="text-[10px] f-body text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Angler receives a new email with the magic link
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
