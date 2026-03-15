'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { linkGuideAccount } from '@/actions/admin'

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
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polyline points="2,7 5,10 11,3" />
        </svg>
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
            <svg
              className="animate-spin"
              width="11" height="11" viewBox="0 0 11 11"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="5.5" cy="5.5" r="4" strokeOpacity="0.25" />
              <path d="M5.5 1.5a4 4 0 014 4" strokeLinecap="round" />
            </svg>
            Linking…
          </>
        ) : (
          <>
            {/* Link / chain icon */}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4.2 6.8a2.5 2.5 0 003.6 0l1.5-1.5a2.5 2.5 0 00-3.5-3.5L5 2.6" />
              <path d="M6.8 4.2a2.5 2.5 0 00-3.6 0L1.7 5.7a2.5 2.5 0 003.5 3.5L6 8.4" />
            </svg>
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
