'use client'

import { useState } from 'react'
import { FormBuilder } from '../FormBuilder'
import { updateIntakeForm, deleteIntakeForm } from '@/actions/guide-forms'
import type { FormQuestion, GuideIntakeForm } from '@/actions/guide-forms'
import { useRouter } from 'next/navigation'

interface Props {
  form: GuideIntakeForm
}

export function FormEditorClient({ form }: Props) {
  const router = useRouter()
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [saved,    setSaved]    = useState(false)

  async function handleSave(title: string, description: string, questions: FormQuestion[]) {
    setSaving(true)
    setError(null)
    setSaved(false)

    const result = await updateIntakeForm(form.id, {
      title,
      description: description || null,
      questions,
    })

    setSaving(false)
    if (result != null && 'error' in result) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleToggleActive() {
    setToggling(true)
    await updateIntakeForm(form.id, { is_active: !form.is_active })
    setToggling(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${form.title}"? This will also delete all responses. This cannot be undone.`)) return
    setDeleting(true)
    await deleteIntakeForm(form.id)
    router.push('/admin/forms')
  }

  return (
    <div className="space-y-4">

      {/* ── Active toggle + delete ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-[16px]"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: form.is_active ? '#16a34a' : 'rgba(10,46,77,0.2)' }}
          />
          <span className="text-sm f-body font-medium" style={{ color: '#0A2E4D' }}>
            {form.is_active ? 'Form is active — accepting responses' : 'Form is closed — not accepting responses'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={toggling}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold f-body disabled:opacity-50"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
          >
            {toggling ? '…' : form.is_active ? 'Close form' : 'Reopen form'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold f-body disabled:opacity-50"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* ── Builder ───────────────────────────────────────────────────── */}
      <FormBuilder
        initialTitle={form.title}
        initialDescription={form.description ?? ''}
        initialQuestions={form.questions}
        onSave={handleSave}
        saving={saving}
      />

      {saved && (
        <p className="text-sm f-body text-center" style={{ color: '#16a34a' }}>
          Changes saved ✓
        </p>
      )}
      {error != null && (
        <p className="text-sm f-body text-center" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
