'use client'

/**
 * OfferBuilder — FA builds a rich personalised offer.
 *
 * Sections:
 *   1. Pricing & Deposit
 *   2. Location (text description + interactive map — pin or area)
 *   3. Photos (upload up to 8)
 *   4. Schedule (day-by-day structured entries)
 *   5. What's Included (tied to total price)
 *   6. What to Bring
 *   7. Fishing Licence (heading + body)
 *   8. Questions for the angler
 *   9. Note to angler
 */

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { saveRichOffer } from '@/actions/inquiries'
import { uploadOfferPhoto } from '@/actions/offer-photos'
import type { OfferQuestion, ScheduleEntry } from '@/actions/inquiries'
import type { Feature, Polygon } from 'geojson'
import {
  Loader2, Check, Copy, ExternalLink, Plus, Trash2,
  ChevronDown, ChevronUp, ImageIcon, X,
} from 'lucide-react'

// LocationPicker is dynamically imported to avoid SSR issues with Leaflet
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

interface Props {
  inquiryId: string
  tripTitle: string
  estimatedTotalEur: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OfferBuilder({ inquiryId, tripTitle, estimatedTotalEur }: Props) {

  // ── Pricing ─────────────────────────────────────────────────────────────────
  const [totalEur,     setTotalEur]    = useState(estimatedTotalEur > 0 ? estimatedTotalEur : 0)
  const [depositEur,   setDepositEur]  = useState(
    estimatedTotalEur > 0 ? Math.round(estimatedTotalEur * 0.3 * 100) / 100 : 0
  )
  const [refundReason, setRefundReason] = useState(
    'If you need to cancel, the deposit is fully refundable up to 14 days before the trip date.'
  )

  // ── Location ─────────────────────────────────────────────────────────────────
  const [location,        setLocation]        = useState('')
  const [locationLat,     setLocationLat]     = useState<number | null>(null)
  const [locationLng,     setLocationLng]     = useState<number | null>(null)
  const [locationZoom,    setLocationZoom]    = useState(8)
  const [locationGeoJson, setLocationGeoJson] = useState<object | null>(null)
  const [showMap,         setShowMap]         = useState(false)

  // ── Photos ───────────────────────────────────────────────────────────────────
  const [photos,      setPhotos]      = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Schedule ─────────────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])

  // ── Inclusions ───────────────────────────────────────────────────────────────
  const [inclusions, setInclusions] = useState<string[]>([
    'Professional guide',
    'Fishing equipment & tackle',
    'Fishing licence',
  ])

  // ── What to bring ────────────────────────────────────────────────────────────
  const [whatToBring, setWhatToBring] = useState<string[]>([
    'Warm waterproof jacket',
    'Rubber-soled shoes or waders',
  ])

  // ── Fishing licence ──────────────────────────────────────────────────────────
  const [licenseHeading, setLicenseHeading] = useState('')
  const [licenseInfo,    setLicenseInfo]    = useState('')

  // ── Questions ────────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<OfferQuestion[]>([])

  // ── Notes ────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')

  // ── Section open/closed ──────────────────────────────────────────────────────
  const [open, setOpen] = useState<Record<string, boolean>>({
    pricing:     true,
    location:    true,
    photos:      true,
    schedule:    true,
    inclusions:  true,
    whatToBring: false,
    license:     false,
    questions:   false,
    notes:       false,
  })
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }))

  // ── Submission ───────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [result, setResult]          = useState<{ offerUrl: string } | { error: string } | null>(null)
  const [copied, setCopied]          = useState(false)

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
      if (urls.length > 0)    setPhotos(p => [...p, ...urls])
      if (errors.length > 0)  setUploadError(errors[0])
    } finally {
      setUploading(false)
    }
  }

  // ─── Schedule handlers ────────────────────────────────────────────────────────
  function addDay() {
    const n = schedule.length + 1
    setSchedule(p => [...p, { id: crypto.randomUUID(), label: `Day ${n}`, title: '', description: '' }])
  }
  function updateEntry(id: string, field: keyof ScheduleEntry, value: string) {
    setSchedule(p => p.map(e => e.id === id ? { ...e, [field]: value } : e))
  }
  function removeEntry(id: string) {
    setSchedule(p => p.filter(e => e.id !== id))
  }

  // ─── Inclusions ───────────────────────────────────────────────────────────────
  function addInclusion()                          { setInclusions(p => [...p, '']) }
  function updateInclusion(i: number, v: string)   { setInclusions(p => p.map((x, j) => j === i ? v : x)) }
  function removeInclusion(i: number)              { setInclusions(p => p.filter((_, j) => j !== i)) }

  // ─── What to bring ────────────────────────────────────────────────────────────
  function addBringItem()                          { setWhatToBring(p => [...p, '']) }
  function updateBringItem(i: number, v: string)   { setWhatToBring(p => p.map((x, j) => j === i ? v : x)) }
  function removeBringItem(i: number)              { setWhatToBring(p => p.filter((_, j) => j !== i)) }

  // ─── Questions ────────────────────────────────────────────────────────────────
  function addQuestion()                           { setQuestions(p => [...p, { id: crypto.randomUUID(), question: '' }]) }
  function updateQuestion(id: string, v: string)   { setQuestions(p => p.map(q => q.id === id ? { ...q, question: v } : q)) }
  function removeQuestion(id: string)              { setQuestions(p => p.filter(q => q.id !== id)) }

  // ─── Submit ───────────────────────────────────────────────────────────────────
  function handleSend() {
    startTransition(async () => {
      const res = await saveRichOffer(inquiryId, {
        totalPriceEur:  totalEur,
        depositEur,
        notes:          notes.trim() || null,
        tripPlan:       null,
        licenseInfo:    licenseInfo.trim() || null,
        licenseHeading: licenseHeading.trim() || null,
        inclusions:     inclusions.filter(x => x.trim() !== ''),
        questions:      questions.filter(q => q.question.trim() !== ''),
        refundReason:   refundReason.trim() || null,
        photos,
        location:       location.trim() || null,
        whatToBring:    whatToBring.filter(x => x.trim() !== ''),
        schedule:       schedule.filter(e => e.title.trim() !== '' || e.description.trim() !== ''),
        locationLat,
        locationLng,
        locationZoom,
        locationGeoJson,
      })
      setResult(res.success ? { offerUrl: res.offerUrl! } : { error: res.error })
    })
  }

  function handleCopy(url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── Success ─────────────────────────────────────────────────────────────────
  if (result != null && 'offerUrl' in result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Check size={16} style={{ color: '#065F46', flexShrink: 0 }} />
          <p className="text-sm font-semibold f-body" style={{ color: '#065F46' }}>
            Offer email sent! Magic link ready.
          </p>
        </div>
        <div className="p-4 rounded-xl"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1.5"
            style={{ color: 'rgba(10,46,77,0.4)' }}>Offer URL</p>
          <p className="text-xs f-body break-all" style={{ color: '#0A2E4D' }}>{result.offerUrl}</p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => handleCopy((result as { offerUrl: string }).offerUrl)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={(result as { offerUrl: string }).offerUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body"
            style={{ background: '#E67E50', color: '#fff' }}>
            <ExternalLink size={14} /> Preview
          </a>
        </div>
        <button type="button" onClick={() => setResult(null)}
          className="w-full py-2 rounded-xl text-xs f-body"
          style={{ color: 'rgba(10,46,77,0.4)' }}>
          Edit &amp; resend offer
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

  const depositPct = totalEur > 0 ? Math.round((depositEur / totalEur) * 100) : 0

  // ─── Builder form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── 1. Pricing ─────────────────────────────────────────────────────── */}
      <Section title="Pricing & Deposit" open={open.pricing} onToggle={() => toggle('pricing')}>
        <div className="space-y-3">
          <Field label="Total trip price (€)">
            <input type="number" min={0} step={0.01} value={totalEur || ''}
              onChange={e => { const v = parseFloat(e.target.value) || 0; setTotalEur(v); setDepositEur(Math.round(v * 0.3 * 100) / 100) }}
              className="w-full px-3 py-2 rounded-lg text-sm f-body" style={inputStyle} placeholder="e.g. 850" />
          </Field>

          <Field label={`Deposit (€) — ${depositPct}% of total`}>
            <input type="number" min={0} step={0.01} value={depositEur || ''}
              onChange={e => setDepositEur(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg text-sm f-body" style={inputStyle} placeholder="e.g. 255" />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[20, 25, 30, 40, 50].map(pct => (
                <button key={pct} type="button"
                  onClick={() => setDepositEur(Math.round(totalEur * pct / 100 * 100) / 100)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold f-body"
                  style={{ background: depositPct === pct ? '#0A2E4D' : 'rgba(10,46,77,0.06)', color: depositPct === pct ? '#fff' : 'rgba(10,46,77,0.5)' }}>
                  {pct}%
                </button>
              ))}
            </div>
          </Field>

          {totalEur > 0 && depositEur > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-xs f-body"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}>
              <span style={{ color: 'rgba(10,46,77,0.5)' }}>Pays now: </span>
              <strong style={{ color: '#E67E50' }}>€{depositEur.toFixed(2)}</strong>
              <span style={{ color: 'rgba(10,46,77,0.4)' }}> · pays guide: </span>
              <strong style={{ color: '#0A2E4D' }}>€{(totalEur - depositEur).toFixed(2)}</strong>
            </div>
          )}

          <Field label="Why is the deposit refundable?">
            <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
              style={inputStyle} placeholder="e.g. Fully refundable if cancelled 14+ days before." />
          </Field>
        </div>
      </Section>

      {/* ── 2. Location ────────────────────────────────────────────────────── */}
      <Section title="Location — Where It Happens" open={open.location} onToggle={() => toggle('location')}>
        <div className="space-y-2">
          <textarea value={location} onChange={e => setLocation(e.target.value)}
            rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
            style={inputStyle}
            placeholder="e.g. Gaula River, central Norway — 45 min from Trondheim Airport." />

          {/* Map toggle */}
          <button type="button" onClick={() => setShowMap(p => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold f-body py-1.5 px-3 rounded-lg"
            style={{ color: '#E67E50', background: 'rgba(230,126,80,0.08)' }}>
            🗺 {showMap ? 'Hide map' : (locationLat != null ? 'Edit on map' : 'Set on map')}
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

      {/* ── 3. Photos ──────────────────────────────────────────────────────── */}
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

      {/* ── 4. Schedule ────────────────────────────────────────────────────── */}
      <Section title={`Schedule${schedule.length > 0 ? ` (${schedule.length} days)` : ''}`}
        open={open.schedule} onToggle={() => toggle('schedule')}>
        <div className="space-y-3">
          {schedule.length === 0 && (
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              No days added yet. Build a day-by-day schedule for the angler.
            </p>
          )}
          {schedule.map((entry, i) => (
            <div key={entry.id} className="rounded-xl p-3 space-y-2"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(10,46,77,0.1)' }}>
              <div className="flex items-center gap-2">
                <input type="text" value={entry.label}
                  onChange={e => updateEntry(entry.id, 'label', e.target.value)}
                  className="w-20 px-2 py-1 rounded-md text-xs font-bold f-body text-center"
                  style={{ ...inputStyle, color: '#E67E50' }}
                  placeholder={`Day ${i + 1}`} />
                <input type="text" value={entry.title}
                  onChange={e => updateEntry(entry.id, 'title', e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold f-body"
                  style={inputStyle}
                  placeholder="e.g. Arrival & Briefing" />
                <button type="button" onClick={() => removeEntry(entry.id)}
                  className="p-1 rounded-md hover:opacity-60 flex-shrink-0"
                  style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea value={entry.description}
                onChange={e => updateEntry(entry.id, 'description', e.target.value)}
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
      </Section>

      {/* ── 5. What's Included ─────────────────────────────────────────────── */}
      <Section
        title={totalEur > 0 ? `What's Included — €${totalEur.toFixed(0)} offer` : "What's Included"}
        open={open.inclusions} onToggle={() => toggle('inclusions')}>
        <div className="space-y-2">
          {inclusions.map((item, i) => (
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
      </Section>

      {/* ── 6. What to Bring ───────────────────────────────────────────────── */}
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

      {/* ── 7. Fishing Licence ─────────────────────────────────────────────── */}
      <Section title="Fishing Licence" open={open.license} onToggle={() => toggle('license')}>
        <div className="space-y-2">
          <input type="text" value={licenseHeading} onChange={e => setLicenseHeading(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-semibold f-body" style={inputStyle}
            placeholder="e.g. Norwegian Freshwater Fishing Licence" />
          <textarea value={licenseInfo} onChange={e => setLicenseInfo(e.target.value)}
            rows={4} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
            style={inputStyle}
            placeholder="Describe what licence is required, whether it's included in the price, where to buy it, and any rules specific to this river or area." />
        </div>
      </Section>

      {/* ── 8. Questions ───────────────────────────────────────────────────── */}
      <Section title={`Questions for Angler${questions.length > 0 ? ` (${questions.length})` : ''}`}
        open={open.questions} onToggle={() => toggle('questions')}>
        <div className="space-y-2">
          {questions.length === 0 && (
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              No questions yet. Add questions the angler must answer before paying.
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

      {/* ── 9. Note ────────────────────────────────────────────────────────── */}
      <Section title="Note to Angler (optional)" open={open.notes} onToggle={() => toggle('notes')}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={3} className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
          style={inputStyle} placeholder="Any personal message for the angler…" />
      </Section>

      {/* ── Send ───────────────────────────────────────────────────────────── */}
      <button type="button" onClick={handleSend}
        disabled={isPending || totalEur <= 0 || depositEur <= 0 || uploading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold f-body mt-1"
        style={{
          background: (isPending || totalEur <= 0 || depositEur <= 0 || uploading) ? 'rgba(230,126,80,0.5)' : '#E67E50',
          color:  '#fff',
          cursor: (isPending || totalEur <= 0 || depositEur <= 0 || uploading) ? 'not-allowed' : 'pointer',
          boxShadow: (isPending || totalEur <= 0 || depositEur <= 0 || uploading) ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
        }}>
        {isPending    ? <><Loader2 size={14} className="animate-spin" /> Sending offer…</> :
         uploading    ? <><Loader2 size={14} className="animate-spin" /> Photos uploading…</> :
         '✉ Send Offer Email →'}
      </button>

      <p className="text-[11px] f-body text-center" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Angler receives a magic link to view the full offer and pay the deposit.
      </p>
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
