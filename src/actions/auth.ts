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
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmailVerificationEmail, sendPasswordResetEmail } from '@/lib/email'
import { env } from '@/lib/env'

/** Returns the canonical app URL.
 *  On Vercel Preview deployments VERCEL_URL is the actual preview hostname,
 *  so we use it instead of NEXT_PUBLIC_APP_URL (which may still be localhost). */
function getAppUrl(): string {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return env.NEXT_PUBLIC_APP_URL
}

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
    // Use admin.generateLink() to create the account and get a confirmation URL,
    // then send our branded verification email via Resend instead of Supabase's default.
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        redirectTo: `${getAppUrl()}/auth/callback`,
      },
    })

    if (error != null) {
      if (
        error.message.toLowerCase().includes('user already registered') ||
        error.message.toLowerCase().includes('already been registered')
      ) {
        return { error: 'An account with this email already exists.' }
      }
      return { error: error.message }
    }

    // Fire-and-forget — email failure must not block the "check your email" screen
    sendEmailVerificationEmail({
      to: email,
      name: fullName,
      confirmUrl: data.properties.action_link,
    }).catch((err: unknown) => {
      console.error('[auth/signUp] Email send error:', err)
    })

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
    // Use admin.generateLink() so we can send a custom branded email via Resend
    // instead of Supabase's default template.
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
      },
    })

    // Always return success to prevent email enumeration (don't reveal whether
    // an account exists for the given address).
    if (error != null || data == null) {
      if (error != null && !error.message.toLowerCase().includes('not found')) {
        console.error('[auth/resetPassword] generateLink error:', error.message)
      }
      return { success: true }
    }

    // Fire-and-forget — don't expose send errors to the user
    sendPasswordResetEmail({
      to: email,
      resetUrl: data.properties.action_link,
    }).catch((err: unknown) => {
      console.error('[auth/resetPassword] Email send error:', err)
    })

    return { success: true }
  } catch (err) {
    console.error('[auth/resetPassword] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
