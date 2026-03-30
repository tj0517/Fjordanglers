'use client'

import { useState, useEffect } from 'react'
import GuideOfferForm, { type GuideOfferFormProps } from './guide-offer-form'
import InquiryDeclineButton from './inquiry-decline-button'
import { MessageSquare, X, Clock, Settings2, Home, Car, Ship } from 'lucide-react'

// ─── Angler brief — data shown in the left panel ──────────────────────────────

export type AnglerBrief = {
  anglerName:         string
  anglerEmail:        string
  /** Formatted dates string e.g. "15 Jun – 20 Jun 2026" */
  datesValue:         string
  /** e.g. "6 days" */
  tripDays:           string
  /** Multiple period chips when angler selected several windows */
  allPeriods?:        { from: string; to: string }[]
  /** e.g. "3 anglers · incl. beginners" */
  groupLabel:         string
  species:            string[]
  durationTypeLabel?: string
  experienceLabel?:   string
  gearLabel?:         string
  accommodLabel?:     string
  transportLabel?:    string
  budgetLabel?:       string
  notes?:             string
  boatPref?:          string
}

// ─── Props ────────────────────────────────────────────────────────────────────

type OfferModalProps = Omit<GuideOfferFormProps, 'onSuccess'> & {
  inquiryId:       string
  canDecline:      boolean
  anglerBrief?:    AnglerBrief
  onAfterSuccess?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfferModal({
  inquiryId,
  canDecline,
  anglerBrief,
  onAfterSuccess,
  ...formProps
}: OfferModalProps) {
  const [open, setOpen] = useState(false)

  function close() { setOpen(false) }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hasPanel = anglerBrief != null

  return (
    <>
      {/* ── Trigger buttons ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3.5 rounded-2xl text-sm font-bold f-body transition-all hover:brightness-105 flex items-center justify-center gap-2"
          style={{ background: '#E67E50', color: 'white' }}
        >
          <MessageSquare size={14} strokeWidth={1.8} />
          Send Offer
        </button>

        {canDecline && (
          <InquiryDeclineButton inquiryId={inquiryId} />
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{ background: 'rgba(7,17,28,0.72)', backdropFilter: 'blur(5px)' }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={close} />

          {/* Panel */}
          <div
            className="relative w-full flex flex-col"
            style={{
              maxWidth:     hasPanel ? 980 : 520,
              maxHeight:    '92dvh',
              background:   '#FDFAF7',
              borderRadius: 28,
              overflow:     'hidden',
              boxShadow:    '0 32px 80px rgba(10,46,77,0.32)',
            }}
            onClick={e => e.stopPropagation()}
          >

            {/* ── Modal header (full-width) ─────────────────────────────── */}
            <div
              className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Create offer
                </p>
                <h2 className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
                  {hasPanel ? `Send offer to ${anglerBrief.anglerName}` : 'Send Offer'}
                </h2>
              </div>
              <button
                onClick={close}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.06]"
                aria-label="Close"
                style={{ color: 'rgba(10,46,77,0.5)' }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* ── Body — two columns on desktop, single on mobile ────────── */}
            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

              {/* ── LEFT: angler brief (desktop only) ────────────────────── */}
              {hasPanel && (
                <div
                  className="hidden sm:flex flex-col flex-shrink-0 overflow-y-auto"
                  style={{
                    width:       320,
                    background:  '#07192A',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Angler identity */}
                  <div
                    className="px-5 py-5 flex-shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold f-display mb-3 flex-shrink-0"
                      style={{ background: '#E67E50', color: 'white' }}
                    >
                      {anglerBrief.anglerName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <p className="text-[15px] font-bold f-display leading-snug" style={{ color: 'white' }}>
                      {anglerBrief.anglerName}
                    </p>
                    <p className="text-[11px] f-body mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {anglerBrief.anglerEmail}
                    </p>
                  </div>

                  {/* ── When ─────────────────────────────────────────────── */}
                  <BriefSection title="When">
                    {anglerBrief.allPeriods != null && anglerBrief.allPeriods.length > 1 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {anglerBrief.allPeriods.map((p, i) => (
                          <span
                            key={i}
                            className="text-[11px] f-body px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(59,130,246,0.18)', color: '#93C5FD' }}
                          >
                            {p.from === p.to ? p.from : `${p.from} – ${p.to}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <BriefRow value={`${anglerBrief.datesValue}`} />
                    )}
                    <BriefRow value={anglerBrief.tripDays} muted />
                  </BriefSection>

                  {/* ── Group ────────────────────────────────────────────── */}
                  <BriefSection title="Group">
                    <BriefRow value={anglerBrief.groupLabel} />
                    {anglerBrief.experienceLabel != null && (
                      <BriefRow value={anglerBrief.experienceLabel} muted />
                    )}
                  </BriefSection>

                  {/* ── Target species ───────────────────────────────────── */}
                  {anglerBrief.species.length > 0 && (
                    <BriefSection title="Target species">
                      <div className="flex flex-wrap gap-1.5">
                        {anglerBrief.species.map(sp => (
                          <span
                            key={sp}
                            className="text-[11px] f-body px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                    </BriefSection>
                  )}

                  {/* ── Preferences ──────────────────────────────────────── */}
                  {(anglerBrief.durationTypeLabel != null ||
                    anglerBrief.gearLabel         != null ||
                    anglerBrief.accommodLabel      != null ||
                    anglerBrief.transportLabel     != null ||
                    anglerBrief.boatPref           != null) && (
                    <BriefSection title="Preferences">
                      {anglerBrief.durationTypeLabel != null && (
                        <BriefRow icon={<ClockIcon />} value={anglerBrief.durationTypeLabel} />
                      )}
                      {anglerBrief.gearLabel != null && (
                        <BriefRow icon={<GearIcon />} value={anglerBrief.gearLabel} />
                      )}
                      {anglerBrief.accommodLabel != null && (
                        <BriefRow icon={<HouseIcon />} value={anglerBrief.accommodLabel} />
                      )}
                      {anglerBrief.transportLabel != null && (
                        <BriefRow icon={<CarIcon />} value={anglerBrief.transportLabel} />
                      )}
                      {anglerBrief.boatPref != null && (
                        <BriefRow icon={<BoatIcon />} value={anglerBrief.boatPref} />
                      )}
                    </BriefSection>
                  )}

                  {/* ── Budget ───────────────────────────────────────────── */}
                  {anglerBrief.budgetLabel != null && (
                    <BriefSection title="Budget">
                      <BriefRow value={anglerBrief.budgetLabel} />
                    </BriefSection>
                  )}

                  {/* ── Notes ────────────────────────────────────────────── */}
                  {anglerBrief.notes != null && anglerBrief.notes.length > 0 && (
                    <BriefSection title="Notes from angler" last>
                      <p
                        className="text-xs f-body leading-relaxed whitespace-pre-wrap"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {anglerBrief.notes}
                      </p>
                    </BriefSection>
                  )}
                </div>
              )}

              {/* ── RIGHT: offer form ─────────────────────────────────────── */}
              <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">
                <GuideOfferForm
                  {...formProps}
                  inquiryId={inquiryId}
                  hideAnglerDates={hasPanel}
                  onSuccess={() => { close(); onAfterSuccess?.() }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Left-panel sub-components ────────────────────────────────────────────────

function BriefSection({
  title,
  children,
  last = false,
}: {
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="px-5 py-4 flex flex-col gap-2"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
    >
      <p
        className="text-[9px] uppercase tracking-[0.24em] font-bold f-body"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function BriefRow({
  value,
  icon,
  muted = false,
}: {
  value: string
  icon?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      {icon != null && (
        <span className="flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {icon}
        </span>
      )}
      {icon == null && (
        <span
          className="w-1 h-1 rounded-full flex-shrink-0 mt-[6px]"
          style={{ background: muted ? 'rgba(255,255,255,0.2)' : 'rgba(230,126,80,0.7)' }}
        />
      )}
      <p
        className="text-[12px] f-body leading-snug"
        style={{ color: muted ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.78)' }}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Tiny icons for the brief panel ───────────────────────────────────────────

function ClockIcon() { return <Clock size={11} strokeWidth={1.5} /> }
function GearIcon()  { return <Settings2 size={11} strokeWidth={1.4} /> }
function HouseIcon() { return <Home size={11} strokeWidth={1.4} /> }
function CarIcon()   { return <Car size={11} strokeWidth={1.4} /> }
function BoatIcon()  { return <Ship size={11} strokeWidth={1.4} /> }
