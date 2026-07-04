'use client'

import { useState, useTransition } from 'react'
import type { GuideOption } from '@/actions/inquiries'
import { updateInquiryGuide } from '@/actions/inquiries'
import { OfferBuilder } from './OfferBuilder'
import type { InitialOfferData } from './OfferBuilder'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CUR: Record<string, string> = { EUR: '€', USD: '$', ISK: 'kr' }
const sym = (c?: string | null) => CUR[c ?? 'EUR'] ?? '€'

function totalForOption(opt: GuideOption): number {
  return (Number(opt.guide_price ?? 0)) + (Number(opt.license_price ?? 0))
}

function suggestedTotal(opts: GuideOption[]): number {
  if (opts.length === 0) return 0
  return totalForOption(opts[0])
}

// ─── Guide option card ────────────────────────────────────────────────────────

function OptionCard({ opt, index }: { opt: GuideOption; index: number }) {
  const allSpecies = Array.isArray(opt.species) ? opt.species : []
  const currency   = opt.currency ?? 'EUR'
  const s          = sym(currency)
  const guideP     = opt.guide_price   != null ? Number(opt.guide_price)   : null
  const licenseP   = opt.license_price != null ? Number(opt.license_price) : null
  const total      = (guideP ?? 0) + (licenseP ?? 0)
  const photos     = Array.isArray(opt.photos) ? opt.photos : []

  return (
    <div className="rounded-[22px] overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
      {photos.length > 0 && (
        <div className="flex gap-1 p-2 overflow-x-auto"
          style={{ background: 'rgba(10,46,77,0.03)' }}>
          {photos.map((url, pi) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={pi} src={url} alt="" className="flex-shrink-0 rounded-xl object-cover"
              style={{ width: 120, height: 80, border: '1px solid rgba(10,46,77,0.07)' }} />
          ))}
        </div>
      )}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-0.5"
              style={{ color: 'rgba(10,46,77,0.38)' }}>Option {index + 1}</p>
            <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>{opt.spot || 'Unnamed spot'}</p>
          </div>
          {total > 0 && (
            <div className="flex-shrink-0 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(230,126,80,0.1)', border: '1px solid rgba(230,126,80,0.2)' }}>
              <p className="text-sm font-bold f-body" style={{ color: '#C05A2E' }}>{s}{total.toLocaleString()}</p>
            </div>
          )}
        </div>
        {allSpecies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allSpecies.map(sp => (
              <span key={sp} className="text-[10px] font-bold f-body px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(230,126,80,0.1)', color: '#C05A2E', border: '1px solid rgba(230,126,80,0.2)' }}>
                {sp}
              </span>
            ))}
          </div>
        )}
        {(guideP != null || licenseP != null) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 py-2.5 px-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}>
            {guideP != null && <p className="text-xs f-body" style={{ color: '#0A2E4D' }}>Guide fee: <strong>{s}{guideP.toLocaleString()}</strong></p>}
            {licenseP != null && <p className="text-xs f-body" style={{ color: '#0A2E4D' }}>License: <strong>{s}{licenseP.toLocaleString()}</strong></p>}
            {guideP != null && licenseP != null && <p className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>Total: {s}{total.toLocaleString()}</p>}
          </div>
        )}
        {opt.description != null && opt.description.trim() !== '' && (
          <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{opt.description}</p>
        )}
      </div>
    </div>
  )
}

// ─── Guide selector ───────────────────────────────────────────────────────────

interface GuideOption2 {
  id:         string
  full_name:  string
  avatar_url: string | null
}

function GuideSelector({
  inquiryId,
  guides,
  currentGuideId,
}: {
  inquiryId:      string
  guides:         GuideOption2[]
  currentGuideId: string | null
}) {
  const [selected, setSelected]       = useState(currentGuideId ?? '')
  const [isPending, startTransition]  = useTransition()
  const [saved,     setSaved]         = useState(false)

  function handleChange(guideId: string) {
    setSelected(guideId)
    setSaved(false)
    startTransition(async () => {
      await updateInquiryGuide(inquiryId, guideId || null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  if (guides.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 rounded-[18px]"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
      <p className="text-xs font-bold f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>
        Guide on offer
      </p>
      <select
        value={selected}
        onChange={e => handleChange(e.target.value)}
        disabled={isPending}
        className="flex-1 text-sm f-body rounded-xl px-3 py-2"
        style={{
          background: '#fff',
          border: '1px solid rgba(10,46,77,0.12)',
          color: '#0A2E4D',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">— Use trip default —</option>
        {guides.map(g => (
          <option key={g.id} value={g.id}>{g.full_name}</option>
        ))}
      </select>
      {saved && (
        <span className="text-xs font-semibold f-body flex-shrink-0" style={{ color: '#16a34a' }}>✓ Saved</span>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inquiryId:            string
  anglerName:           string
  experienceTitle:      string | null
  guideOptions:         GuideOption[]
  guideFinalDates:      string | null
  existingToken:        string | null
  existingTotalEur:     number | null
  existingDepositEur:   number | null
  existingSentAt:       string | null
  depositPaidAt:        string | null
  baseUrl:              string
  initialOffer:         InitialOfferData | null
  availableGuides:      GuideOption2[]
  currentGuideId:       string | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProposalTab({
  inquiryId,
  anglerName,
  experienceTitle,
  guideOptions,
  guideFinalDates,
  depositPaidAt,
  baseUrl,
  initialOffer,
  availableGuides,
  currentGuideId,
}: Props) {

  const hasOptions   = guideOptions.length > 0
  const isPaid       = depositPaidAt != null
  const estimatedEur = initialOffer?.totalPriceEur ?? suggestedTotal(guideOptions)

  return (
    <div className="flex flex-col gap-8">

      {/* ── Deposit paid banner ─────────────────────────────────────────────── */}
      {isPaid && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-[18px]"
          style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <span className="text-lg">✅</span>
          <p className="text-sm font-bold f-body" style={{ color: '#065F46' }}>
            Deposit paid — booking confirmed for {anglerName}
          </p>
        </div>
      )}

      {/* ── Guide selector ──────────────────────────────────────────────────── */}
      <GuideSelector
        inquiryId={inquiryId}
        guides={availableGuides}
        currentGuideId={currentGuideId}
      />

      {/* ── Guide options ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            Guide&apos;s Submitted Options
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Use these as reference when building the offer below.
          </p>
        </div>

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
            <p className="text-sm f-display" style={{ color: 'rgba(10,46,77,0.4)' }}>No guide options yet</p>
            <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.3)' }}>
              The guide hasn&apos;t submitted their offer yet. Check the Trip Setup tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {guideOptions.map((opt, i) => <OptionCard key={i} opt={opt} index={i} />)}
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }} />

      {/* ── Offer builder ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            Build Offer for {anglerName}
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Fill in the sections below, preview, then send to the angler.
          </p>
        </div>

        <div className="rounded-[22px] overflow-hidden"
          style={{ background: '#F8FAFB', border: '1px solid rgba(10,46,77,0.08)' }}>
          <div className="px-6 py-5">
            <OfferBuilder
              inquiryId={inquiryId}
              tripTitle={experienceTitle ?? 'Your trip'}
              estimatedTotalEur={estimatedEur}
              initialOffer={initialOffer ?? undefined}
              baseUrl={baseUrl}
            />
          </div>
        </div>
      </div>

    </div>
  )
}
