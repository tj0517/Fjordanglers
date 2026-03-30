'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { linkGuideAccount } from '@/actions/admin'
import { Check, Loader2, Link2 } from 'lucide-react'

type Props = {
  guideId: string
  inviteEmail: string
}

/**
 * One-click button that links a beta guide listing to an existing auth account.
 *
 * The server action automatically finds the auth user by invite_email —
 * admin just clicks, no UUID input needed.
 *
 * Shown on /admin/guides/[id] only when user_id IS NULL and invite_email IS SET.
 */
export default function LinkGuideButton({ guideId, inviteEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'success' | { error: string }>('idle')

  const handleLink = () => {
    setState('idle')
    startTransition(async () => {
      const result = await linkGuideAccount(guideId)
      if ('error' in result) {
        setState({ error: result.error })
      } else {
        setState('success')
        // Refresh the Server Component to show updated user_id / beta badge
        router.refresh()
      }
    })
  }

  if (state === 'success') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold f-body" style={{ color: '#16A34A' }}>
        <Check size={13} strokeWidth={2.2} />
        Linked — dashboard unlocked
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <button
        type="button"
        onClick={handleLink}
        disabled={isPending}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed f-body"
        style={{ background: 'rgba(37,99,235,0.12)', color: '#1D4ED8' }}
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" size={11} strokeWidth={2} />
            Linking…
          </>
        ) : (
          <>
            {/* Link / chain icon */}
            <Link2 size={11} strokeWidth={1.5} />
            Link account
          </>
        )}
      </button>

      {typeof state === 'object' && (
        <p className="text-[10px] f-body text-right max-w-[220px] leading-tight" style={{ color: '#DC2626' }}>
          {state.error}
        </p>
      )}
    </div>
  )
}
