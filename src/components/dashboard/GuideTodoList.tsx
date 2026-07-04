'use client'

import { useState, useTransition, useRef } from 'react'
import { saveGuideOfferResponse } from '@/actions/inquiries'
import { createClient } from '@/lib/supabase/client'
import type { TripDetails, GuideOption } from '@/actions/inquiries'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.04)',
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
  textTransform: 'uppercase' as const,
  letterSpacing: '0.13em',
  color: 'rgba(10,46,77,0.4)',
  marginBottom: 6,
}

const CURRENCIES = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'ISK', label: 'ISK (kr)' },
] as const

type Currency = 'EUR' | 'USD' | 'ISK'

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', ISK: 'kr' }

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionDraft {
  spot:         string
  species:      string[]   // selected known species
  speciesOther: string     // extra free-text species
  currency:     Currency
  license_price: string
  guide_price:   string
  description:   string
  photos:        string[]      // already-uploaded URLs
  localPhotos:   File[]        // pending upload
}

interface Props {
  inquiryId:          string
  initialDetails:     TripDetails | null
  guideSpecies:       string[]
  externalOfferSent?: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuideTodoList({ inquiryId, initialDetails, guideSpecies, externalOfferSent = false }: Props) {

  function toSpeciesInit(
    species: string[] | string | null,
    knownSpecies: string[],
  ): { selected: string[]; other: string } {
    if (!species) return { selected: [], other: '' }
    // handle legacy string format
    const arr = Array.isArray(species) ? species : [species]
    const selected = arr.filter(s => knownSpecies.includes(s))
    const others   = arr.filter(s => !knownSpecies.includes(s))
    return { selected, other: others.join(', ') }
  }

  const initOptions: OptionDraft[] =
    (initialDetails?.guide_options ?? []).length > 0
      ? initialDetails!.guide_options.map(o => {
          const { selected, other } = toSpeciesInit(o.species ?? null, guideSpecies)
          return {
            spot:          o.spot          ?? '',
            species:       selected,
            speciesOther:  other,
            currency:      (o.currency     ?? 'EUR') as Currency,
            license_price: o.license_price != null ? String(o.license_price) : '',
            guide_price:   o.guide_price   != null ? String(o.guide_price)   : '',
            description:   o.description   ?? '',
            photos:        Array.isArray(o.photos) ? o.photos : [],
            localPhotos:   [],
          }
        })
      : [{ spot: '', species: [], speciesOther: '', currency: 'EUR' as Currency, license_price: '', guide_price: '', description: '', photos: [], localPhotos: [] }]

  const hasExistingOffer = (initialDetails?.guide_options ?? []).length > 0
  const [isSent,      setIsSent]      = useState(hasExistingOffer || externalOfferSent)
  const [finalDates,  setFinalDates]  = useState(initialDetails?.guide_final_dates ?? '')
  const [options,     setOptions]     = useState<OptionDraft[]>(initOptions)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)
  const [saving, startSave]           = useTransition()

  // One file-input ref slot per option (max 3)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])

  // ── Option management ──────────────────────────────────────────────────────

  function addOption() {
    if (options.length >= 3) return
    setOptions(prev => [...prev, {
      spot: '', species: [], speciesOther: '', currency: 'EUR',
      license_price: '', guide_price: '', description: '', photos: [], localPhotos: [],
    }])
  }

