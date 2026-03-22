'use client'

import { useState } from 'react'
import { resetPassword } from '@/actions/auth'

export function PasswordResetButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle')

  async function handleClick() {
    setState('loading')
    await resetPassword(email)
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <span className="text-sm f-body" style={{ color: '#16A34A' }}>
        Reset link sent — check your inbox ✓
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="text-xs font-bold f-body px-3.5 py-2 rounded-xl transition-all"
      style={{
        background: 'rgba(10,46,77,0.06)',
        color:      '#0A2E4D',
        border:     '1px solid rgba(10,46,77,0.1)',
        cursor:     state === 'loading' ? 'not-allowed' : 'pointer',
        opacity:    state === 'loading' ? 0.6 : 1,
      }}
    >
      {state === 'loading' ? 'Sending…' : 'Send reset email'}
    </button>
  )
}
