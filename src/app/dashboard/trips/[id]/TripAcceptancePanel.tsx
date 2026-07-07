'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { respondToAssignment, saveGuideOfferEta } from '@/actions/inquiries'

interface Props {
  inquiryId:          string
  guideAcceptance:    string | null  // 'accepted' | 'declined' | null
  guideDeclineReason: string | null
  guideOfferEta:      string | null
  autoAccept?:        boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.04)',
  border: '1px solid rgba(10,46,77,0.12)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  color: '#0A2E4D',
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'rgba(10,46,77,0.4)',
  marginBottom: 6,
}

function EtaField({ inquiryId, initial }: { inquiryId: string; initial: string }) {
  const [eta,     setEta]     = useState(initial)
  const [saved,   setSaved]   = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  function handleSave() {
    setErr(null)
    setSaved(false)
    startSaving(async () => {
      const res = await saveGuideOfferEta(inquiryId, eta)
      if (!res.success) setErr(res.error ?? 'Failed to save')
      else setSaved(true)
    })
  }

  return (
    <div className="mt-4">
      <label style={labelStyle}>When will you send us the offer?</label>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={eta}
          onChange={e => { setEta(e.target.value); setSaved(false) }}
          placeholder="e.g. Tomorrow afternoon, Within 2 days…"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold f-body transition-all"
          style={{
            background: '#0A2E4D',
            color: '#fff',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
      {saved && (
        <p className="text-[11px] f-body mt-1.5" style={{ color: '#065F46' }}>Saved</p>
      )}
      {err != null && (
        <p className="text-[11px] f-body mt-1.5" style={{ color: '#DC2626' }}>{err}</p>
      )}
    </div>
  )
}

export function TripAcceptancePanel({ inquiryId, guideAcceptance, guideDeclineReason, guideOfferEta, autoAccept }: Props) {
  const router = useRouter()
  const [showDecline,   setShowDecline]   = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [err,           setErr]           = useState<string | null>(null)
  const [pending, start]                  = useTransition()

  // Auto-accept from email one-click link (?action=accept)
  useEffect(() => {
    if (autoAccept === true && guideAcceptance == null) {
      handleAccept()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAccept() {
    setErr(null)
    start(async () => {
      const res = await respondToAssignment(inquiryId, true)
      if (!res.success) {
        setErr(res.error ?? 'Something went wrong')
      } else {
        router.refresh()
      }
    })
  }

  function handleDecline() {
    setErr(null)
    start(async () => {
      const res = await respondToAssignment(inquiryId, false, declineReason)
      if (!res.success) {
        setErr(res.error ?? 'Something went wrong')
      } else {
        router.refresh()
      }
    })
  }

  // ── Already accepted ───────────────────────────────────────────────────────

  if (guideAcceptance === 'accepted') {
    return (
      <div className="rounded-[22px] px-5 py-4 mb-6"
        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <div className="inline-flex items-center gap-2">
          <span className="text-sm font-semibold f-body" style={{ color: '#065F46' }}>
            ✓ You accepted this trip
          </span>
        </div>
        <EtaField inquiryId={inquiryId} initial={guideOfferEta ?? ''} />
      </div>
    )
  }

  // ── Already declined ───────────────────────────────────────────────────────

  if (guideAcceptance === 'declined') {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <span className="text-sm font-semibold f-body" style={{ color: '#991B1B' }}>
          ✗ You declined this trip
          {guideDeclineReason != null && guideDeclineReason.trim() !== '' && (
            <span className="font-normal ml-1">— {guideDeclineReason}</span>
          )}
        </span>
      </div>
    )
  }

  // ── Pending response ───────────────────────────────────────────────────────

  return (
    <div className="rounded-[22px] p-5 mb-6"
      style={{ border: '1.5px solid #E67E50', background: 'rgba(230,126,80,0.04)' }}>
      <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
        FjordAnglers has assigned you to this trip.
      </p>
      <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.6)' }}>
        Please confirm your availability so we can proceed with the angler.
      </p>

      {!showDecline ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleAccept}
            disabled={pending}
            className="px-6 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: '#E67E50',
              color: '#fff',
              border: 'none',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? 'Saving…' : 'Accept'}
          </button>
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            disabled={pending}
            className="px-6 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: 'transparent',
              color: '#0A2E4D',
              border: '1.5px solid rgba(10,46,77,0.2)',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            Decline
          </button>
        </div>
      ) : (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.13em] f-body mb-1.5"
            style={{ color: 'rgba(10,46,77,0.4)' }}>
            Reason for declining (optional)
          </label>
          <textarea
            rows={3}
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder="e.g. I am not available on those dates"
            className="block w-full rounded-xl px-3 py-2.5 text-sm f-body mb-3"
            style={{
              background: 'rgba(10,46,77,0.04)',
              border: '1px solid rgba(10,46,77,0.12)',
              color: '#0A2E4D',
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDecline}
              disabled={pending}
              className="px-5 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#991B1B',
                border: '1px solid rgba(239,68,68,0.3)',
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? 'Saving…' : 'Confirm decline'}
            </button>
            <button
              type="button"
              onClick={() => setShowDecline(false)}
              disabled={pending}
              className="text-sm f-body"
              style={{ color: 'rgba(10,46,77,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err != null && (
        <p className="text-xs f-body mt-3" style={{ color: '#DC2626' }}>{err}</p>
      )}
    </div>
  )
}
