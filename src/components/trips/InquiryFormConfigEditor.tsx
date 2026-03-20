'use client'

import { useState, useTransition } from 'react'
import {
  type InquiryFormConfig,
  type FieldVisibility,
  type FieldMeta,
  FIELD_GROUPS,
  DEFAULT_INQUIRY_FORM_CONFIG,
  resolveFormConfig,
} from '@/lib/inquiry-form-config'
import { updateInquiryFormConfig } from '@/actions/inquiry-form-config'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  expId:         string
  initialConfig: Partial<InquiryFormConfig> | null | undefined
}

// ─── Pill styles ──────────────────────────────────────────────────────────────

type PillVariant = FieldVisibility

const PILL_LABELS: Record<PillVariant, string> = {
  required: 'Required',
  optional: 'Optional',
  hidden:   'Hidden',
}

function pillStyle(variant: PillVariant, active: boolean): React.CSSProperties {
  if (!active) {
    return {
      background:   'rgba(10,46,77,0.04)',
      color:        'rgba(10,46,77,0.35)',
      border:       '1px solid rgba(10,46,77,0.08)',
      borderRadius: '8px',
      padding:      '4px 10px',
      fontSize:     '11px',
      fontWeight:   600,
      cursor:       'pointer',
      fontFamily:   'var(--font-dm-sans, DM Sans, sans-serif)',
      whiteSpace:   'nowrap',
    }
  }
  const map: Record<PillVariant, React.CSSProperties> = {
    required: {
      background:   '#0A2E4D',
      color:        'white',
      border:       '1px solid #0A2E4D',
    },
    optional: {
      background:   'rgba(230,126,80,0.12)',
      color:        '#C75E2E',
      border:       '1px solid rgba(230,126,80,0.3)',
    },
    hidden: {
      background:   'rgba(10,46,77,0.09)',
      color:        'rgba(10,46,77,0.5)',
      border:       '1px solid rgba(10,46,77,0.16)',
    },
  }
  return {
    ...map[variant],
    borderRadius: '8px',
    padding:      '4px 10px',
    fontSize:     '11px',
    fontWeight:   700,
    cursor:       'pointer',
    fontFamily:   'var(--font-dm-sans, DM Sans, sans-serif)',
    whiteSpace:   'nowrap',
  }
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
  disabled,
}: {
  field:    FieldMeta
  value:    FieldVisibility
  onChange: (v: FieldVisibility) => void
  disabled: boolean
}) {
  const variants: FieldVisibility[] = ['required', 'optional', 'hidden']
  return (
    <div className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold f-body leading-snug" style={{ color: '#0A2E4D' }}>
          {field.label}
        </p>
        <p className="text-[11px] f-body mt-0.5 leading-tight" style={{ color: 'rgba(10,46,77,0.42)' }}>
          {field.description}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {variants.map(v => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            style={pillStyle(v, value === v)}
          >
            {PILL_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InquiryFormConfigEditor({ expId, initialConfig }: Props) {
  const [config,    setConfig]    = useState<InquiryFormConfig>(resolveFormConfig(initialConfig))
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function setField(key: keyof InquiryFormConfig, value: FieldVisibility) {
    setSaved(false)
    setSaveError(null)
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  function handleReset() {
    setSaved(false)
    setSaveError(null)
    setConfig(DEFAULT_INQUIRY_FORM_CONFIG)
  }

  function handleSave() {
    setSaved(false)
    setSaveError(null)
    startTransition(async () => {
      const result = await updateInquiryFormConfig(expId, config)
      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  // Count overrides from defaults
  const overrides = (Object.keys(config) as Array<keyof InquiryFormConfig>)
    .filter(k => config[k] !== DEFAULT_INQUIRY_FORM_CONFIG[k]).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            Inquiry form settings
          </h2>
          <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Control which fields anglers see when sending you a request for this trip.
          </p>
        </div>
        {overrides > 0 && (
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full flex-shrink-0 mt-1 f-body"
            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
          >
            {overrides} custom
          </span>
        )}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 rounded-xl mb-6"
        style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        {([
          { v: 'required' as const, desc: 'Shown with *, angler must fill before sending' },
          { v: 'optional' as const, desc: 'Shown without *, angler can skip'              },
          { v: 'hidden'   as const, desc: 'Not shown on the inquiry form at all'          },
        ]).map(({ v, desc }) => (
          <div key={v} className="flex items-center gap-2">
            <span style={pillStyle(v, true)}>{PILL_LABELS[v]}</span>
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Always-required note */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-6"
        style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(10,46,77,0.4)" strokeWidth="1.6" className="mt-0.5 flex-shrink-0">
          <circle cx="7" cy="7" r="6" />
          <line x1="7" y1="5" x2="7" y2="7.5" />
          <circle cx="7" cy="9.5" r="0.8" fill="rgba(10,46,77,0.4)" />
        </svg>
        <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
          <strong style={{ color: '#0A2E4D' }}>Always required</strong> (not configurable):&nbsp;
          preferred dates / period &bull; group size &bull; target species
        </p>
      </div>

      {/* Field groups */}
      <div className="flex flex-col gap-5">
        {FIELD_GROUPS.map(group => (
          <div
            key={group.title}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(10,46,77,0.08)' }}
          >
            {/* Group header */}
            <div
              className="px-5 py-3.5"
              style={{ background: 'rgba(10,46,77,0.025)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em] f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                {group.title}
              </p>
              {group.note != null && (
                <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  {group.note}
                </p>
              )}
            </div>

            {/* Fields */}
            <div className="px-5 bg-white">
              {group.fields.map((field, idx) => (
                <div
                  key={field.key}
                  style={idx === group.fields.length - 1 ? { borderBottom: 'none' } : {}}
                >
                  <FieldRow
                    field={field}
                    value={config[field.key]}
                    onChange={v => setField(field.key, v)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save bar */}
      <div
        className="flex items-center justify-between gap-4 mt-6 pt-5"
        style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
      >
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold f-body" style={{ color: '#059669' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 7 6 11 12 4" />
              </svg>
              Saved
            </span>
          )}
          {saveError != null && (
            <span className="text-xs f-body" style={{ color: '#B91C1C' }}>{saveError}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending || overrides === 0}
            className="text-xs font-semibold f-body transition-opacity"
            style={{
              color:      overrides === 0 ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.45)',
              background: 'none',
              border:     'none',
              cursor:     overrides === 0 ? 'default' : 'pointer',
              padding:    0,
            }}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: isPending ? 'rgba(230,126,80,0.55)' : '#E67E50',
              color:      'white',
              border:     'none',
              cursor:     isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Saving\u2026' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
