'use client'

import { useState, useTransition } from 'react'
import { saveTripDetails } from '@/actions/inquiries'
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
            !isEditing ? (
              <button type="button" onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs font-bold f-body px-3 py-1.5 rounded-lg transition-all"
                style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.06)', border: 'none', cursor: 'pointer' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            ) : (
              <button type="button" onClick={() => setIsEditing(false)}
                className="text-xs font-bold f-body px-3 py-1.5 rounded-lg"
                style={{ color: 'rgba(10,46,77,0.45)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            )
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
              <div className="flex gap-3 mb-5">
                <div style={{ flex: '1 1 0' }}>
                  <label style={labelStyle}>Date</label>
                  <input type="text" value={confirmedDate}
                    onChange={e => setConfirmedDate(e.target.value)}
                    placeholder="e.g. 23 Aug 2026" style={inputStyle} />
                </div>
                <div style={{ flex: '0 0 110px' }}>
                  <label style={labelStyle}>Group size</label>
                  <input type="number" min={1} max={20} value={confirmedParty}
                    onChange={e => setConfirmedParty(e.target.value)}
                    style={inputStyle} />
                </div>
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Price range</label>
                <input type="text" value={priceRange}
                  onChange={e => setPriceRange(e.target.value)}
                  placeholder="e.g. €500/day · €1,200–€1,500 total" style={inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Date flexibility</label>
                <select value={dateFlex} onChange={e => setDateFlex(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {DATE_FLEX_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Species the angler wants to catch</label>
                <input type="text" value={targetSpecies}
                  onChange={e => setTargetSpecies(e.target.value)}
                  placeholder="e.g. Atlantic salmon · Brown trout · Pike" style={inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Accommodation</label>
                <input type="text" value={accommodation}
                  onChange={e => setAccommodation(e.target.value)}
                  placeholder="e.g. Included in price · Self-arranged · Camping" style={inputStyle} />
              </div>

              <div className="mb-5">
                <label style={labelStyle}>Note for guide</label>
                <textarea rows={3} value={guideNotes}
                  onChange={e => setGuideNotes(e.target.value)}
                  placeholder="Any other info the guide needs to know…"
                  style={{ ...inputStyle, resize: 'vertical' }} />
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
              {initialDetails!.guide_options.map((opt, i) => (
                <div key={i} className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] f-body mb-1.5"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>Option {i + 1}</p>
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{opt.spot}</p>
                  {opt.species != null && opt.species !== '' && (
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.55)' }}>{opt.species}</p>
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
