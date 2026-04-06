'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from '@/actions/auth'
import { AlertTriangle } from 'lucide-react'

export default function DeleteAccountCard() {
  const [confirmed,  setConfirmed]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function handleDelete() {
    if (!confirmed) return
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount()
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="p-6"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(239,68,68,0.2)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.08)' }}
        >
          <AlertTriangle width={15} height={15} strokeWidth={1.5} style={{ color: '#DC2626' }} />
        </div>
        <h2 className="text-[#0A2E4D] text-base font-bold f-display">Delete Account</h2>
      </div>

      <p className="text-sm f-body mb-2 leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
        This will permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <p className="text-xs f-body mb-5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
        Your personal data will be erased in compliance with GDPR Art. 17. Booking history may be retained in anonymised form for legal and tax obligations.
      </p>

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5 flex-shrink-0"
        />
        <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
          I understand this cannot be undone
        </span>
      </label>

      {error != null && (
        <p
          className="text-sm f-body px-4 py-3 rounded-xl mb-4"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#DC2626',
            border:     '1px solid rgba(239,68,68,0.15)',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={!confirmed || isPending}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: '#DC2626', color: '#fff' }}
      >
        {isPending ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  )
}
