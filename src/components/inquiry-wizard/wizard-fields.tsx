'use client'

/**
 * The controls the three steps are built from (FA-1.55), straight off the wireframe
 * (`docs/brand/wireframes/Form.dc.html`): the question label, the radio row, the pill row,
 * the ± counter and the error line.
 *
 * They are kept here rather than inside the steps so the three steps look like one form, and
 * so the 44 px minimum touch target is decided once. Every control is a real `<input>` or
 * `<button>` — the wireframe's `<span class="pill">` would be invisible to a keyboard.
 */

import type { ReactNode } from 'react'

export const NAVY     = 'var(--fa-navy)'
export const BORDER   = 'rgba(10,46,77,0.28)'
export const SELECTED = 'rgba(10,46,77,0.06)'
export const MUTED    = { color: 'rgba(10,46,77,0.62)' }

export function Question({
  label,
  hint,
  error,
  children,
}: {
  label:    string
  hint?:    string
  error?:   string
  children: ReactNode
}) {
  return (
    <fieldset className="mb-6 border-0 p-0">
      <legend className="mb-2.5 text-[17px] font-semibold">{label}</legend>
      {children}
      {hint != null && <p className="mt-2 text-[12px]" style={MUTED}>{hint}</p>}
      {error != null && (
        <p role="alert" className="mt-2 text-[13px] font-medium" style={{ color: '#B23A1C' }}>
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** A full-width radio row — the wireframe's `.opt`. */
export function ChoiceRow({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name:     string
  checked:  boolean
  onChange: () => void
  title:    string
  description?: string
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-[15px]"
      style={{
        minHeight:   48,
        borderColor: checked ? NAVY : BORDER,
        borderWidth: checked ? 2 : 1,
        background:  checked ? SELECTED : '#fff',
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-5 w-5 flex-none"
      />
      <span>
        <span className="font-medium">{title}</span>
        {description != null && <span className="block text-[13px]" style={MUTED}>{description}</span>}
      </span>
    </label>
  )
}

/** A row of short choices — the wireframe's `.pill`. Radios under the paint. */
export function PillRow({
  name,
  options,
  value,
  onChange,
}: {
  name:     string
  options:  readonly { value: string; label: string }[]
  value:    string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-[16px] font-medium"
            style={{
              minHeight:   48,
              minWidth:    64,
              borderColor: checked ? NAVY : BORDER,
              borderWidth: checked ? 2 : 1,
              background:  checked ? SELECTED : '#fff',
              color:       NAVY,
            }}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

/** The ± counter — the wireframe's `.cnt`. The number itself is a read-only output. */
export function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label:  string
  hint?:  string
  value:  number
  min:    number
  max:    number
  onChange: (value: number) => void
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)))

  return (
    <div
      className="flex items-center justify-between rounded-lg border py-1.5 pl-3.5 pr-1.5"
      style={{ minHeight: 48, borderColor: BORDER }}
    >
      <span className="text-[15px]">
        {label}
        {hint != null && <span className="text-[12px]" style={MUTED}> {hint}</span>}
      </span>
      <span className="flex items-center gap-2.5">
        <CounterButton label={`One fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => step(-1)}>−</CounterButton>
        <output className="w-7 text-center text-[17px] font-semibold">{value}</output>
        <CounterButton label={`One more ${label.toLowerCase()}`} disabled={value >= max} onClick={() => step(1)}>+</CounterButton>
      </span>
    </div>
  )
}

function CounterButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label:    string
  disabled: boolean
  onClick:  () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center rounded-md border text-[18px] disabled:opacity-35"
      style={{ width: 44, height: 44, borderColor: BORDER, background: '#fff' }}
    >
      {children}
    </button>
  )
}

/** A labelled text input, for step 3. */
export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  optional = false,
  autoComplete,
  inputMode,
  rows,
  min,
}: {
  label:    string
  type?:    'text' | 'email' | 'tel' | 'date'
  value:    string
  onChange: (value: string) => void
  error?:   string
  optional?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel'
  /** Set to render a textarea instead of an input. */
  rows?: number
  /** `type="date"` only — the earliest day the picker offers. */
  min?: string
}) {
  const shared = {
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: 'w-full rounded-lg border px-3 py-2.5 text-[16px]',
    style: { minHeight: 48, borderColor: error != null ? '#B23A1C' : BORDER, background: '#fff' },
    'aria-invalid': error != null,
  }

  return (
    <label className="flex flex-col gap-1.5 text-[14px]">
      <span>
        {label}
        {optional && <span style={MUTED}> (optional)</span>}
      </span>
      {rows != null
        ? <textarea {...shared} rows={rows} />
        : <input {...shared} type={type} autoComplete={autoComplete} inputMode={inputMode} min={min} />}
      {error != null && (
        <span role="alert" className="text-[13px] font-medium" style={{ color: '#B23A1C' }}>{error}</span>
      )}
    </label>
  )
}

/** "Step 2 of 3" and the three bars under it. */
export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <p
        className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em]"
        style={{ color: NAVY }}
        data-testid="wizard-progress"
      >
        Step {step} of {total}
      </p>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < step ? NAVY : 'rgba(10,46,77,0.15)' }}
          />
        ))}
      </div>
    </div>
  )
}

export const primaryButtonStyle = {
  background: NAVY,
  color:      '#fff',
  minHeight:  52,
}
