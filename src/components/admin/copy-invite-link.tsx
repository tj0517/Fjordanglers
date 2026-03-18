'use client'

import { useState } from 'react'

type Props = {
  guideId: string
}

/**
 * "Copy invite link" button shown in the admin guide detail page.
 *
 * Copies /invite/[guideId] to clipboard.
 * Admin pastes it into email/WhatsApp and sends it to the guide.
 *
 * Shows a brief "Copied!" confirmation then resets to the default state.
 */
export default function CopyInviteLink({ guideId }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/invite/${guideId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2500)
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2500)
    }
  }

  if (copied) {
    return (
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full f-body"
        style={{ background: 'rgba(74,222,128,0.12)', color: '#16A34A' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <polyline points="2,6 4.5,8.5 9,3" />
        </svg>
        Link copied!
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { void handleCopy() }}
      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all hover:brightness-95 f-body"
      style={{ background: 'rgba(230,126,80,0.1)', color: '#C96030' }}
      title={`Copy invite link for /invite/${guideId}`}
    >
      {/* Share / link icon */}
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="9" cy="2" r="1.5" />
        <circle cx="2" cy="5.5" r="1.5" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="M3.4 4.7L7.6 3M3.4 6.3l4.2 1.7" strokeLinecap="round" />
      </svg>
      Copy invite link
    </button>
  )
}
