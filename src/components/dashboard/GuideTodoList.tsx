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
  spot:          string
  speciesSelect: string   // value from dropdown ('other' triggers free text)
  speciesOther:  string   // free text when 'other' is selected
  currency:      Currency
  license_price: string
  guide_price:   string
  description:   string
  photos:        string[]      // already-uploaded URLs
  localPhotos:   File[]        // pending upload
}

interface Props {
  inquiryId:      string
  initialDetails: TripDetails | null
  guideSpecies:   string[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuideTodoList({ inquiryId, initialDetails, guideSpecies }: Props) {

  function toSelectValue(species: string | null, knownSpecies: string[]): { sel: string; other: string } {
    if (!species) return { sel: '', other: '' }
    if (knownSpecies.includes(species)) return { sel: species, other: '' }
    return { sel: 'other', other: species }
  }

  const initOptions: OptionDraft[] =
    (initialDetails?.guide_options ?? []).length > 0
      ? initialDetails!.guide_options.map(o => {
          const { sel, other } = toSelectValue(o.species ?? null, guideSpecies)
          return {
            spot:          o.spot          ?? '',
            speciesSelect: sel,
            speciesOther:  other,
            currency:      (o.currency     ?? 'EUR') as Currency,
            license_price: o.license_price != null ? String(o.license_price) : '',
            guide_price:   o.guide_price   != null ? String(o.guide_price)   : '',
            description:   o.description   ?? '',
            photos:        Array.isArray(o.photos) ? o.photos : [],
            localPhotos:   [],
          }
        })
      : [{ spot: '', speciesSelect: '', speciesOther: '', currency: 'EUR' as Currency, license_price: '', guide_price: '', description: '', photos: [], localPhotos: [] }]

  const [options, setOptions] = useState<OptionDraft[]>(initOptions)
  const [saved,   setSaved]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saving, startSave]   = useTransition()

  // One file-input ref slot per option (max 3)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])

  // ── Option management ──────────────────────────────────────────────────────

  function addOption() {
    if (options.length >= 3) return
    setOptions(prev => [...prev, {
      spot: '', speciesSelect: '', speciesOther: '', currency: 'EUR',
      license_price: '', guide_price: '', description: '', photos: [], localPhotos: [],
    }])
  }

  function removeOption(i: number) {
    if (options.length <= 1) return
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, field: keyof Omit<OptionDraft, 'photos' | 'localPhotos'>, val: string) {
    setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: val } : o))
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
          const species = o.speciesSelect === 'other'
            ? o.speciesOther.trim() || null
            : o.speciesSelect || null
          return {
            spot:          o.spot.trim(),
            species,
            currency:      o.currency,
            license_price: o.license_price !== '' ? Number(o.license_price) : null,
            guide_price:   o.guide_price   !== '' ? Number(o.guide_price)   : null,
            description:   o.description.trim()   || null,
            photos:        o.photos,
          }
        })

      const res = await saveGuideOfferResponse(inquiryId, { guide_options: guideOptions })
      if (!res.success) {
        setSaveErr(res.error ?? 'Failed to save')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
        <div className="px-6 py-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
          <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Your Offer</h2>
          <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Fill this in so FjordAnglers can build the final offer for the angler.
          </p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">

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

                  {/* Species */}
                  <select
                    value={opt.speciesSelect}
                    onChange={e => updateOption(i, 'speciesSelect', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— Target species —</option>
                    {guideSpecies.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="other">Other…</option>
                  </select>
                  {opt.speciesSelect === 'other' && (
                    <input type="text" value={opt.speciesOther}
                      onChange={e => updateOption(i, 'speciesOther', e.target.value)}
                      placeholder="Specify species…" style={inputStyle} />
                  )}

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
                background: saved ? 'rgba(16,185,129,0.12)' : '#E67E50',
                color:      saved ? '#065F46'                : '#fff',
                border:     saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
                cursor:     saving ? 'not-allowed' : 'pointer',
                opacity:    saving ? 0.7 : 1,
              }}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Send offer details'}
            </button>
            {saveErr != null && (
              <p className="text-xs f-body" style={{ color: '#DC2626' }}>{saveErr}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
