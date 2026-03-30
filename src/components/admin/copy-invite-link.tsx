'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

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
        <Check size={11} strokeWidth={2.2} aria-hidden="true" />
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
      <Share2 size={11} strokeWidth={1.5} aria-hidden="true" />
      Copy invite link
    </button>
  )
}
