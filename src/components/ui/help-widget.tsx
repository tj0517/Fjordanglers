'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

export type HelpItem = {
  icon: string   // emoji
  title: string
  text: string
}

interface Props {
  /** Widget trigger button label (screen-reader only) */
  label?: string
  /** Modal title */
  title: string
  /** Optional subtitle below the title */
  description?: string
  /** List of explanatory items */
  items: HelpItem[]
}

/**
 * A small ? circle button that opens a contextual help modal.
 *
 * Usage (inline next to a section heading):
 *   <h2>How booking works <HelpWidget title="Booking flow" items={[...]} /></h2>
 *
 * Or as a standalone floating element inside a form section.
 */
export function HelpWidget({ label = 'How does this work?', title, description, items }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex items-center justify-center rounded-full flex-shrink-0 transition-all hover:scale-110 active:scale-95 f-body"
        style={{
          width: 26,
          height: 26,
          background: 'rgba(10,46,77,0.09)',
          color: 'rgba(10,46,77,0.45)',
          fontSize: '13px',
          fontWeight: 700,
          verticalAlign: 'middle',
        }}
      >
        ?
      </button>

      {/* Modal overlay */}
      {open && (
        <>
          {/* Backdrop — separate element so backdropFilter never affects the panel */}
          <div
            className="fixed inset-0 z-[199]"
            style={{ background: 'rgba(7,17,28,0.55)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel — above backdrop, pointer-events-none on wrapper so clicks on empty space hit backdrop */}
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
          <div
            className="w-full max-w-sm rounded-3xl p-6 relative pointer-events-auto"
            style={{
              background: '#FDFAF7',
              boxShadow: '0 24px 64px rgba(10,46,77,0.22)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 f-body"
              style={{
                width: 30,
                height: 30,
                background: 'rgba(10,46,77,0.07)',
                color: 'rgba(10,46,77,0.5)',
                fontSize: '18px',
              }}
            >
              ×
            </button>

            {/* Icon badge */}
            <div
              className="flex items-center justify-center rounded-2xl mb-4"
              style={{
                width: 46,
                height: 46,
                background: 'rgba(230,126,80,0.12)',
              }}
            >
              <Info size={20} strokeWidth={1.7} style={{ color: '#E67E50' }} />
            </div>

            <h3 className="text-[#0A2E4D] text-lg font-bold f-display mb-1 pr-8">{title}</h3>

            {description != null && (
              <p className="text-[13px] f-body leading-relaxed mb-5" style={{ color: 'rgba(10,46,77,0.55)' }}>
                {description}
              </p>
            )}

            {/* Items */}
            <div className="flex flex-col gap-4 mt-4">
              {items.map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-xl text-lg"
                    style={{ width: 36, height: 36, background: 'rgba(10,46,77,0.05)', lineHeight: 1 }}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold f-body leading-snug" style={{ color: '#0A2E4D' }}>
                      {item.title}
                    </p>
                    <p className="text-[12px] f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Close button bottom */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full py-3 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-95"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              Got it
            </button>
          </div>
          </div>
        </>
      )}
    </>
  )
}
