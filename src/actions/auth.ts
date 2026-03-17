'use server'

/**
 * Auth Server Actions — sign in, sign up, sign out, reset password.
 *
 * All mutations go through the Supabase server client so session cookies
 * are written correctly. Redirects are intentionally NOT called in signIn /
 * signUp — the client components handle navigation after receiving { success: true }.
 * signOut is the exception: it uses redirect() so the session is cleared before
 * the page renders.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Return type ──────────────────────────────────────────────────────────────

export type AuthResult = { error: string } | { success: true }

// ─── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Map common Supabase error codes to user-friendly messages
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        return { error: 'Incorrect email or password. Please try again.' }
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return { error: 'Please confirm your email address before signing in.' }
      }
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[auth/signIn] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Sign up ──────────────────────────────────────────────────────────────────

export async function signUp(
  fullName: string,
  email: string,
  password: string,
  role: 'angler' | 'guide' = 'angler',
): Promise<AuthResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
        // Supabase will send a confirmation email and redirect to /auth/callback
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('user already registered')) {
        return { error: 'An account with this email already exists.' }
      }
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[auth/signUp] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

/**
 * Signs the current user out and redirects to /login.
 * Uses redirect() — call this via <form action={signOut}> in Server or Client Components.
 * The session cookie is cleared before the redirect resolves.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── Reset password ───────────────────────────────────────────────────────────

export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Supabase will redirect here with a code — the callback route exchanges
      // the code for a session, then lets the user set a new password.
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[auth/resetPassword] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
