'use client'

/**
 * UnmatchedLinker — modal to link an unmatched message to an inquiry.
 *
 * Opens when admin clicks "Link to inquiry" on an unmatched message row.
 * Searches inquiries by angler name, email, or phone, then calls
 * matchUnmatchedMessage server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, Check } from 'lucide-react'
import { matchUnmatchedMessage } from '@/actions/messages'

interface InquiryOption {
  id:           string
  angler_name:  string
  angler_email: string
  angler_phone: string | null
  status:       string
  created_at:   string
}

interface Props {
  unmatchedId:  string
  fromIdentifier: string
  senderName:   string
  inquiries:    InquiryOption[]
  onClose:      () => void
}

export function UnmatchedLinker({ unmatchedId, fromIdentifier, senderName, inquiries, onClose }: Props) {
  const router           = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery]   = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const filtered = inquiries.filter(inq => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      inq.angler_name.toLowerCase().includes(q)  ||
      inq.angler_email.toLowerCase().includes(q) ||
      (inq.angler_phone ?? '').toLowerCase().includes(q)
    )
  })

  function handleLink(inquiryId: string) {
    setError(null)
    start(async () => {
      const result = await matchUnmatchedMessage(unmatchedId, inquiryId)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          router.refresh()
          onClose()
        }, 800)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: '#fff', maxHeight: '80vh', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
        >
          <div>
            <p className="font-semibold text-sm f-body" style={{ color: '#0A2E4D' }}>Link to inquiry</p>
            <p className="text-xs f-body mt-0.5" style={{ color: '#6B7280' }}>
              {senderName ? `${senderName} (${fromIdentifier})` : fromIdentifier}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: '#6B7280', background: 'rgba(0,0,0,0.05)' }}
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <Search size={14} strokeWidth={1.8} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              placeholder="Search by name, email or phone…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm f-body outline-none"
              style={{ color: '#111827' }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <p className="text-center text-sm f-body py-8" style={{ color: '#9CA3AF' }}>
              No inquiries found
            </p>
          )}
          {filtered.map(inq => (
            <button
              key={inq.id}
              disabled={pending || success}
              onClick={() => handleLink(inq.id)}
              className="w-full flex items-start justify-between gap-3 px-5 py-3 text-left transition-colors"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,46,77,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium f-body truncate" style={{ color: '#111827' }}>{inq.angler_name}</p>
                <p className="text-xs f-body truncate mt-0.5" style={{ color: '#6B7280' }}>
                  {inq.angler_email}
                  {inq.angler_phone ? ` · ${inq.angler_phone}` : ''}
                </p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold f-body px-2 py-0.5 rounded-full"
                  style={{
                    color:      inq.status === 'deposit_paid' ? '#065F46' : '#92400E',
                    background: inq.status === 'deposit_paid' ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.15)',
                  }}
                >
                  {inq.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs f-body" style={{ color: '#D1D5DB' }}>
                  {new Date(inq.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer — error / success */}
        {(error || success || pending) && (
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            {pending && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" style={{ color: '#6B7280' }} />}
            {success  && <Check  size={14} strokeWidth={2.2} style={{ color: '#10B981' }} />}
            <p className="text-sm f-body" style={{ color: success ? '#065F46' : error ? '#991B1B' : '#6B7280' }}>
              {success ? 'Linked successfully' : error ?? 'Linking…'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
