'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { FormQuestion, QuestionType } from '@/actions/guide-forms'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text',         label: 'Short text'       },
  { value: 'textarea',     label: 'Long text'        },
  { value: 'select',       label: 'Single choice'    },
  { value: 'multi_select', label: 'Multiple choice'  },
  { value: 'number',       label: 'Number'           },
  { value: 'url',          label: 'URL / Website'    },
  { value: 'yes_no',       label: 'Yes / No'         },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialTitle?:       string
  initialDescription?: string
  initialQuestions?:   FormQuestion[]
  onSave: (
    title:       string,
    description: string,
    questions:   FormQuestion[],
  ) => Promise<void>
  saving?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FormBuilder({
  initialTitle       = '',
  initialDescription = '',
  initialQuestions   = [],
  onSave,
  saving             = false,
}: Props) {
  const [title,       setTitle]       = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [questions,   setQuestions]   = useState<FormQuestion[]>(initialQuestions)
  const [error,       setError]       = useState<string | null>(null)

  function addQuestion() {
    setQuestions(prev => [
      ...prev,
      { id: uid(), type: 'text', label: '', required: false },
    ])
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setQuestions(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function moveDown(idx: number) {
    setQuestions(prev => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  function updateQuestion(idx: number, updates: Partial<FormQuestion>) {
    setQuestions(prev =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q)),
    )
  }

  async function handleSave() {
    setError(null)
    if (!title.trim())                    { setError('Form title is required'); return }
    if (questions.some(q => !q.label.trim())) { setError('All questions need a label'); return }
    await onSave(title, description, questions)
  }

  // ── Shared input styles ────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none'
  const inputStyle = { border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#fff' }

  return (
    <div className="space-y-5">

      {/* ── Title & Description ─────────────────────────────────────────── */}
      <div className="p-5 rounded-[18px] space-y-4"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.14em] font-bold f-body mb-1.5"
            style={{ color: 'rgba(10,46,77,0.4)' }}>
            Form Title *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. New Zealand Guide Onboarding"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.14em] font-bold f-body mb-1.5"
            style={{ color: 'rgba(10,46,77,0.4)' }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short intro shown to guides at the top of the form"
            rows={3}
            className={`${inputCls} resize-none`}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Questions ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            idx={idx}
            total={questions.length}
            onUpdate={u => updateQuestion(idx, u)}
            onRemove={() => removeQuestion(idx)}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
          />
        ))}
      </div>

      {/* ── Add Question ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold f-body transition-all"
        style={{
          border:   '2px dashed rgba(10,46,77,0.15)',
          color:    'rgba(10,46,77,0.45)',
          background: 'transparent',
        }}
      >
        <Plus size={15} strokeWidth={2} />
        Add Question
      </button>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error != null && (
        <p className="text-sm f-body text-center" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* ── Save ────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold f-body transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: '#E67E50', color: '#fff' }}
      >
        {saving ? 'Saving…' : 'Save Form'}
      </button>

    </div>
  )
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  idx,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  question:   FormQuestion
  idx:        number
  total:      number
  onUpdate:   (u: Partial<FormQuestion>) => void
  onRemove:   () => void
  onMoveUp:   () => void
  onMoveDown: () => void
}) {
  const needsOptions = question.type === 'select' || question.type === 'multi_select'

  return (
    <div className="p-4 rounded-[16px]"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.09)' }}>
      <div className="flex items-start gap-3">

        {/* Number badge */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold f-body"
          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.45)' }}
        >
          {idx + 1}
        </div>

        {/* Fields */}
        <div className="flex-1 min-w-0 space-y-2.5">

          {/* Label + Type */}
          <div className="flex gap-2">
            <input
              value={question.label}
              onChange={e => onUpdate({ label: e.target.value })}
              placeholder="Question text…"
              className="flex-1 px-3 py-2 rounded-lg text-sm f-body outline-none"
              style={{ border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#fff' }}
            />
            <select
              value={question.type}
              onChange={e =>
                onUpdate({ type: e.target.value as QuestionType, options: undefined })
              }
              className="px-3 py-2 rounded-lg text-sm f-body outline-none"
              style={{ border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#fff' }}
            >
              {QUESTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Options (select / multi_select) */}
          {needsOptions && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] font-bold f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.35)' }}>
                Options — one per line
              </p>
              <textarea
                value={(question.options ?? []).join('\n')}
                onChange={e =>
                  onUpdate({
                    options: e.target.value
                      .split('\n')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                placeholder={"Option A\nOption B\nOption C"}
                className="w-full px-3 py-2 rounded-lg text-sm f-body outline-none resize-none"
                style={{ border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D', background: '#fff' }}
              />
            </div>
          )}

          {/* Placeholder (text/textarea/url/number) */}
          {!needsOptions && question.type !== 'yes_no' && (
            <input
              value={question.placeholder ?? ''}
              onChange={e => onUpdate({ placeholder: e.target.value || undefined })}
              placeholder="Placeholder hint (optional)"
              className="w-full px-3 py-2 rounded-lg text-xs f-body outline-none"
              style={{ border: '1px solid rgba(10,46,77,0.09)', color: 'rgba(10,46,77,0.5)', background: '#fff' }}
            />
          )}

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer w-fit select-none">
            <input
              type="checkbox"
              checked={question.required}
              onChange={e => onUpdate({ required: e.target.checked })}
            />
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Required</span>
          </label>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={idx === 0}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 disabled:opacity-20"
            title="Move up"
          >
            <ChevronUp size={14} strokeWidth={1.8} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 disabled:opacity-20"
            title="Move down"
          >
            <ChevronDown size={14} strokeWidth={1.8} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
            title="Remove question"
          >
            <Trash2 size={14} strokeWidth={1.8} style={{ color: '#DC2626' }} />
          </button>
        </div>

      </div>
    </div>
  )
}
