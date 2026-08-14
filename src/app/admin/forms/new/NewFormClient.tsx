'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FormBuilder } from '../FormBuilder'
import { createIntakeForm } from '@/actions/guide-forms'
import type { FormQuestion } from '@/actions/guide-forms'

export function NewFormClient() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(
    title: string,
    description: string,
    questions: FormQuestion[],
  ) {
    setSaving(true)
    setError(null)

    const result = await createIntakeForm(title, description || null, questions)

    if ('error' in result) {
      setError(result.error)
      setSaving(false)
      return
    }

    router.push(`/admin/forms/${result.id}`)
  }

  return (
    <div>
      <FormBuilder onSave={handleSave} saving={saving} />
      {error != null && (
        <p className="text-sm f-body text-center mt-4" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
