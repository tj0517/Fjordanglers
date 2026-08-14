'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold f-body transition-all"
      style={{
        background: copied ? 'rgba(22,163,74,0.1)' : '#0A2E4D',
        color:      copied ? '#16a34a' : '#fff',
      }}
    >
      {copied ? (
        <><Check size={12} strokeWidth={2} /> Copied!</>
      ) : (
        <><Copy size={12} strokeWidth={1.8} /> Copy link</>
      )}
    </button>
  )
}
