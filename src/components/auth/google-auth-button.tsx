'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  next?: string
  label?: string
}

export function GoogleAuthButton({ next = '/dashboard', label = 'Continue with Google' }: Props) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    // Page will redirect — no need to setIsLoading(false)
  }

  return (
    <button
      type="button"
      onClick={() => { void handleClick() }}
      disabled={isLoading}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        background: '#fff',
        border: '1.5px solid rgba(10,46,77,0.14)',
        borderRadius: '14px',
        padding: '13px 16px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.15s ease',
        fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
      }}
    >
      {/* Google G logo */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>

      <span
        style={{
          color: 'rgba(10,46,77,0.75)',
          fontSize: '15px',
          fontWeight: 600,
        }}
        className="f-body"
      >
        {isLoading ? 'Redirecting…' : label}
      </span>
    </button>
  )
}
