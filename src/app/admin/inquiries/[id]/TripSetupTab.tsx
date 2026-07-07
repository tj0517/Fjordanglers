'use client'

import { useState, useTransition } from 'react'
import { saveTripDetails } from '@/actions/inquiries'
import { extractTripDetailsAI } from '@/actions/ai'
import type { TripDetails } from '@/actions/inquiries'

export type { TripDetails }

// ─── Date flexibility options ─────────────────────────────────────────────────

const DATE_FLEX_OPTIONS = [
  { value: '',               label: '— not set —' },
  { value: 'fixed',          label: 'Fixed — not flexible' },
  { value: 'flexible_1_2',   label: 'Slightly flexible (±1–2 days)' },
  { value: 'flexible_week',  label: 'Flexible within the week' },
  { value: 'very_flexible',  label: 'Very flexible (month only)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.03)',
  border: '1px solid rgba(10,46,77,0.1)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  color: '#0A2E4D',
  outline: 'none',
  fontFamily: 'inherit',
}

// AI-suggested field highlight style
const aiInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'rgba(230,126,80,0.08)',
  border: '1px solid #E67E50',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'rgba(10,46,77,0.4)',
  marginBottom: 6,
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
      <div className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.07)', background: 'rgba(230,126,80,0.03)' }}>
        <h3 className="text-sm font-bold f-display text-[#0A2E4D]">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  )
}

// ─── Read-only brief row ──────────────────────────────────────────────────────

function BriefReadRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.13em] f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.35)', minWidth: 110 }}>{label}</span>
      <span className="text-sm f-body text-right leading-relaxed" style={{ color: '#0A2E4D' }}>{value}</span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inquiryId:       string
  anglerName:      string
  requestedDates:  string[]
  partySize:       number
  experienceTitle: string | null
  anglerMessage:   string | null
  initialDetails:  TripDetails | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TripSetupTab({
  inquiryId,
  anglerName,
  requestedDates,
  partySize,
  experienceTitle,
  anglerMessage,
  initialDetails,
}: Props) {
  const d = initialDetails

  // ── Trip brief state ──────────────────────────────────────────────────────
  const hasExistingBrief = d != null && (d.price_range ?? d.date_flexibility ?? d.target_species ?? d.accommodation ?? d.guide_notes) != null
  const [isEditing,      setIsEditing]      = useState(!hasExistingBrief)
  const [confirmedDate,  setConfirmedDate]  = useState(
    d?.confirmed_date ?? (requestedDates.length > 0 ? requestedDates.map(fmtDate).join(', ') : '')
  )
  const [confirmedParty, setConfirmedParty] = useState(
    String(d?.confirmed_party_size ?? partySize)
  )
  const [priceRange,     setPriceRange]     = useState(d?.price_range      ?? '')
  const [dateFlex,       setDateFlex]       = useState(d?.date_flexibility  ?? '')
  const [targetSpecies,  setTargetSpecies]  = useState(d?.target_species   ?? '')
  const [accommodation,  setAccommodation]  = useState(d?.accommodation    ?? '')
  const [guideNotes,     setGuideNotes]     = useState(d?.guide_notes      ?? '')
  const [saveErr,        setSaveErr]        = useState<string | null>(null)
  const [saving, startSave]                 = useTransition()

  // ── AI extraction state ────────────────────────────────────────────────────
  const [aiLoading,        setAiLoading]        = useState(false)
  const [aiError,          setAiError]          = useState<string | null>(null)
  const [aiSummary,        setAiSummary]        = useState<string | null>(null)
  // Track which fields were AI-suggested (cleared when user edits or saves)
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Set<string>>(new Set())

  function markUserEdit(field: string) {
    if (aiSuggestedFields.has(field)) {
      setAiSuggestedFields(prev => {
        const next = new Set(prev)
        next.delete(field)
        return next
      })
    }
  }

  async function handleExtractAI() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await extractTripDetailsAI(inquiryId)
      if (!result.success) {
        setAiError(result.error)
        return
      }
      const { data } = result
      if (data.summary) setAiSummary(data.summary)
      const suggested = new Set<string>()

      if (data.confirmed_date != null && data.confirmed_date !== '') {
        setConfirmedDate(data.confirmed_date)
        suggested.add('confirmedDate')
      }
      if (data.confirmed_party_size != null) {
        setConfirmedParty(String(data.confirmed_party_size))
        suggested.add('confirmedParty')
      }
      if (data.price_range != null && data.price_range !== '') {
        setPriceRange(data.price_range)
        suggested.add('priceRange')
      }
      if (data.date_flexibility != null) {
        setDateFlex(data.date_flexibility)
        suggested.add('dateFlex')
      }
      if (data.target_species != null && data.target_species !== '') {
        setTargetSpecies(data.target_species)
        suggested.add('targetSpecies')
      }
      if (data.accommodation != null && data.accommodation !== '') {
        setAccommodation(data.accommodation)
        suggested.add('accommodation')
      }
      if (data.guide_notes != null && data.guide_notes !== '') {
        setGuideNotes(data.guide_notes)
        suggested.add('guideNotes')
      }

      setAiSuggestedFields(suggested)
      // Make sure edit mode is open so user can review
      setIsEditing(true)
    } finally {
      setAiLoading(false)
    }
  }

  function handleSave() {
    startSave(async () => {
      setSaveErr(null)
      const parsedParty = parseInt(confirmedParty, 10)
      const res = await saveTripDetails(inquiryId, {
        confirmed_date:       confirmedDate.trim()  || undefined,
        confirmed_party_size: !isNaN(parsedParty) ? parsedParty : undefined,
        price_range:          priceRange.trim()     || undefined,
        date_flexibility:     dateFlex              || undefined,
        target_species:       targetSpecies.trim()  || undefined,
        accommodation:        accommodation.trim()  || undefined,
        guide_notes:          guideNotes.trim()     || undefined,
      })
      if (!res.success) {
        setSaveErr(res.error ?? 'Failed to save')
      } else {
        setIsEditing(false)
        // Clear all AI highlights and summary after save
        setAiSuggestedFields(new Set())
        setAiSummary(null)
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

      {/* ── LEFT: Trip brief ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">

        {/* Read-only inquiry summary */}
        <div className="rounded-[18px] px-5 py-4 flex flex-wrap gap-x-8 gap-y-3"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <div>
            <p style={labelStyle}>Angler</p>
            <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{anglerName}</p>
          </div>
          <div>
            <p style={labelStyle}>Dates</p>
            <p className="text-sm f-body" style={{ color: '#0A2E4D' }}>
              {requestedDates.length > 0 ? requestedDates.map(fmtDate).join(', ') : 'TBD'}
            </p>
          </div>
          <div>
            <p style={labelStyle}>Group size</p>
            <p className="text-sm f-body" style={{ color: '#0A2E4D' }}>
              {partySize} {partySize === 1 ? 'person' : 'people'}
            </p>
          </div>
          {experienceTitle != null && (
            <div>
              <p style={labelStyle}>Experience</p>
              <p className="text-sm f-body" style={{ color: '#0A2E4D' }}>{experienceTitle}</p>
            </div>
          )}
          {anglerMessage != null && anglerMessage.trim() !== '' && (
            <div className="w-full">
              <p style={labelStyle}>Angler&apos;s message</p>
              <p className="text-sm f-body italic leading-relaxed" style={{ color: '#374151' }}>
                &ldquo;{anglerMessage}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Trip brief — locked by default, edit mode via pencil button */}
        <Card
          title="Trip Brief"
          action={
            <div className="flex items-center gap-2">
              {/* Extract with AI button — visible in edit mode */}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleExtractAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs font-bold f-body px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    color: aiLoading ? 'rgba(230,126,80,0.5)' : '#E67E50',
                    background: 'rgba(230,126,80,0.08)',
                    border: '1px solid rgba(230,126,80,0.25)',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                  }}>
                  {aiLoading ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8"/>
                      </svg>
                      Extracting…
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L9 9H2L7.5 13.5L5.5 21L12 17L18.5 21L16.5 13.5L22 9H15L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                      Extract with AI
                    </>
                  )}
                </button>
              )}

              {/* Edit / Cancel toggle */}
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-bold f-body px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.06)', border: 'none', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
              ) : (
                <button type="button" onClick={() => { setIsEditing(false); setAiError(null); setAiSummary(null) }}
                  className="text-xs font-bold f-body px-3 py-1.5 rounded-lg"
                  style={{ color: 'rgba(10,46,77,0.45)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          }
        >
          {!isEditing ? (
            /* ── Locked view ── */
            <div className="pb-1">
              <BriefReadRow label="Date"           value={confirmedDate  || null} />
              <BriefReadRow label="Group size"     value={confirmedParty ? `${confirmedParty} ${Number(confirmedParty) === 1 ? 'person' : 'people'}` : null} />
              <BriefReadRow label="Price range"    value={priceRange     || null} />
              <BriefReadRow label="Date flex"      value={DATE_FLEX_OPTIONS.find(o => o.value === dateFlex)?.label || null} />
              <BriefReadRow label="Target species" value={targetSpecies  || null} />
              <BriefReadRow label="Accommodation"  value={accommodation  || null} />
              <BriefReadRow label="Note for guide" value={guideNotes     || null} />
              {!confirmedDate && !priceRange && !dateFlex && !targetSpecies && !accommodation && !guideNotes && (
                <p className="text-xs f-body italic" style={{ color: 'rgba(10,46,77,0.35)' }}>
                  No brief filled in yet. Click Edit to add details.
                </p>
              )}
            </div>
          ) : (
            /* ── Edit view ── */
            <div>
              {/* AI error banner */}
              {aiError != null && (
                <div className="mb-4 px-3 py-2.5 rounded-xl text-xs f-body"
                  style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>
                  AI extraction failed: {aiError}
                </div>
              )}

              {/* AI summary */}
              {aiSummary != null && (
                <div className="mb-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] f-body mb-1.5"
                    style={{ color: '#E67E50' }}>AI Summary</p>
                  <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>{aiSummary}</p>
                </div>
              )}

              {/* AI hint banner */}
              {aiSuggestedFields.size > 0 && (
                <div className="mb-4 px-3 py-2.5 rounded-xl text-xs f-body flex items-center gap-2"
                  style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.25)', color: '#E67E50' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                    <path d="M12 2L9 9H2L7.5 13.5L5.5 21L12 17L18.5 21L16.5 13.5L22 9H15L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                  AI-suggested fields are highlighted. Review and edit before saving.
                </div>
              )}

              <div className="flex gap-3 mb-5">
                <div style={{ flex: '1 1 0' }}>
                  <label style={labelStyle}>Date</label>
                  <input type="text" value={confirmedDate}
                    onChange={e => { setConfirmedDate(e.target.value); markUserEdit('confirmedDate') }}
                    placeholder="e.g. 23 Aug 2026"
                    style={aiSuggestedFields.has('confirmedDate') ? aiInputStyle : inputStyle} />
                </div>
                <div style={{ flex: '0 0 110px' }}>
                  <label style={labelStyle}>Group size</label>
                  <input type="number" min={1} max={20} value={confirmedParty}
                    onChange={e => { setConfirmedParty(e.target.value); markUserEdit('confirmedParty') }}
                    style={aiSuggestedFields.has('confirmedParty') ? aiInputStyle : inputStyle} />
                </div>
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Price range</label>
                <input type="text" value={priceRange}
                  onChange={e => { setPriceRange(e.target.value); markUserEdit('priceRange') }}
                  placeholder="e.g. €500/day · €1,200–€1,500 total"
                  style={aiSuggestedFields.has('priceRange') ? aiInputStyle : inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Date flexibility</label>
                <select value={dateFlex}
                  onChange={e => { setDateFlex(e.target.value); markUserEdit('dateFlex') }}
                  style={{ ...(aiSuggestedFields.has('dateFlex') ? aiInputStyle : inputStyle), cursor: 'pointer' }}>
                  {DATE_FLEX_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Species the angler wants to catch</label>
                <input type="text" value={targetSpecies}
                  onChange={e => { setTargetSpecies(e.target.value); markUserEdit('targetSpecies') }}
                  placeholder="e.g. Atlantic salmon · Brown trout · Pike"
                  style={aiSuggestedFields.has('targetSpecies') ? aiInputStyle : inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Accommodation</label>
                <input type="text" value={accommodation}
                  onChange={e => { setAccommodation(e.target.value); markUserEdit('accommodation') }}
                  placeholder="e.g. Included in price · Self-arranged · Camping"
                  style={aiSuggestedFields.has('accommodation') ? aiInputStyle : inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Note for guide</label>
                <textarea rows={3} value={guideNotes}
                  onChange={e => { setGuideNotes(e.target.value); markUserEdit('guideNotes') }}
                  placeholder="Any other info the guide needs to know…"
                  style={{ ...(aiSuggestedFields.has('guideNotes') ? aiInputStyle : inputStyle), resize: 'vertical' }} />
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-bold f-body transition-all"
                  style={{
                    background: '#0A2E4D', color: '#fff', border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  }}>
                  {saving ? 'Saving…' : 'Save & lock'}
                </button>
                {saveErr != null && (
                  <p className="text-xs f-body" style={{ color: '#DC2626' }}>{saveErr}</p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── RIGHT: Guide response + To-dos ───────────────────────────────── */}
      <div className="lg:sticky lg:top-6 flex flex-col gap-4">

        {/* Guide's offer response (read-only) */}
        <Card title="Guide's Response">
          {(initialDetails?.guide_options ?? []).length === 0 ? (
            <p className="text-xs f-body italic" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Waiting for the guide to fill in their offer details.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {initialDetails!.guide_final_dates != null && initialDetails!.guide_final_dates.trim() !== '' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] f-body flex-shrink-0"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>Dates</span>
                  <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    {initialDetails!.guide_final_dates}
                  </span>
                </div>
              )}
              {initialDetails!.guide_options.map((opt, i) => (
                <div key={i} className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] f-body mb-1.5"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>Option {i + 1}</p>
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{opt.spot}</p>
                  {Array.isArray(opt.species) && opt.species.length > 0 && (
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.55)' }}>{opt.species.join(', ')}</p>
                  )}
                  {(opt.license_price != null || opt.guide_price != null) && (
                    <p className="text-xs font-bold f-body mt-1" style={{ color: '#E67E50' }}>
                      {opt.currency ?? 'EUR'}
                      {opt.license_price != null && ` · License: ${Number(opt.license_price).toLocaleString()}`}
                      {opt.guide_price   != null && ` · Guide: ${Number(opt.guide_price).toLocaleString()}`}
                    </p>
                  )}
                  {opt.description != null && opt.description !== '' && (
                    <p className="text-xs f-body mt-2 leading-relaxed"
                      style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                      {opt.description}
                    </p>
                  )}
                  {Array.isArray(opt.photos) && opt.photos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {opt.photos.map((url, pi) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={pi} src={url} alt=""
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          style={{ border: '1px solid rgba(10,46,77,0.08)' }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

    </div>
  )
}
