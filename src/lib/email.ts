/**
 * Email utility — Resend integration.
 *
 * All transactional emails go through this module.
 * Import typed send functions rather than calling Resend directly.
 *
 * SERVER-ONLY. Import only in:
 *   - Server Actions (src/actions/*)
 *   - Route Handlers (src/app/api/*)
 */

import { createElement } from 'react'
import { render } from '@react-email/components'
import { env } from '@/lib/env'
import { GuideApplicationEmail } from '@/emails/guide-application'
import { GuideWelcomeEmail } from '@/emails/guide-welcome'
import { PasswordResetEmail } from '@/emails/password-reset'
import { EmailVerificationEmail } from '@/emails/email-verification'
import type { GuideApplicationEmailProps } from '@/emails/guide-application'
import type { GuideWelcomeEmailProps } from '@/emails/guide-welcome'
import type { PasswordResetEmailProps } from '@/emails/password-reset'
import type { EmailVerificationProps } from '@/emails/email-verification'

const FROM = 'FjordAnglers <contact@fjordanglers.com>'

// ─── Core send helper ─────────────────────────────────────────────────────────

async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: React.ReactElement
}): Promise<void> {
  const html = await render(react)

  // Call Resend REST API directly — bypasses the SDK's internal fetch which can
  // fail silently in Next.js environments where the global fetch is patched with
  // caching logic. Using cache: 'no-store' ensures every send is a fresh request.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)')
    throw new Error(`[email] Resend HTTP ${response.status}: ${body}`)
  }
}

// ─── Typed send functions ─────────────────────────────────────────────────────

/**
 * Sent to the guide applicant after they submit /guides/apply.
 * Non-blocking: caller should fire-and-forget with .catch().
 */
export async function sendGuideApplicationEmail(
  props: { to: string } & GuideApplicationEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: 'We received your FjordAnglers application',
    react: createElement(GuideApplicationEmail, templateProps),
  })
}

/**
 * Sent to the guide after they successfully claim their invite profile.
 * Non-blocking: caller should fire-and-forget with .catch().
 */
export async function sendGuideWelcomeEmail(
  props: { to: string } & GuideWelcomeEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: 'Welcome to FjordAnglers — your account is ready',
    react: createElement(GuideWelcomeEmail, templateProps),
  })
}

/**
 * Sent to the user after they sign up — replaces Supabase's default verification email.
 * confirmUrl must be generated via supabase.auth.admin.generateLink({ type: 'signup' }).
 */
export async function sendEmailVerificationEmail(
  props: { to: string } & EmailVerificationProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: 'Confirm your FjordAnglers email address',
    react: createElement(EmailVerificationEmail, templateProps),
  })
}

/**
 * Sent to the user when they request a password reset.
 * resetUrl must be generated via supabase.auth.admin.generateLink({ type: 'recovery' }).
 */
export async function sendPasswordResetEmail(
  props: { to: string } & PasswordResetEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: 'Reset your FjordAnglers password',
    react: createElement(PasswordResetEmail, templateProps),
  })
}
