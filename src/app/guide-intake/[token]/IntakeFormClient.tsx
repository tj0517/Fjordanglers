'use client'

import { useState } from 'react'
import { submitIntakeResponse } from '@/actions/guide-forms'
import type { FormQuestion, GuideIntakeForm } from '@/actions/guide-forms'
import { CheckCircle2 } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  form: GuideIntakeForm
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IntakeFormClient({ form }: Props) {
  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [answers,   setAnswers]   = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function setAnswer(qId: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  function toggleMulti(qId: string, option: string) {
    setAnswers(prev => {
      const current = (prev[qId] as string[] | undefined) ?? []
      return {
        ...prev,
        [qId]: current.includes(option)
          ? current.filter(v => v !== option)
          : [...current, option],
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await submitIntakeResponse(form.token, name, email, answers)

    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      setSubmitted(true)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="flex flex-col items-center py-16 px-6 rounded-2xl text-center"
        style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(22,163,74,0.1)' }}
        >
          <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
        </div>
        <h2 className="text-2xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>
          Thank you!
        </h2>
        <p className="text-base f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
          We&apos;ve received your answers and will be in touch soon.
        </p>
      </div>
    )
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none transition-colors'
  const inputStyle = { border: '1.5px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#fff' }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Identity ────────────────────────────────────────────────────── */}
      <div
        className="p-5 rounded-2xl space-y-4"
        style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          About You
        </p>
        <div>
          <label className="block text-sm font-semibold f-body mb-1.5" style={{ color: '#0A2E4D' }}>
            Full name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Smith"
            required
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold f-body mb-1.5" style={{ color: '#0A2E4D' }}>
            Email address *
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Questions ───────────────────────────────────────────────────── */}
      {form.questions.length > 0 && (
        <div
          className="p-5 rounded-2xl space-y-6"
          style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            Questions
          </p>
          {form.questions.map((q, idx) => (
            <QuestionField
              key={q.id}
              question={q}
              idx={idx}
              value={answers[q.id]}
              onChange={v => setAnswer(q.id, v)}
              onToggleMulti={opt => toggleMulti(q.id, opt)}
            />
          ))}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error != null && (
        <div
          className="px-4 py-3 rounded-xl text-sm f-body"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
        >
          {error}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold f-body transition-all hover:brightness-110 disabled:opacity-60"
        style={{ background: '#E67E50', color: '#fff' }}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>

      <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
        Your answers are sent directly to FjordAnglers and stored securely.
      </p>

    </form>
  )
}

// ─── QuestionField ────────────────────────────────────────────────────────────

function QuestionField({
  question,
  idx,
  value,
  onChange,
  onToggleMulti,
}: {
  question:      FormQuestion
  idx:           number
  value:         string | string[] | undefined
  onChange:      (v: string | string[]) => void
  onToggleMulti: (opt: string) => void
}) {
  const label = (
    <label className="block text-sm font-semibold f-body mb-1.5" style={{ color: '#0A2E4D' }}>
      {question.label}
      {question.required && (
        <span className="ml-0.5" style={{ color: '#E67E50' }}> *</span>
      )}
    </label>
  )

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none'
  const inputStyle = { border: '1.5px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#FDFAF7' }

  if (question.type === 'text' || question.type === 'url') {
    return (
      <div>
        {label}
        <input
          type={question.type === 'url' ? 'url' : 'text'}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          required={question.required}
          className={inputCls}
          style={inputStyle}
        />
      </div>
    )
  }

  if (question.type === 'number') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          required={question.required}
          className={inputCls}
          style={inputStyle}
        />
      </div>
    )
  }

  if (question.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          required={question.required}
          rows={4}
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
      </div>
    )
  }

  if (question.type === 'yes_no') {
    const current = (value as string) ?? ''
    return (
      <div>
        {label}
        <div className="flex gap-3">
          {(['Yes', 'No'] as const).map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer text-sm font-semibold f-body flex-1 justify-center transition-all"
              style={{
                border:     '1.5px solid',
                borderColor: current === opt ? '#E67E50' : 'rgba(10,46,77,0.15)',
                background:  current === opt ? 'rgba(230,126,80,0.08)' : '#FDFAF7',
                color:       current === opt ? '#E67E50' : 'rgba(10,46,77,0.55)',
              }}
            >
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={current === opt}
                onChange={() => onChange(opt)}
                required={question.required}
                className="sr-only"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === 'select') {
    const opts = question.options ?? []
    const current = (value as string) ?? ''
    return (
      <div>
        {label}
        <div className="space-y-2">
          {opts.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer text-sm f-body transition-all"
              style={{
                border:     '1.5px solid',
                borderColor: current === opt ? '#E67E50' : 'rgba(10,46,77,0.12)',
                background:  current === opt ? 'rgba(230,126,80,0.06)' : '#FDFAF7',
                color:       current === opt ? '#E67E50' : '#0A2E4D',
              }}
            >
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={current === opt}
                onChange={() => onChange(opt)}
                required={question.required}
                className="sr-only"
              />
              <span
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  border: `2px solid ${current === opt ? '#E67E50' : 'rgba(10,46,77,0.25)'}`,
                }}
              >
                {current === opt && (
                  <span className="w-2 h-2 rounded-full" style={{ background: '#E67E50' }} />
                )}
              </span>
              {opt}
            </label>
          ))}
        </div>
        {question.required && (
          <input
            type="hidden"
            required
            value={current}
          />
        )}
      </div>
    )
  }

  if (question.type === 'multi_select') {
    const opts    = question.options ?? []
    const current = (value as string[] | undefined) ?? []
    return (
      <div>
        {label}
        <div className="space-y-2">
          {opts.map(opt => {
            const checked = current.includes(opt)
            return (
              <label
                key={opt}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer text-sm f-body transition-all"
                style={{
                  border:     '1.5px solid',
                  borderColor: checked ? '#E67E50' : 'rgba(10,46,77,0.12)',
                  background:  checked ? 'rgba(230,126,80,0.06)' : '#FDFAF7',
                  color:       checked ? '#E67E50' : '#0A2E4D',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleMulti(opt)}
                  className="sr-only"
                />
                <span
                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{
                    border:     `2px solid ${checked ? '#E67E50' : 'rgba(10,46,77,0.25)'}`,
                    background:  checked ? '#E67E50' : 'transparent',
                  }}
                >
                  {checked && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt}
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}
