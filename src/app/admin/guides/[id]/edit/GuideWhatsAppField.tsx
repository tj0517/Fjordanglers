'use client'

import { useState, useTransition } from 'react'
import { saveGuideWhatsAppNumber } from '@/actions/guide-requests'

/**
 * FA-M.05 (D4 a) — the guide's WhatsApp number, used for "Send request" on the inquiry card.
 * Validated and normalised on the server (E.164); an empty value clears it.
 */
export function GuideWhatsAppField({ guideId, initialNumber }: { guideId: string; initialNumber: string | null }) {
  const [value, setValue]     = useState(initialNumber ?? '')
  const [saved, setSaved]     = useState(initialNumber)
  const [error, setError]     = useState<string | null>(null)
  const [notice, setNotice]   = useState<string | null>(null)
  const [pending, start]      = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    start(async () => {
      const res = await saveGuideWhatsAppNumber(guideId, value)
      if (!res.success) { setError(res.error); return }
      setSaved(res.phoneE164)
      setValue(res.phoneE164 ?? '')
      setNotice(res.phoneE164 == null ? 'Number removed.' : 'Saved.')
    })
  }

  return (
    <form
      onSubmit={save}
      className="p-6 mb-8 rounded-3xl bg-[#FDFAF7] border border-primary/7"
      aria-label="WhatsApp number"
    >
      <label htmlFor="guide-whatsapp" className="block text-sm font-bold f-display text-primary mb-1">
        WhatsApp number
      </label>
      <p className="text-xs f-body text-primary/45 mb-3">
        Used for guide requests sent from the inquiry card. International format, e.g. +64 21 123 4567. Leave empty to remove.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="guide-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="+64211234567"
          aria-invalid={error != null}
          aria-describedby={error != null ? 'guide-whatsapp-error' : undefined}
          className="px-3 py-2 rounded-xl text-sm f-body border border-primary/15 bg-white text-primary min-w-[220px]"
        />
        <button
          type="submit"
          disabled={pending || value.trim() === (saved ?? '')}
          className="px-4 py-2 rounded-xl text-xs font-bold f-body bg-primary text-white disabled:opacity-50 disabled:cursor-default"
        >
          {pending ? 'Saving…' : 'Save number'}
        </button>
      </div>
      {error != null && <p id="guide-whatsapp-error" role="alert" className="mt-2 text-xs f-body text-red-600">{error}</p>}
      {notice != null && <p role="status" className="mt-2 text-xs f-body text-emerald-700">{notice}</p>}
    </form>
  )
}
