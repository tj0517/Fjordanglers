'use client'

import { useState } from 'react'

interface Props {
  /** Explanation text shown in the tooltip */
  text: string
}

/**
 * Small ? icon next to a form field label.
 * Shows a dark tooltip on hover / focus / click.
 *
 * Usage:
 *   <label>
 *     Full name <FieldTooltip text="We send your booking confirmation to this name." />
 *   </label>
 */
export function FieldTooltip({ text }: Props) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        type="button"
        tabIndex={-1}
        aria-label="More info"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        className="flex items-center justify-center rounded-full cursor-help select-none flex-shrink-0"
        style={{
          width: 15,
          height: 15,
          background: 'rgba(10,46,77,0.1)',
          color: 'rgba(10,46,77,0.42)',
          fontSize: '9px',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ?
      </button>

      {show && (
        <span
          className="absolute z-50 bottom-full left-0 mb-2 px-3 py-2.5 rounded-xl text-[12px] f-body leading-relaxed pointer-events-none"
          style={{
            background: '#0A2E4D',
            color: 'white',
            width: 210,
            boxShadow: '0 4px 20px rgba(10,46,77,0.28)',
            whiteSpace: 'normal',
          }}
        >
          {text}
          {/* Arrow */}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: 12,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #0A2E4D',
            }}
          />
        </span>
      )}
    </span>
  )
}
