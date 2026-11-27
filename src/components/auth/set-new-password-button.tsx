'use client'

/**
 * The one button on /auth/reset/confirm (FA-M.15). Disabled while its form is submitting, so
 * a double click sends one POST; a second POST that does get through is still handled
 * (confirmPasswordReset sees the recovery session and goes on to /reset-password).
 */

import { useFormStatus } from 'react-dom'

export function SetNewPasswordButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        background: pending ? 'rgba(230,126,80,0.6)' : '#E67E50',
        borderRadius: '14px',
        padding: '14px',
        color: 'white',
        fontSize: '15px',
        fontWeight: 600,
        border: 'none',
        cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
      }}
      className="f-body"
    >
      {pending ? 'Opening…' : 'Set new password'}
    </button>
  )
}
