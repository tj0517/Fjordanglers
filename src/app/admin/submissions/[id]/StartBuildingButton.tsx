'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wrench } from 'lucide-react'
import { markSubmissionInProgress } from '@/actions/submissions'

type Props = {
  submissionId: string
  guideId: string
  status: string
  compact?: boolean
}

/**
 * StartBuildingButton — FA clicks this to:
 *  1. Mark the submission as in_progress
 *  2. Navigate to /admin/guides/[guideId]/trips/new (full ExperienceForm)
 */
export default function StartBuildingButton({ submissionId, guideId, status, compact = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const label = status === 'in_progress' ? 'Continue building →' : 'Start building →'

  function handleClick() {
    startTransition(async () => {
      const result = await markSubmissionInProgress(submissionId)
      if ('error' in result) {
        alert(result.error)
        return
      }
      router.push(`/admin/guides/${guideId}/trips/new`)
    })
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
        style={{
          background: isPending ? 'rgba(10,46,77,0.4)' : '#0A2E4D',
          color: '#fff',
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? (
          <><Loader2 size={13} className="animate-spin" /> Opening editor…</>
        ) : (
          <><Wrench size={13} /> {label}</>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold f-body transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: isPending ? 'rgba(230,126,80,0.5)' : '#E67E50',
        color: '#fff',
        cursor: isPending ? 'not-allowed' : 'pointer',
        boxShadow: isPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
      }}
    >
      {isPending ? (
        <><Loader2 size={13} className="animate-spin" /> Opening editor…</>
      ) : (
        <><Wrench size={13} /> {label}</>
      )}
    </button>
  )
}
