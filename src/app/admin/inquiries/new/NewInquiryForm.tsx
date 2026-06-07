'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createManualInquiry } from '@/actions/inquiries'

interface Trip { id: string; title: string; guide_name: string | null }

const SOURCES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'email',     label: 'Email'      },
  { value: 'phone',     label: 'Phone'      },
  { value: 'facebook',  label: 'Facebook'   },
  { value: 'referral',  label: 'Referral'   },
  { value: 'other',     label: 'Other'      },
]

const INITIAL_STATUSES = [
  { value: 'in_negotiation',    label: 'Negotiating'   },
  { value: 'pending_fa_review', label: 'Pending review' },
]

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
        style={{ color: 'rgba(10,46,77,0.5)' }}>
        {label}{required && <span style={{ color: '#E67E50' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none"
const inputStyle = {
  background: '#FDFAF7',
  border:     '1px solid rgba(10,46,77,0.12)',
  color:      '#0A2E4D',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewInquiryForm({ trips }: { trips: Trip[] }) {
  const router           = useRouter()
  const [pending, start]  = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name,   setName]   = useState('')
  const [email,  setEmail]  = useState('')
  const [pax,    setPax]    = useState('1')
  const [tripId, setTripId] = useState('')
  const [source, setSource] = useState('instagram')
  const [status, setStatus] = useState('in_negotiation')
  const [dates,  setDates]  = useState<string[]>([])
  const [message, setMessage] = useState('')

  function addDate() {
    setDates(d => [...d, ''])
  }

  function updateDate(idx: number, val: string) {
    setDates(d => d.map((v, i) => i === idx ? val : v))
  }

  function removeDate(idx: number) {
    setDates(d => d.filter((_, i) => i !== idx))
  }

  function handleSubmit() {
    setError(null)
    const validDates = dates.filter(d => d.trim() !== '')
    start(async () => {
      const res = await createManualInquiry({
        anglerName:     name,
        anglerEmail:    email,
        partySize:      Math.max(1, parseInt(pax) || 1),
        tripId:         tripId || null,
        requestedDates: validDates,
        message:        message.trim() || null,
        source,
        status,
      })
      if (res.success && res.inquiryId != null) {
        router.push(`/admin/inquiries/${res.inquiryId}`)
      } else if (!res.success) {
        setError(res.error)
      }
    })
  }

  const canSubmit = name.trim() !== '' && email.trim() !== '' && !pending

  return (
    <div className="max-w-[560px] space-y-5">

      {/* ── Name + Email ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jan Kowalski"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jan@example.com"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* ── Party size + Source ── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Party size" required>
          <input
            type="number"
            min="1"
            max="20"
            value={pax}
            onChange={e => setPax(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Source">
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            {SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Trip ── */}
      <Field label="Trip">
        <select
          value={tripId}
          onChange={e => setTripId(e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          <option value="">— Not decided yet —</option>
          {trips.map(t => (
            <option key={t.id} value={t.id}>
              {t.title}{t.guide_name != null ? ` (${t.guide_name})` : ''}
            </option>
          ))}
        </select>
      </Field>

      {/* ── Requested dates ── */}
      <Field label="Requested dates">
        <div className="space-y-2">
          {dates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                value={d}
                onChange={e => updateDate(i, e.target.value)}
                className={`flex-1 ${inputCls}`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => removeDate(i)}
                className="px-2.5 rounded-xl flex items-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#991B1B' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addDate}
            className="flex items-center gap-1.5 text-xs font-semibold f-body px-3 py-2 rounded-xl transition-all"
            style={{
              background: 'rgba(10,46,77,0.05)',
              border:     '1px dashed rgba(10,46,77,0.18)',
              color:      'rgba(10,46,77,0.5)',
            }}
          >
            <Plus size={12} />
            Add date
          </button>
        </div>
      </Field>

      {/* ── Notes from conversation ── */}
      <Field label="Notes from conversation">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What did they ask for? Any specifics from the DM…"
          rows={3}
          className={`resize-none ${inputCls}`}
          style={inputStyle}
        />
      </Field>

      {/* ── Initial status ── */}
      <Field label="Initial status">
        <div className="flex gap-2">
          {INITIAL_STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
              style={{
                background: status === s.value ? '#0A2E4D' : 'rgba(10,46,77,0.05)',
                color:      status === s.value ? '#FFFFFF'  : 'rgba(10,46,77,0.5)',
                border:     status === s.value ? 'none'     : '1px solid rgba(10,46,77,0.1)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Error ── */}
      {error != null && (
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm f-body" style={{ color: '#991B1B' }}>{error}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] text-sm font-bold f-body transition-all"
        style={{
          background: canSubmit ? '#0A2E4D' : 'rgba(10,46,77,0.15)',
          color:      canSubmit ? '#FFFFFF'  : 'rgba(10,46,77,0.35)',
          boxShadow:  canSubmit ? '0 4px 20px rgba(10,46,77,0.2)' : 'none',
          cursor:     canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? 'Creating…' : 'Create inquiry →'}
      </button>
    </div>
  )
}
