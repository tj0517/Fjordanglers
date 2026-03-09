'use client'

import { useState } from 'react'
import Image from 'next/image'

export type FishVariant = 'salmon' | 'pike' | 'perch'

export interface SpeciesInfo {
  variant: FishVariant
  tagline: string
  desc: string
  trophy: string
  bg: string
  accent: string
  photo?: string
}

interface Props {
  fish: string
  info: SpeciesInfo | undefined
  compact?: boolean
}

export function SpeciesCard({ fish, info, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const accent = info?.accent ?? '#E67E50'

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(v => !v)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(v => !v) }}
      className="relative overflow-hidden rounded-2xl cursor-pointer select-none outline-none"
      style={{
        background: info?.bg ?? 'rgba(230,126,80,0.08)',
        border: `1px solid ${accent}28`,
        transition: 'box-shadow 0.2s ease',
        boxShadow: open ? `0 6px 24px ${accent}20` : 'none',
        padding: compact ? '12px' : '16px',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Photo thumbnail */}
        <div
          className="flex-shrink-0 overflow-hidden rounded-xl"
          style={{ width: compact ? 52 : 72, height: compact ? 36 : 48 }}
        >
          {info?.photo != null ? (
            <Image
              src={info.photo}
              alt={fish}
              width={compact ? 52 : 72}
              height={compact ? 36 : 48}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full" style={{ background: `${accent}20` }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="font-bold f-display leading-tight"
            style={{ color: '#0A2E4D', fontSize: compact ? '13px' : '14px' }}
          >
            {fish}
          </h3>
          <p
            className="font-semibold uppercase tracking-[0.16em] f-body truncate"
            style={{ color: accent, fontSize: '10px' }}
          >
            {info?.tagline ?? ''}
          </p>
        </div>

        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{
            color: accent, opacity: 0.5, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expandable body */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: open ? '160px' : '0px',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.32s ease, opacity 0.22s ease',
        }}
      >
        <p className="text-xs leading-[1.75] f-body mt-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
          {info?.desc ?? ''}
        </p>
        {info?.trophy && (
          <div className="flex items-center gap-2 mt-2.5">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em] f-body"
              style={{ color: 'rgba(10,46,77,0.28)' }}
            >
              Trophy size
            </span>
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full f-body"
              style={{ background: `${accent}18`, color: accent }}
            >
              {info.trophy}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
