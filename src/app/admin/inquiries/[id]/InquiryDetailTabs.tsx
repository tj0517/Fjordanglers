'use client'

import { useState } from 'react'

interface Props {
  defaultTab?: string
  // Contact tab: 2-column
  contactContent:  React.ReactNode
  sidePanel:       React.ReactNode
  // Guide tab: full-width
  guideContent:    React.ReactNode
  // Trip setup tab: full-width
  tripSetupContent: React.ReactNode
}

const TABS = [
  { id: 'contact',   label: 'Contact' },
  { id: 'guide',     label: 'Guide Attachment' },
  { id: 'tripsetup', label: 'Trip Setup' },
]

export function InquiryDetailTabs({
  defaultTab = 'contact',
  contactContent,
  sidePanel,
  guideContent,
  tripSetupContent,
}: Props) {
  const [active, setActive] = useState(defaultTab)

  return (
    <div>
      {/* ── Tab nav ──────────────────────────────────────────────────────── */}
      <div
        className="inline-flex gap-1 p-1 rounded-2xl mb-6"
        style={{ background: 'rgba(10,46,77,0.07)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className="px-5 py-2 rounded-xl text-sm font-bold f-body whitespace-nowrap transition-all duration-150"
            style={{
              background:    active === tab.id ? '#0A2E4D' : 'transparent',
              color:         active === tab.id ? '#fff'    : 'rgba(10,46,77,0.5)',
              boxShadow:     active === tab.id ? '0 2px 10px rgba(10,46,77,0.22)' : 'none',
              border:        'none',
              cursor:        'pointer',
              letterSpacing: '0.01em',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contact tab — 2-column ────────────────────────────────────────── */}
      {active === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {contactContent}
          </div>
          <div className="lg:sticky lg:top-6 space-y-3">
            {sidePanel}
          </div>
        </div>
      )}

      {/* ── Guide tab — full-width ────────────────────────────────────────── */}
      {active === 'guide' && (
        <div>
          {guideContent}
        </div>
      )}

      {/* ── Trip setup tab — full-width ───────────────────────────────────── */}
      {active === 'tripsetup' && (
        <div>
          {tripSetupContent}
        </div>
      )}
    </div>
  )
}
