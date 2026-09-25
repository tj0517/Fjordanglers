'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { createKnowledgeEntry, updateKnowledgeEntry, type KnowledgePayload } from '@/actions/knowledge'
import { COUNTRIES } from '@/lib/countries'

// ─── Design-system micro-components ──────────────────────────────────────────

function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.55)' }}
    >
      {children}
      {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all"
      style={{
        background: '#F3EDE4',
        border: '1.5px solid rgba(10,46,77,0.1)',
        color: '#0A2E4D',
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none"
      style={{
        background: '#F3EDE4',
        border: '1.5px solid rgba(10,46,77,0.1)',
        color: props.value === '' ? 'rgba(10,46,77,0.38)' : '#0A2E4D',
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

// ─── Guide picker type ────────────────────────────────────────────────────────

interface GuideOption {
  id: string
  full_name: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KnowledgeFormProps {
  mode: 'create' | 'edit'
  entryId?: string
  initialValues?: Partial<KnowledgePayload>
  guides: GuideOption[]
}

type KindValue = 'instructions' | 'tone' | 'destination' | 'guide'

// ─── Component ────────────────────────────────────────────────────────────────

export function KnowledgeForm({ mode, entryId, initialValues, guides }: KnowledgeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const [kind, setKind]       = useState<KindValue>((initialValues?.kind as KindValue) ?? 'destination')
  const [country, setCountry] = useState<string>(initialValues?.country ?? '')
  const [guideId, setGuideId] = useState<string>(initialValues?.guide_id ?? '')
  const [title, setTitle]     = useState(initialValues?.title ?? '')
  const [body, setBody]       = useState(initialValues?.body ?? '')
  const [active, setActive]   = useState(initialValues?.active ?? true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: KnowledgePayload = {
      kind,
      country:  kind === 'destination' ? (country as typeof COUNTRIES[number]) || null : null,
      guide_id: kind === 'guide' ? guideId || null : null,
      title,
      body,
      active,
    }

    startTransition(async () => {
      const result = mode === 'create'
        ? await createKnowledgeEntry(payload)
        : await updateKnowledgeEntry(entryId!, payload)

      if (!result.success) {
        setError(result.error)
        return
      }
      router.push('/admin/knowledge')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {/* Kind */}
      <div>
        <FieldLabel htmlFor="kind" required>Kind</FieldLabel>
        <SelectInput
          id="kind"
          value={kind}
          onChange={e => setKind(e.target.value as KindValue)}
          disabled={mode === 'edit'}
        >
          <option value="instructions">instructions — system prompt</option>
          <option value="tone">tone — tone of voice</option>
          <option value="destination">destination — country knowledge</option>
          <option value="guide">guide — guide-specific notes</option>
        </SelectInput>
        {mode === 'edit' && (
          <p className="mt-1 text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            Kind cannot be changed after creation.
          </p>
        )}
      </div>

      {/* Country (destination only) */}
      {kind === 'destination' && (
        <div>
          <FieldLabel htmlFor="country" required>Country</FieldLabel>
          <SelectInput
            id="country"
            value={country}
            onChange={e => setCountry(e.target.value)}
          >
            <option value="">— select country —</option>
            {COUNTRIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectInput>
        </div>
      )}

      {/* Guide (guide kind only) */}
      {kind === 'guide' && (
        <div>
          <FieldLabel htmlFor="guide_id" required>Guide</FieldLabel>
          <SelectInput
            id="guide_id"
            value={guideId}
            onChange={e => setGuideId(e.target.value)}
          >
            <option value="">— select guide —</option>
            {guides.map(g => (
              <option key={g.id} value={g.id}>{g.full_name}</option>
            ))}
          </SelectInput>
        </div>
      )}

      {/* Title */}
      <div>
        <FieldLabel htmlFor="title" required>Title</FieldLabel>
        <TextInput
          id="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Iceland — salmon season"
        />
      </div>

      {/* Body with preview toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel required>Body (markdown)</FieldLabel>
          <button
            type="button"
            onClick={() => setPreview(p => !p)}
            className="text-xs font-medium f-body px-3 py-1.5 rounded-xl transition-all"
            style={{
              background: preview ? 'rgba(230,126,80,0.1)' : 'rgba(10,46,77,0.07)',
              color: preview ? '#E67E50' : 'rgba(10,46,77,0.6)',
            }}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div
            className="w-full px-4 py-3 rounded-2xl text-sm f-body min-h-[200px] prose prose-sm max-w-none"
            style={{
              background: '#F3EDE4',
              border: '1.5px solid rgba(10,46,77,0.1)',
              color: '#0A2E4D',
            }}
          >
            {body.trim() === '' ? (
              <span style={{ color: 'rgba(10,46,77,0.3)' }}>Nothing to preview yet.</span>
            ) : (
              <ReactMarkdown>{body}</ReactMarkdown>
            )}
          </div>
        ) : (
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-y font-mono"
            style={{
              background: '#F3EDE4',
              border: '1.5px solid rgba(10,46,77,0.1)',
              color: '#0A2E4D',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            placeholder="Markdown. The agent reads this verbatim."
          />
        )}
      </div>

      {/* Active */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={() => setActive(a => !a)}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
          style={{ background: active ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
            style={{ transform: active ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
          />
        </button>
        <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
          {active ? 'Active — included in the next prompt' : 'Inactive — excluded from prompts'}
        </span>
      </div>

      {/* Error */}
      {error != null && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl text-sm f-body"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all disabled:opacity-60"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          {isPending ? 'Saving…' : mode === 'create' ? 'Create entry' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/knowledge')}
          className="px-6 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