  function removeOption(i: number) {
    if (options.length <= 1) return
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, field: keyof Omit<OptionDraft, 'photos' | 'localPhotos' | 'species'>, val: string) {
    setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: val } : o))
  }

  function toggleSpecies(optIdx: number, s: string) {
    setOptions(prev => prev.map((o, idx) => {
      if (idx !== optIdx) return o
      const next = o.species.includes(s)
        ? o.species.filter(x => x !== s)
        : [...o.species, s]
      return { ...o, species: next }
    }))
  }

  // ── Photo management ───────────────────────────────────────────────────────

  function handleFilesSelected(i: number, files: FileList | null) {
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    setOptions(prev => prev.map((o, idx) =>
      idx === i ? { ...o, localPhotos: [...o.localPhotos, ...newFiles] } : o
    ))
  }

  function removeLocalPhoto(optIdx: number, photoIdx: number) {
    setOptions(prev => prev.map((o, idx) =>
      idx === optIdx
        ? { ...o, localPhotos: o.localPhotos.filter((_, pi) => pi !== photoIdx) }
        : o
    ))
  }

  function removeUploadedPhoto(optIdx: number, photoIdx: number) {
    setOptions(prev => prev.map((o, idx) =>
      idx === optIdx
        ? { ...o, photos: o.photos.filter((_, pi) => pi !== photoIdx) }
        : o
    ))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSaveOffer() {
    startSave(async () => {
      setSaveErr(null)
      const supabase = createClient()

      // Upload any local photos
      const processed = await Promise.all(
        options.map(async (opt, i) => {
          if (opt.localPhotos.length === 0) return opt
          const newUrls: string[] = []
          for (const file of opt.localPhotos) {
            const ext  = file.name.split('.').pop() ?? 'jpg'
            const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const path = `${inquiryId}/${i}/${name}`
            const { error } = await supabase.storage.from('offer-photos').upload(path, file)
            if (!error) {
              const { data } = supabase.storage.from('offer-photos').getPublicUrl(path)
              newUrls.push(data.publicUrl)
            }
          }
          return { ...opt, photos: [...opt.photos, ...newUrls], localPhotos: [] }
        })
      )
      setOptions(processed)

      const guideOptions: GuideOption[] = processed
        .filter(o => o.spot.trim() !== '')
        .map(o => {
          const allSpecies = [
            ...o.species,
            ...o.speciesOther.split(',').map(s => s.trim()).filter(Boolean),
          ]
          return {
            spot:          o.spot.trim(),
            species:       allSpecies.length > 0 ? allSpecies : null,
            currency:      o.currency,
            license_price: o.license_price !== '' ? Number(o.license_price) : null,
            guide_price:   o.guide_price   !== '' ? Number(o.guide_price)   : null,
            description:   o.description.trim()   || null,
            photos:        o.photos,
          }
        })

      const res = await saveGuideOfferResponse(inquiryId, {
        guide_final_dates: finalDates.trim() || null,
        guide_options: guideOptions,
      })
      if (!res.success) {
        setSaveErr(res.error ?? 'Failed to save')
      } else {
        setIsSent(true)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
          <div>
            <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Your Offer</h2>
            {!isSent && (
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Fill this in so FjordAnglers can build the final offer for the angler.
              </p>
            )}
          </div>
          {isSent && (
            <button type="button" onClick={() => setIsSent(false)}
              className="flex items-center gap-1.5 text-xs font-bold f-body px-3 py-1.5 rounded-lg"
              style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.06)', border: 'none', cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

        {/* ── Sent / locked view ── */}
        {isSent ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: externalOfferSent && !hasExistingOffer ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                  border:     externalOfferSent && !hasExistingOffer ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(16,185,129,0.25)',
                }}>
                <span className="text-[11px] font-bold f-body" style={{
                  color: externalOfferSent && !hasExistingOffer ? '#1E40AF' : '#065F46',
                }}>
                  {externalOfferSent && !hasExistingOffer ? '✓ FA sent the offer directly' : '✓ Offer submitted'}
                </span>
              </div>
              {finalDates.trim() && (
                <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>
                  📅 {finalDates}
                </span>
              )}
            </div>
            {externalOfferSent && !hasExistingOffer ? (
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                FjordAnglers has handled this offer directly with the angler. No action needed from you.
              </p>
            ) : null}
            {options.map((opt, i) => (
              <div key={i} className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1"
                  style={{ color: 'rgba(10,46,77,0.38)' }}>Option {i + 1}</p>
                <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{opt.spot || '—'}</p>
                {(opt.species.length > 0 || opt.speciesOther.trim()) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[...opt.species, ...opt.speciesOther.split(',').map(s => s.trim()).filter(Boolean)].map(s => (
                      <span key={s} className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(230,126,80,0.12)', color: '#C05A2E' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {(opt.license_price || opt.guide_price) && (
                  <p className="text-xs f-body mt-1.5 font-semibold" style={{ color: '#E67E50' }}>
                    {CURRENCY_SYMBOL[opt.currency]}
                    {opt.license_price && ` License: ${Number(opt.license_price).toLocaleString()}`}
                    {opt.guide_price   && ` · Guide: ${Number(opt.guide_price).toLocaleString()}`}
                  </p>
                )}
                {opt.description.trim() && (
                  <p className="text-xs f-body mt-2 leading-relaxed"
                    style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {opt.description}
                  </p>
                )}
                {(opt.photos.length > 0 || opt.localPhotos.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[...opt.photos].map((url, pi) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={pi} src={url} alt=""
                        className="w-14 h-14 rounded-lg object-cover"
                        style={{ border: '1px solid rgba(10,46,77,0.08)' }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Edit / fill view ── */
          <>

          <div>
            <label style={labelStyle}>Confirmed date(s)</label>
            <input
              type="text"
              value={finalDates}
              onChange={e => setFinalDates(e.target.value)}
              placeholder="e.g. 23–25 August 2026"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Fishing spot options</label>
            <div className="flex flex-col gap-3">
              {options.map((opt, i) => (
                <div key={i} className="rounded-[12px] p-3 flex flex-col gap-2"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>

                  {/* Option header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] f-body"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>Option {i + 1}</span>
                    {options.length > 1 && (
                      <button type="button" onClick={() => removeOption(i)}
                        className="text-base leading-none"
                        style={{ color: 'rgba(10,46,77,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                        aria-label="Remove option">×</button>
                    )}
                  </div>

                  {/* Spot */}
                  <input type="text" value={opt.spot}
                    onChange={e => updateOption(i, 'spot', e.target.value)}
                    placeholder="Fishing spot / river / lake…" style={inputStyle} />

                  {/* Species multi-picker */}
                  {guideSpecies.length > 0 && (
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>Target species</label>
                      <div className="flex flex-wrap gap-1.5">
                        {guideSpecies.map(s => {
                          const selected = opt.species.includes(s)
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSpecies(i, s)}
                              className="text-[11px] font-semibold f-body px-2.5 py-1 rounded-full transition-all"
                              style={{
                                background: selected ? '#E67E50' : 'rgba(10,46,77,0.06)',
                                color:      selected ? '#fff'    : 'rgba(10,46,77,0.55)',
                                border:     selected ? 'none'    : '1px solid rgba(10,46,77,0.1)',
                                cursor: 'pointer',
                              }}
                            >
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <input type="text" value={opt.speciesOther}
                    onChange={e => updateOption(i, 'speciesOther', e.target.value)}
                    placeholder="Other species (comma-separated)…" style={inputStyle} />

                  {/* Currency */}
                  <div className="flex items-center gap-2">
                    <span style={{ ...labelStyle, marginBottom: 0, flexShrink: 0 }}>Currency</span>
                    <select value={opt.currency}
                      onChange={e => updateOption(i, 'currency', e.target.value)}
                      style={{ ...inputStyle, width: 'auto', cursor: 'pointer', padding: '6px 10px' }}>
                      {CURRENCIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 4 }}>
                        Fishing license ({CURRENCY_SYMBOL[opt.currency]})
                      </label>
                      <input type="number" value={opt.license_price}
                        onChange={e => updateOption(i, 'license_price', e.target.value)}
                        placeholder="0" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 4 }}>
                        Guide service ({CURRENCY_SYMBOL[opt.currency]})
                      </label>
                      <input type="number" value={opt.guide_price}
                        onChange={e => updateOption(i, 'guide_price', e.target.value)}
                        placeholder="0" style={inputStyle} />
                    </div>
                  </div>

                  {/* Description */}
                  <textarea rows={3} value={opt.description}
                    onChange={e => updateOption(i, 'description', e.target.value)}
                    placeholder="What the angler can expect — technique, typical day, scenery…"
                    style={{ ...inputStyle, resize: 'vertical' }} />

                  {/* Photos */}
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Photos (optional)</label>

                    {/* Previews */}
                    {(opt.photos.length > 0 || opt.localPhotos.length > 0) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {opt.photos.map((url, pi) => (
                          <div key={`u-${pi}`} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                            style={{ border: '1px solid rgba(10,46,77,0.1)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button type="button"
                              onClick={() => removeUploadedPhoto(i, pi)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                              aria-label="Remove photo">×</button>
                          </div>
                        ))}
                        {opt.localPhotos.map((file, pi) => (
                          <div key={`l-${pi}`} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                            style={{ border: '1px solid rgba(230,126,80,0.35)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                            <button type="button"
                              onClick={() => removeLocalPhoto(i, pi)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                              aria-label="Remove photo">×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={el => { fileRefs.current[i] = el }}
                      onChange={e => { handleFilesSelected(i, e.target.files); e.target.value = '' }}
                    />
                    <button type="button"
                      onClick={() => fileRefs.current[i]?.click()}
                      className="text-xs font-bold f-body"
                      style={{ color: '#E67E50', background: 'transparent', border: '1px dashed rgba(230,126,80,0.4)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                      + Add photos
                    </button>
                  </div>

                </div>
              ))}

              {options.length < 3 && (
                <button type="button" onClick={addOption}
                  className="text-xs font-bold f-body text-left"
                  style={{ color: '#E67E50', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  + Add another spot option
                </button>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSaveOffer} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
              style={{
                background: '#E67E50',
                color:      '#fff',
                border:     'none',
                cursor:     saving ? 'not-allowed' : 'pointer',
                opacity:    saving ? 0.7 : 1,
              }}>
              {saving ? 'Saving…' : 'Send offer details'}
            </button>
            {isSent && (
              <button type="button" onClick={() => setIsSent(true)}
                className="text-sm f-body"
                style={{ color: 'rgba(10,46,77,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
            {saveErr != null && (
              <p className="text-xs f-body" style={{ color: '#DC2626' }}>{saveErr}</p>
            )}
          </div>

        </>
        )}

        </div>
      </div>
    </div>
  )
}
