'use client'

/**
 * DeleteExperienceButton — inline two-step confirmation for deleting an experience.
 *
 * First click → shows "Sure? / Cancel" inline (no modal, keeps the table compact).
 * Confirmed click → calls deleteExperience() → router.refresh() to reload the table.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteExperience } from '@/actions/admin'

type Props = {
  experienceId: string
  title: string
}

export default function DeleteExperienceButton({ experienceId, title }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteExperience(experienceId)
      if ('error' in result) {
        setError(result.error)
        setConfirming(false)
      } else {
        router.refresh()
      }
    })
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="text-[10px] font-bold f-body transition-opacity disabled:opacity-50"
          style={{ color: '#DC2626' }}
          aria-label={`Confirm delete "${title}"`}
        >
          {isPending ? '…' : 'Confirm'}
        </button>
        <span style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => { setConfirming(false); setError(null) }}
          className="text-[10px] f-body transition-opacity disabled:opacity-50"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Cancel
        </button>
        {error != null && (
          <span className="text-[9px] f-body" style={{ color: '#DC2626' }}>{error}</span>
        )}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-[10px] font-medium f-body transition-all hover:opacity-90"
      style={{ color: 'rgba(220,38,38,0.55)' }}
      aria-label={`Delete "${title}"`}
      title={`Delete "${title}"`}
    >
      Delete
    </button>
  )
}
