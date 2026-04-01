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
import { sendPasswordResetEmail } from '@/lib/email'
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
    const service = createServiceClient()

    // Create user directly — email_confirm: true skips the verification email
    // since mailer_autoconfirm is enabled on the Supabase project.
    const { data, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    })

    if (createError != null) {
      if (
        createError.message.toLowerCase().includes('user already registered') ||
        createError.message.toLowerCase().includes('already been registered')
      ) {
        return { error: 'An account with this email already exists.' }
      }
      return { error: createError.message }
    }

    // DB trigger creates the profile row as 'angler' — fix the role if needed.
    if (data.user != null) {
      await service
        .from('profiles')
        .upsert({ id: data.user.id, role }, { onConflict: 'id' })
    }

    // Sign in immediately so the user lands on their dashboard.
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError != null) {
      console.error('[auth/signUp] Auto sign-in failed:', signInError.message)
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
    // Use admin.generateLink() so we can send a custom branded email via Resend
    // instead of Supabase's default template.
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        // /auth/reset is a dedicated no-query-param callback for password recovery.
        // It exchanges the code and redirects straight to /reset-password.
        // (Simpler to whitelist in Supabase than /auth/callback?next=...)
        redirectTo: `${getAppUrl()}/auth/reset`,
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
