'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Norway', 'Sweden', 'Finland', 'Iceland'] as const
const LANGUAGES = ['English', 'Norwegian', 'Swedish', 'Finnish', 'Icelandic', 'German'] as const

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = value !== ''

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full f-body transition-all"
        style={{
          background: active ? 'rgba(230,126,80,0.10)' : '#FDFAF7',
          border: `1.5px solid ${active ? 'rgba(230,126,80,0.40)' : 'rgba(10,46,77,0.12)'}`,
          color: active ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: open ? '0 4px 20px rgba(10,46,77,0.10)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: active ? '#E67E50' : 'rgba(10,46,77,0.35)' }}>
          {label}
        </span>
        <span style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.4)' }}>
          {value || 'All'}
        </span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          className="transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none', color: active ? '#E67E50' : 'rgba(10,46,77,0.3)' }}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 overflow-hidden"
          style={{
            background: '#FDFAF7',
            border: '1.5px solid rgba(10,46,77,0.10)',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(10,46,77,0.14)',
            minWidth: '160px',
          }}
        >
          {/* All / clear option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm f-body transition-colors hover:bg-[#F3EDE4]"
            style={{ color: value === '' ? '#E67E50' : 'rgba(10,46,77,0.45)', fontWeight: value === '' ? 700 : 400 }}
          >
            All {label}s
          </button>
          <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)', margin: '0 12px' }} />
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm f-body transition-colors hover:bg-[#F3EDE4]"
              style={{
                color: value === o ? '#E67E50' : '#0A2E4D',
                fontWeight: value === o ? 700 : 400,
                background: value === o ? 'rgba(230,126,80,0.06)' : 'transparent',
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function GuidesFilters({
  country,
  language,
}: {
  country?: string
  language?: string
}) {
  const router = useRouter()

  function navigate(newCountry: string, newLanguage: string) {
    const sp = new URLSearchParams()
    if (newCountry)  sp.set('country',  newCountry)
    if (newLanguage) sp.set('language', newLanguage)
    router.push(`/guides${sp.toString() ? `?${sp.toString()}` : ''}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Dropdown
        label="Country"
        value={country ?? ''}
        options={COUNTRIES}
        onChange={v => navigate(v, language ?? '')}
      />
      <Dropdown
        label="Language"
        value={language ?? ''}
        options={LANGUAGES}
        onChange={v => navigate(country ?? '', v)}
      />
      {(country || language) && (
        <button
          type="button"
          onClick={() => router.push('/guides')}
          className="text-[11px] font-semibold px-4 py-2.5 rounded-full transition-all hover:opacity-70 f-body"
          style={{ color: 'rgba(10,46,77,0.45)', background: 'rgba(10,46,77,0.06)' }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  )
}
