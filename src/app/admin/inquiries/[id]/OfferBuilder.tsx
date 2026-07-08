'use client'

/**
 * OfferBuilder — FA builds a rich personalised offer with 1–3 options.
 *
 * Per-option sections (tabbed):
 *   1. Option title
 *   2. Pricing & Deposit
 *   3. What's Included
 *   4. Schedule
 *   5. Note for this option
 *
 * Shared sections:
 *   6. Location (text + map)
 *   7. Photos
 *   8. Fishing Licence
 *   9. What to Bring
 *  10. Questions for the angler
 *  11. Note to angler
 */

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { saveOfferDraft, sendOfferEmail } from '@/actions/inquiries'
import { uploadOfferPhoto } from '@/actions/offer-photos'
import type { OfferQuestion, ScheduleEntry, OfferOptionInput } from '@/actions/inquiries'
import type { Feature, Polygon } from 'geojson'
import {
  Loader2, Check, Copy, ExternalLink, Plus, Trash2,
  ChevronDown, ChevronUp, ImageIcon, X,
} from 'lucide-react'

const LocationPicker = dynamic(
  () => import('./LocationPicker').then(m => m.LocationPicker),
  { ssr: false, loading: () => (
    <div className="mt-3 h-[310px] rounded-xl flex items-center justify-center"
      style={{ background: 'rgba(10,46,77,0.04)', border: '1.5px solid rgba(10,46,77,0.1)' }}>
      <Loader2 size={18} className="animate-spin" style={{ color: 'rgba(10,46,77,0.3)' }} />
    </div>
  ) },
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionState {
  id:           string
  title:        string
  totalEur:     number
  depositEur:   number
  refundReason: string
  inclusions:   string[]
  schedule:     ScheduleEntry[]
  notes:        string
}

export interface InitialOfferData {
  totalPriceEur:   number | null
  depositEur:      number | null
  notes:           string | null
  licenseInfo:     string | null
  licenseHeading:  string | null
  inclusions:      string[]
  questions:       OfferQuestion[]
  refundReason:    string | null
  photos:          string[]
  location:        string | null
  whatToBring:     string[]
  schedule:        ScheduleEntry[]
  locationLat:     number | null
  locationLng:     number | null
  locationZoom:    number
  locationGeoJson: object | null
  offerToken:      string | null
  offerSentAt:     string | null
  options:         OfferOptionInput[] | null
}

interface Props {
  inquiryId:         string
  tripTitle:         string
  estimatedTotalEur: number
  initialOffer?:     InitialOfferData
  baseUrl:           string
}

const DEFAULT_INCLUSIONS = ['Professional guide', 'Fishing equipment & tackle', 'Fishing licence']
const DEFAULT_REFUND     = 'If you need to cancel, the deposit is fully refundable up to 14 days before the trip date.'
const OPTION_LABELS      = ['A', 'B', 'C']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlankOption(estimatedEur = 0, useEstimate = false): OptionState {
  return {
    id:           crypto.randomUUID(),
    title:        '',
    totalEur:     useEstimate && estimatedEur > 0 ? estimatedEur : 0,
    depositEur:   useEstimate && estimatedEur > 0 ? Math.round(estimatedEur * 0.3 * 100) / 100 : 0,
    refundReason: DEFAULT_REFUND,
    inclusions:   [...DEFAULT_INCLUSIONS],
    schedule:     [],
    notes:        '',
  }
}

function buildInitOptions(init: InitialOfferData | undefined, estimatedEur: number): OptionState[] {
  // ── Saved multi-option draft ─────────────────────────────────────────────────
  if (init?.options != null && init.options.length > 0) {
    const loaded = init.options.map(o => ({
      id:           crypto.randomUUID(),
      title:        o.title ?? '',
      totalEur:     o.totalEur ?? 0,
      depositEur:   o.depositEur ?? 0,
      refundReason: o.refundReason ?? DEFAULT_REFUND,
      inclusions:   Array.isArray(o.inclusions) && o.inclusions.length > 0
        ? o.inclusions
        : [...DEFAULT_INCLUSIONS],
      schedule:     Array.isArray(o.schedule) ? o.schedule : [],
      notes:        o.notes ?? '',
    }))
    // Always have at least 2
    if (loaded.length === 1) loaded.push(makeBlankOption(0, false))
    return loaded
  }

  // ── Legacy single-option draft (or no draft) ─────────────────────────────────
  const legacyOpt: OptionState = {
    id:           crypto.randomUUID(),
    title:        '',
    totalEur:     init?.totalPriceEur ?? (estimatedEur > 0 ? estimatedEur : 0),
    depositEur:   init?.depositEur ?? (estimatedEur > 0 ? Math.round(estimatedEur * 0.3 * 100) / 100 : 0),
    refundReason: init?.refundReason ?? DEFAULT_REFUND,
    inclusions:   init?.inclusions?.length ? init.inclusions : [...DEFAULT_INCLUSIONS],
    schedule:     init?.schedule ?? [],
    notes:        '',
  }
  return [legacyOpt, makeBlankOption(0, false)]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OfferBuilder({ inquiryId, tripTitle, estimatedTotalEur, initialOffer, baseUrl }: Props) {
  const init = initialOffer

  // ── Options (per-option state) ────────────────────────────────────────────────
  const [options, setOptions] = useState<OptionState[]>(() =>
    buildInitOptions(init, estimatedTotalEur)
  )
  const [activeId, setActiveId] = useState(() => options[0].id)

  const activeOpt = options.find(o => o.id === activeId) ?? options[0]
  const activeIdx = options.findIndex(o => o.id === activeId)

  function updateActive<K extends keyof OptionState>(field: K, value: OptionState[K]) {
    setOptions(prev => prev.map(o => o.id === activeId ? { ...o, [field]: value } : o))
  }

  function addOption() {
    if (options.length >= 3) return
    const newOpt = makeBlankOption(0, false)
    setOptions(prev => [...prev, newOpt])
    setActiveId(newOpt.id)
  }

  function removeOption(id: string) {
    if (options.length <= 1) return
    setOptions(prev => {
      const next = prev.filter(o => o.id !== id)
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [location,        setLocation]        = useState(init?.location ?? '')
  const [locationLat,     setLocationLat]     = useState<number | null>(init?.locationLat ?? null)
  const [locationLng,     setLocationLng]     = useState<number | null>(init?.locationLng ?? null)
  const [locationZoom,    setLocationZoom]    = useState(init?.locationZoom ?? 8)
  const [locationGeoJson, setLocationGeoJson] = useState<object | null>(init?.locationGeoJson ?? null)
  const [showMap,         setShowMap]         = useState(init?.locationLat != null)

  const [photos,      setPhotos]      = useState<string[]>(init?.photos ?? [])
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [licenseHeading, setLicenseHeading] = useState(init?.licenseHeading ?? '')
  const [licenseInfo,    setLicenseInfo]    = useState(init?.licenseInfo ?? '')

  const [whatToBring, setWhatToBring] = useState<string[]>(
    init?.whatToBring?.length ? init.whatToBring : ['Warm waterproof jacket', 'Rubber-soled shoes or waders']
  )

  const [questions, setQuestions] = useState<OfferQuestion[]>(init?.questions ?? [])
  const [notes,     setNotes]     = useState(init?.notes ?? '')

  // ── Section open/closed (shared sections only) ───────────────────────────────
  const [open, setOpen] = useState<Record<string, boolean>>({
    location:    true,
    photos:      true,
    license:     false,
    whatToBring: false,
    questions:   false,
    notes:       false,
  })
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }))

  // ── Per-option section open/closed ───────────────────────────────────────────
  const [optOpen, setOptOpen] = useState<Record<string, boolean>>({
    title:      true,
    pricing:    true,
    inclusions: true,
    schedule:   true,
    optNotes:   false,
  })
  const toggleOpt = (k: string) => setOptOpen(p => ({ ...p, [k]: !p[k] }))

  // ── Submission state ─────────────────────────────────────────────────────────
  const existingOfferUrl = init?.offerToken != null
    ? `${baseUrl}/offers/${init.offerToken}`
    : null

  const [isPending, startTransition]     = useTransition()
  const [isSending, startSendTransition] = useTransition()
  const [result, setResult]              = useState<{ offerUrl: string } | { error: string } | null>(null)
  const [sendResult, setSendResult]      = useState<'sent' | { error: string } | null>(
    init?.offerSentAt != null ? 'sent' : null
  )
  const [copied, setCopied] = useState(false)

  // ─── Photo upload ─────────────────────────────────────────────────────────────
  async function handlePhotoFiles(files: FileList) {
    if (files.length === 0) return
    setUploadError(null)
    const remaining = 8 - photos.length
    if (remaining <= 0) return
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const results = await Promise.all(toUpload.map(async file => {
        const fd = new FormData()
        fd.append('file', file)
        return uploadOfferPhoto(fd)
      }))
      const urls: string[] = []
      const errors: string[] = []
      for (const r of results) {
        if ('url' in r) urls.push(r.url)
        else errors.push(r.error)
      }
      if (urls.length > 0)   setPhotos(p => [...p, ...urls])
      if (errors.length > 0) setUploadError(errors[0])
    } finally {
      setUploading(false)
    }
  }

  // ─── Per-option: schedule ─────────────────────────────────────────────────────
  function addDay() {
    const n = activeOpt.schedule.length + 1
    updateActive('schedule', [
      ...activeOpt.schedule,
      { id: crypto.randomUUID(), label: `Day ${n}`, title: '', description: '' },
    ])
  }
  function updateScheduleEntry(entryId: string, field: keyof ScheduleEntry, value: string) {
    updateActive('schedule', activeOpt.schedule.map(e => e.id === entryId ? { ...e, [field]: value } : e))
  }
  function removeScheduleEntry(entryId: string) {
    updateActive('schedule', activeOpt.schedule.filter(e => e.id !== entryId))
  }

  // ─── Per-option: inclusions ───────────────────────────────────────────────────
  function addInclusion() { updateActive('inclusions', [...activeOpt.inclusions, '']) }
  function updateInclusion(i: number, v: string) {
    updateActive('inclusions', activeOpt.inclusions.map((x, j) => j === i ? v : x))
  }
  function removeInclusion(i: number) {
    updateActive('inclusions', activeOpt.inclusions.filter((_, j) => j !== i))
  }

  // ─── Shared: what to bring ────────────────────────────────────────────────────
  function addBringItem() { setWhatToBring(p => [...p, '']) }
  function updateBringItem(i: number, v: string) { setWhatToBring(p => p.map((x, j) => j === i ? v : x)) }
  function removeBringItem(i: number) { setWhatToBring(p => p.filter((_, j) => j !== i)) }

  // ─── Shared: questions ────────────────────────────────────────────────────────
  function addQuestion() { setQuestions(p => [...p, { id: crypto.randomUUID(), question: '' }]) }
  function updateQuestion(id: string, v: string) { setQuestions(p => p.map(q => q.id === id ? { ...q, question: v } : q)) }
  function removeQuestion(id: string) { setQuestions(p => p.filter(q => q.id !== id)) }

  // ─── Save draft ───────────────────────────────────────────────────────────────
  function handleSaveDraft() {
    // Build clean options
    const cleanOptions: OfferOptionInput[] = options.map(o => ({
      id:           o.id,
      title:        o.title.trim(),
      totalEur:     o.totalEur,
      depositEur:   o.depositEur,
      refundReason: o.refundReason.trim() || null,
      inclusions:   o.inclusions.filter(x => x.trim() !== ''),
      schedule:     o.schedule.filter(e => e.title.trim() !== '' || e.description.trim() !== ''),
      notes:        o.notes.trim() || null,
    }))

    // Use first option for backward-compat flat fields (deposit link flow)
    const first = cleanOptions[0]

    startTransition(async () => {
      const res = await saveOfferDraft(inquiryId, {
        options:        cleanOptions,
        // backward-compat flat fields (from first option)
        totalPriceEur:  first.totalEur,
        depositEur:     first.depositEur,
        refundReason:   first.refundReason ?? null,
        inclusions:     first.inclusions,
        schedule:       first.schedule,
        // shared fields
        notes:          notes.trim() || null,
        tripPlan:       null,
        licenseInfo:    licenseInfo.trim() || null,
        licenseHeading: licenseHeading.trim() || null,
        questions:      questions.filter(q => q.question.trim() !== ''),
        photos,
        location:       location.trim() || null,
        whatToBring:    whatToBring.filter(x => x.trim() !== ''),
        locationLat,
        locationLng,
        locationZoom,
        locationGeoJson,
      })
      setSendResult(null)
      setResult(res.success ? { offerUrl: res.offerUrl! } : { error: res.error })
    })
  }

  // ─── Send email ───────────────────────────────────────────────────────────────
  function handleSendEmail() {
    startSendTransition(async () => {
      const res = await sendOfferEmail(inquiryId)
      setSendResult(res.success ? 'sent' : { error: res.error })
    })
  }

  function handleCopy(url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── Disabled state ───────────────────────────────────────────────────────────
  const hasValidOption = options.some(o => o.totalEur > 0)

  // ─── Post-save state ──────────────────────────────────────────────────────────
  if (result != null && 'offerUrl' in result) {
    const url = (result as { offerUrl: string }).offerUrl
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <Check size={15} style={{ color: '#1E40AF', flexShrink: 0 }} />
          <p className="text-sm font-semibold f-body" style={{ color: '#1E40AF' }}>
            Draft saved — preview before sending
          </p>
        </div>

        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body"
            style={{ background: '#E67E50', color: '#fff' }}>
            <ExternalLink size={14} /> Preview offer
          </a>
          <button type="button" onClick={() => handleCopy(url)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold f-body"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {sendResult === 'sent' ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={15} style={{ color: '#065F46', flexShrink: 0 }} />
            <p className="text-sm font-semibold f-body" style={{ color: '#065F46' }}>Email sent to angler!</p>
          </div>
        ) : (
          <>
            {sendResult != null && 'error' in sendResult && (
              <p className="text-xs f-body" style={{ color: '#991B1B' }}>{sendResult.error}</p>
            )}
            <button type="button" onClick={handleSendEmail} disabled={isSending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold f-body"
              style={{
                background: isSending ? 'rgba(10,46,77,0.4)' : '#0A2E4D',
                color: '#fff',
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}>
              {isSending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : '✉ Send to angler'}
            </button>
          </>
        )}

        <button type="button" onClick={() => setResult(null)}
          className="w-full py-2 rounded-xl text-xs f-body"
          style={{ color: 'rgba(10,46,77,0.4)' }}>
          Edit offer
        </button>
      </div>
    )
  }

  if (result != null && 'error' in result) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm f-body" style={{ color: '#991B1B' }}>{result.error}</p>
        </div>
        <button type="button" onClick={() => setResult(null)}
          className="w-full py-2 rounded-xl text-sm font-semibold f-body"
          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.6)' }}>
          Try again
        </button>
      </div>
    )
  }

  const depositPct = activeOpt.totalEur > 0
    ? Math.round((activeOpt.depositEur / activeOpt.totalEur) * 100)
    : 0

  // ─── Builder form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Option tabs ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] f-body mb-2"
          style={{ color: 'rgba(10,46,77,0.4)' }}>
          Proposal Options
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setActiveId(opt.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold f-body transition-all"
                style={{
                  background: opt.id === activeId ? '#0A2E4D' : 'rgba(10,46,77,0.07)',
                  color:      opt.id === activeId ? '#fff'    : 'rgba(10,46,77,0.5)',
                  border:     opt.id === activeId ? 'none'    : '1px solid rgba(10,46,77,0.1)',
                }}
              >
                Option {OPTION_LABELS[i]}
                {opt.totalEur > 0 && (
                  <span
                    className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: opt.id === activeId ? 'rgba(255,255,255,0.2)' : 'rgba(230,126,80,0.15)',
                      color:      opt.id === activeId ? '#fff' : '#C05A2E',
                    }}
                  >
                    €{opt.totalEur.toFixed(0)}
                  </span>
                )}
              </button>
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  className="w-5 h-5 rounded-md flex items-center justify-center hover:opacity-70"
                  style={{ color: 'rgba(10,46,77,0.35)' }}
                  title={`Remove Option ${OPTION_LABELS[i]}`}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {options.length < 3 && (
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold f-body"
              style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)', border: '1px dashed rgba(230,126,80,0.35)' }}
            >
              <Plus size={11} /> Add option
            </button>
          )}
        </div>
      </div>

      {/* ── Per-option sections ───────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden"
        style={{ border: '2px solid rgba(10,46,77,0.12)', background: 'rgba(10,46,77,0.015)' }}>
        <div className="px-3.5 py-2.5 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(10,46,77,0.04)' }}>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] f-body"
            style={{ color: '#E67E50' }}>
            Option {OPTION_LABELS[activeIdx] ?? 'A'}
          </span>
          {activeOpt.title.trim() !== '' && (
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
              — {activeOpt.title}
            </span>
          )}
        </div>

        <div className="p-3.5 space-y-2.5">

          {/* ─ Option title ─────────────────────────────────────────────────── */}
          <OptSection title="Option Title" open={optOpen.title} onToggle={() => toggleOpt('title')}>
            <input
              type="text"
              value={activeOpt.title}
              onChange={e => updateActive('title', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm f-body"
              style={inputStyle}
              placeholder={`e.g. 3-Day Gaula River · Salmon & Sea Trout`}
            />
            <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Short label the angler will see on their option card.
            </p>
          </OptSection>

          {/* ─ Pricing ──────────────────────────────────────────────────────── */}
          <OptSection title="Pricing & Deposit" open={optOpen.pricing} onToggle={() => toggleOpt('pricing')}>
            <div className="space-y-3">
              <Field label="Total trip price (€)">
                <input type="number" min={0} step={0.01} value={activeOpt.totalEur || ''}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0
                    updateActive('totalEur', v)
                    updateActive('depositEur', Math.round(v * 0.3 * 100) / 100)
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm f-body" style={inputStyle}
                  placeholder="e.g. 850" />
              </Field>

              <Field label={`Deposit (€)${activeOpt.totalEur > 0 ? ` — ${depositPct}% of total` : ''}`}>
                <input type="number" min={0} step={0.01} value={activeOpt.depositEur || ''}
                  onChange={e => updateActive('depositEur', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg text-sm f-body" style={inputStyle}
                  placeholder="e.g. 255" />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {[20, 25, 30, 40, 50].map(pct => (
                    <button key={pct} type="button"
                      onClick={() => updateActive('depositEur', Math.round(activeOpt.totalEur * pct / 100 * 100) / 100)}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold f-body"
                      style={{
                        background: depositPct === pct ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
                        color:      depositPct === pct ? '#fff'    : 'rgba(10,46,77,0.5)',
                      }}>
                      {pct}%
                    </button>
                  ))}
                </div>
              </Field>

              {activeOpt.totalEur > 0 && activeOpt.depositEur > 0 && (
                <div className="px-3 py-2.5 rounded-xl text-xs f-body"
                  style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}>
                  <span style={{ color: 'rgba(10,46,77,0.5)' }}>Deposit: </span>
                  <strong style={{ color: '#E67E50' }}>€{activeOpt.depositEur.toFixed(2)}</strong>
                  <span style={{ color: 'rgba(10,46,77,0.4)' }}> · pays guide: </span>
                  <strong style={{ color: '#0A2E4D' }}>€{(activeOpt.totalEur - activeOpt.depositEur).toFixed(2)}</strong>
                </div>
              )}

              <Field label="Refund policy">
                <textarea value={activeOpt.refundReason}
                  onChange={e => updateActive('refundReason', e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
                  style={inputStyle} placeholder="e.g. Fully refundable if cancelled 14+ days before." />
              </Field>
            </div>
          </OptSection>

          {/* ─ Inclusions ───────────────────────────────────────────────────── */}
          <OptSection
            title={activeOpt.totalEur > 0
              ? `What's Included — €${activeOpt.totalEur.toFixed(0)}`
              : "What's Included"}
            open={optOpen.inclusions}
            onToggle={() => toggleOpt('inclusions')}
          >
            <div className="space-y-2">
              {activeOpt.inclusions.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: '#16a34a' }}>✓</span>
                  <input type="text" value={item} onChange={e => updateInclusion(i, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm f-body" style={inputStyle}
                    placeholder="e.g. Boat + fuel" />
                  <button type="button" onClick={() => removeInclusion(i)}
                    className="p-1 rounded-md hover:opacity-60" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addInclusion}
                className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
                style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
                <Plus size={12} /> Add item
              </button>
            </div>
          </OptSection>

          {/* ─ Schedule ─────────────────────────────────────────────────────── */}
          <OptSection
            title={`Schedule${activeOpt.schedule.length > 0 ? ` (${activeOpt.schedule.length} days)` : ''}`}
            open={optOpen.schedule}
            onToggle={() => toggleOpt('schedule')}
          >
            <div className="space-y-3">
              {activeOpt.schedule.length === 0 && (
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  No days added yet. Build a day-by-day schedule for the angler.
                </p>
              )}
              {activeOpt.schedule.map((entry, i) => (
                <div key={entry.id} className="rounded-xl p-3 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(10,46,77,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <input type="text" value={entry.label}
                      onChange={e => updateScheduleEntry(entry.id, 'label', e.target.value)}
                      className="w-20 px-2 py-1 rounded-md text-xs font-bold f-body text-center"
                      style={{ ...inputStyle, color: '#E67E50' }}
                      placeholder={`Day ${i + 1}`} />
                    <input type="text" value={entry.title}
                      onChange={e => updateScheduleEntry(entry.id, 'title', e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold f-body"
                      style={inputStyle}
                      placeholder="e.g. Arrival & Briefing" />
                    <button type="button" onClick={() => removeScheduleEntry(entry.id)}
                      className="p-1 rounded-md hover:opacity-60 flex-shrink-0"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <textarea value={entry.description}
                    onChange={e => updateScheduleEntry(entry.id, 'description', e.target.value)}
                    rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
                    style={inputStyle}
                    placeholder="Describe what happens this day — times, activities, meals, travel…" />
                </div>
              ))}
              <button type="button" onClick={addDay}
                className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
                style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
                <Plus size={12} /> Add day
              </button>
            </div>
          </OptSection>

          {/* ─ Option-specific note ──────────────────────────────────────────── */}
          <OptSection title="Note for this option (optional)" open={optOpen.optNotes} onToggle={() => toggleOpt('optNotes')}>
            <textarea value={activeOpt.notes}
              onChange={e => updateActive('notes', e.target.value)}
              rows={2} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
              style={inputStyle} placeholder="e.g. Best for experienced fly fishers…" />
          </OptSection>

        </div>
      </div>

      {/* ── Shared sections ───────────────────────────────────────────────────── */}
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] f-body pt-1"
        style={{ color: 'rgba(10,46,77,0.4)' }}>
        Shared across all options
      </p>

      {/* Location */}
      <Section title="Location — Where It Happens" open={open.location} onToggle={() => toggle('location')}>
        <div className="space-y-2">
          <textarea value={location} onChange={e => setLocation(e.target.value)}
            rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
            style={inputStyle}
            placeholder="e.g. Gaula River, central Norway — 45 min from Trondheim Airport." />
          <button type="button" onClick={() => setShowMap(p => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
            style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
            🗺 {showMap ? 'Hide map' : locationLat != null ? 'Edit on map' : 'Set on map'}
            {locationLat != null && !showMap && (
              <span className="ml-1 text-[10px]" style={{ color: 'rgba(10,46,77,0.5)' }}>
                · {locationLat.toFixed(3)}, {locationLng?.toFixed(3)}
              </span>
            )}
          </button>
          {showMap && (
            <LocationPicker
              lat={locationLat}
              lng={locationLng}
              zoom={locationZoom}
              geojson={locationGeoJson}
              onPin={(lat, lng, z) => { setLocationLat(lat); setLocationLng(lng); setLocationZoom(z) }}
              onArea={(gj: Feature<Polygon>, lat, lng) => {
                setLocationGeoJson(gj)
                setLocationLat(lat)
                setLocationLng(lng)
              }}
              onClear={() => { setLocationLat(null); setLocationLng(null); setLocationGeoJson(null) }}
            />
          )}
        </div>
      </Section>

      {/* Photos */}
      <Section title={`Photos${photos.length > 0 ? ` (${photos.length}/8)` : ''}`}
        open={open.photos} onToggle={() => toggle('photos')}>
        {(photos.length > 0 || uploading) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {photos.map((url, i) => (
              <div key={url} className="relative" style={{ width: 52, height: 52, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#EF4444', color: '#fff' }}>
                  <X size={9} />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center justify-center rounded-lg"
                style={{ width: 52, height: 52, background: 'rgba(10,46,77,0.08)', border: '1px dashed rgba(10,46,77,0.2)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'rgba(10,46,77,0.4)' }} />
              </div>
            )}
          </div>
        )}
        {photos.length < 8 && (
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg cursor-pointer"
            style={{ color: uploading ? 'rgba(230,126,80,0.5)' : '#E67E50', background: 'rgba(230,126,80,0.08)', pointerEvents: uploading ? 'none' : undefined }}>
            <ImageIcon size={12} />
            {uploading ? 'Uploading…' : photos.length === 0 ? 'Add photos' : 'Add more'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploading}
              onChange={e => { if (e.target.files != null && e.target.files.length > 0) { void handlePhotoFiles(e.target.files); e.target.value = '' } }} />
          </label>
        )}
        {uploadError != null && <p className="text-xs f-body mt-2" style={{ color: '#EF4444' }}>{uploadError}</p>}
        {photos.length === 0 && !uploading && (
          <p className="text-xs f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.35)' }}>
            JPEG, PNG or WebP · Max 5 MB each · Up to 8
          </p>
        )}
      </Section>

      {/* Fishing Licence */}
      <Section title="Fishing Licence" open={open.license} onToggle={() => toggle('license')}>
        <div className="space-y-2">
          <input type="text" value={licenseHeading} onChange={e => setLicenseHeading(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-semibold f-body" style={inputStyle}
            placeholder="e.g. Norwegian Freshwater Fishing Licence" />
          <textarea value={licenseInfo} onChange={e => setLicenseInfo(e.target.value)}
            rows={4} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
            style={inputStyle}
            placeholder="Describe what licence is required, whether it's included, where to buy it, and any specific rules." />
        </div>
      </Section>

      {/* What to Bring */}
      <Section title={`What to Bring${whatToBring.length > 0 ? ` (${whatToBring.length})` : ''}`}
        open={open.whatToBring} onToggle={() => toggle('whatToBring')}>
        <div className="space-y-2">
          {whatToBring.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#E67E50' }}>·</span>
              <input type="text" value={item} onChange={e => updateBringItem(i, e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm f-body" style={inputStyle}
                placeholder="e.g. Waterproof jacket" />
              <button type="button" onClick={() => removeBringItem(i)}
                className="p-1 rounded-md hover:opacity-60" style={{ color: 'rgba(10,46,77,0.4)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addBringItem}
            className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
            style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
            <Plus size={12} /> Add item
          </button>
        </div>
      </Section>

      {/* Questions */}
      <Section title={`Questions for Angler${questions.length > 0 ? ` (${questions.length})` : ''}`}
        open={open.questions} onToggle={() => toggle('questions')}>
        <div className="space-y-2">
          {questions.length === 0 && (
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Add questions the angler must answer before accepting.
            </p>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-2">
              <span className="text-xs font-bold f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)', minWidth: 16 }}>{i + 1}.</span>
              <input type="text" value={q.question} onChange={e => updateQuestion(q.id, e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm f-body" style={inputStyle}
                placeholder="e.g. What's your fly fishing experience level?" />
              <button type="button" onClick={() => removeQuestion(q.id)}
                className="p-1 rounded-md mt-1 hover:opacity-60" style={{ color: 'rgba(10,46,77,0.4)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addQuestion}
            className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
            style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
            <Plus size={12} /> Add question
          </button>
        </div>
      </Section>

      {/* Note to angler (shared) */}
      <Section title="Note to Angler (optional)" open={open.notes} onToggle={() => toggle('notes')}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
          style={inputStyle} placeholder="Any personal message for the angler…" />
      </Section>

      {/* ── Existing draft banner ─────────────────────────────────────────────── */}
      {existingOfferUrl != null && result == null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] f-body mb-0.5"
              style={{ color: 'rgba(10,46,77,0.4)' }}>
              {init?.offerSentAt != null
                ? `Sent ${new Date(init.offerSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'Draft saved'}
            </p>
            <p className="text-xs f-body" style={{ color: '#1E40AF', wordBreak: 'break-all' }}>
              /offers/{init?.offerToken?.slice(0, 20)}…
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <a href={existingOfferUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-bold f-body"
              style={{ background: '#E67E50', color: '#fff' }}>
              Preview
            </a>
            <button type="button" onClick={() => handleCopy(existingOfferUrl)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold f-body"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* ── Save draft button ─────────────────────────────────────────────────── */}
      <button type="button" onClick={handleSaveDraft}
        disabled={isPending || !hasValidOption || uploading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold f-body mt-1"
        style={{
          background: (isPending || !hasValidOption || uploading) ? 'rgba(230,126,80,0.5)' : '#E67E50',
          color:      '#fff',
          cursor:     (isPending || !hasValidOption || uploading) ? 'not-allowed' : 'pointer',
          boxShadow:  (isPending || !hasValidOption || uploading) ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
        }}>
        {isPending
          ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
          : uploading
          ? <><Loader2 size={14} className="animate-spin" /> Photos uploading…</>
          : 'Save & preview →'}
      </button>

      {!hasValidOption && (
        <p className="text-[11px] f-body text-center" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Add a price to at least one option to save.
        </p>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(10,46,77,0.08)', background: 'rgba(10,46,77,0.015)' }}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
        <span className="text-xs font-bold uppercase tracking-[0.1em] f-body"
          style={{ color: 'rgba(10,46,77,0.6)' }}>{title}</span>
        {open
          ? <ChevronUp   size={13} style={{ color: 'rgba(10,46,77,0.35)' }} />
          : <ChevronDown size={13} style={{ color: 'rgba(10,46,77,0.35)' }} />}
      </button>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}

/** Same as Section but for the per-option box — slightly tighter styling */
function OptSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(10,46,77,0.1)', background: 'rgba(255,255,255,0.5)' }}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] f-body"
          style={{ color: 'rgba(10,46,77,0.5)' }}>{title}</span>
        {open
          ? <ChevronUp   size={12} style={{ color: 'rgba(10,46,77,0.3)' }} />
          : <ChevronDown size={12} style={{ color: 'rgba(10,46,77,0.3)' }} />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold f-body block mb-1"
        style={{ color: 'rgba(10,46,77,0.5)' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.8)',
  border:     '1px solid rgba(10,46,77,0.12)',
  color:      '#0A2E4D',
  outline:    'none',
}
