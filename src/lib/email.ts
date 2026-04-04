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
import { BookingRequestAnglerEmail } from '@/emails/booking-request-angler'
import { BookingRequestGuideEmail } from '@/emails/booking-request-guide'
import { BookingAcceptedAnglerEmail } from '@/emails/booking-accepted-angler'
import { BookingConfirmedAnglerEmail } from '@/emails/booking-confirmed-angler'
import { BookingConfirmedGuideEmail } from '@/emails/booking-confirmed-guide'
import { BookingDeclinedAnglerEmail } from '@/emails/booking-declined-angler'
import { BalancePaidAnglerEmail } from '@/emails/balance-paid-angler'
import { InquiryReceivedAnglerEmail } from '@/emails/inquiry-received-angler'
import { InquiryReceivedGuideEmail } from '@/emails/inquiry-received-guide'
import { OfferReceivedAnglerEmail } from '@/emails/offer-received-angler'
import { OfferAcceptedGuideEmail } from '@/emails/offer-accepted-guide'
import type { GuideApplicationEmailProps } from '@/emails/guide-application'
import type { GuideWelcomeEmailProps } from '@/emails/guide-welcome'
import type { PasswordResetEmailProps } from '@/emails/password-reset'
import type { EmailVerificationProps } from '@/emails/email-verification'
import type { BookingRequestAnglerEmailProps } from '@/emails/booking-request-angler'
import type { BookingRequestGuideEmailProps } from '@/emails/booking-request-guide'
import type { BookingAcceptedAnglerEmailProps } from '@/emails/booking-accepted-angler'
import type { BookingConfirmedAnglerEmailProps } from '@/emails/booking-confirmed-angler'
import type { BookingConfirmedGuideEmailProps } from '@/emails/booking-confirmed-guide'
import type { BookingDeclinedAnglerEmailProps } from '@/emails/booking-declined-angler'
import type { BalancePaidAnglerEmailProps } from '@/emails/balance-paid-angler'
import type { InquiryReceivedAnglerEmailProps } from '@/emails/inquiry-received-angler'
import type { InquiryReceivedGuideEmailProps } from '@/emails/inquiry-received-guide'
import type { OfferReceivedAnglerEmailProps } from '@/emails/offer-received-angler'
import type { OfferAcceptedGuideEmailProps } from '@/emails/offer-accepted-guide'

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

// ─── Date formatting helpers ───────────────────────────────────────────────────

/**
 * Format an ISO date string (YYYY-MM-DD) to a human-readable label.
 * Example: "2026-04-04" → "4 Apr 2026"
 */
export function fmtEmailDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Format an ISO date range to a human-readable label.
 * Same month:  "4–8 Apr 2026"
 * Same year:   "4 Apr – 8 May 2026"
 * Cross year:  "30 Dec 2025 – 3 Jan 2026"
 */
export function fmtEmailDateRange(from: string, to: string): string {
  if (!from) return ''
  if (!to || from === to) return fmtEmailDate(from)
  try {
    const d1 = new Date(`${from}T12:00:00`)
    const d2 = new Date(`${to}T12:00:00`)
    const sameYear  = d1.getFullYear() === d2.getFullYear()
    const sameMonth = sameYear && d1.getMonth() === d2.getMonth()
    if (sameMonth) {
      return `${d1.getDate()}–${d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (sameYear) {
      return `${d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return `${fmtEmailDate(from)} – ${fmtEmailDate(to)}`
  } catch {
    return `${from} – ${to}`
  }
}

/**
 * Format an array of specific day strings for display in emails.
 * 1 day:  "4 Apr 2026"
 * 2 days: "4 Apr – 6 Apr 2026"
 * 3+ days (consecutive envelope): "4–8 Apr 2026"
 * Always respects the actual first/last dates.
 */
export function fmtEmailDays(days: string[]): string {
  if (!days.length) return ''
  if (days.length === 1) return fmtEmailDate(days[0])
  return fmtEmailDateRange(days[0], days[days.length - 1])
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

// ─── Booking flow — direct ────────────────────────────────────────────────────

/**
 * Sent to angler immediately after createBookingCheckout() — booking created, awaiting guide acceptance.
 */
export async function sendBookingRequestAnglerEmail(
  props: { to: string } & BookingRequestAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking request received — ${templateProps.guideName} will respond shortly`,
    react: createElement(BookingRequestAnglerEmail, templateProps),
  })
}

/**
 * Sent to guide immediately after createBookingCheckout() — new booking request notification.
 */
export async function sendBookingRequestGuideEmail(
  props: { to: string } & BookingRequestGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New booking request from ${templateProps.anglerName}`,
    react: createElement(BookingRequestGuideEmail, templateProps),
  })
}

/**
 * Sent to angler when guide calls acceptBooking() — prompt to pay deposit.
 */
export async function sendBookingAcceptedAnglerEmail(
  props: { to: string } & BookingAcceptedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking accepted — pay your deposit to confirm`,
    react: createElement(BookingAcceptedAnglerEmail, templateProps),
  })
}

/**
 * Sent to angler after webhook confirms deposit OR inquiry full payment.
 */
export async function sendBookingConfirmedAnglerEmail(
  props: { to: string } & BookingConfirmedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: templateProps.isPaidInFull
      ? 'Booking confirmed! 🎣'
      : 'Deposit received — booking confirmed',
    react: createElement(BookingConfirmedAnglerEmail, templateProps),
  })
}

/**
 * Sent to guide after webhook confirms deposit OR inquiry full payment.
 */
export async function sendBookingConfirmedGuideEmail(
  props: { to: string } & BookingConfirmedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: templateProps.isPaidInFull
      ? `${templateProps.anglerName} confirmed — paid in full`
      : `${templateProps.anglerName} paid deposit — booking confirmed`,
    react: createElement(BookingConfirmedGuideEmail, templateProps),
  })
}

/**
 * Sent to angler when guide calls declineBooking().
 */
export async function sendBookingDeclinedAnglerEmail(
  props: { to: string } & BookingDeclinedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking request declined — ${templateProps.guideName}`,
    react: createElement(BookingDeclinedAnglerEmail, templateProps),
  })
}

/**
 * Sent to angler after the balance is fully paid (via Stripe webhook or guide's manual cash confirmation).
 */
export async function sendBalancePaidAnglerEmail(
  props: { to: string } & BalancePaidAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: 'Trip fully paid — see you on the water! 🎣',
    react: createElement(BalancePaidAnglerEmail, templateProps),
  })
}

// ─── Booking flow — inquiry ───────────────────────────────────────────────────

/**
 * Sent to angler after createInquiryBooking() — confirmation their request was sent.
 */
export async function sendInquiryReceivedAnglerEmail(
  props: { to: string } & InquiryReceivedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Your fishing request has been sent to ${templateProps.guideName}`,
    react: createElement(InquiryReceivedAnglerEmail, templateProps),
  })
}

/**
 * Sent to guide after createInquiryBooking() — new inquiry notification.
 */
export async function sendInquiryReceivedGuideEmail(
  props: { to: string } & InquiryReceivedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New fishing request from ${templateProps.anglerName}`,
    react: createElement(InquiryReceivedGuideEmail, templateProps),
  })
}

/**
 * Sent to angler after guide calls sendOffer() — prompt to review and accept.
 */
export async function sendOfferReceivedAnglerEmail(
  props: { to: string } & OfferReceivedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `You have a new offer from ${templateProps.guideName} — €${templateProps.priceEur}`,
    react: createElement(OfferReceivedAnglerEmail, templateProps),
  })
}

/**
 * Sent to guide after angler calls acceptBookingOffer() — payment is processing.
 */
export async function sendOfferAcceptedGuideEmail(
  props: { to: string } & OfferAcceptedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `${templateProps.anglerName} accepted your offer — payment processing`,
    react: createElement(OfferAcceptedGuideEmail, templateProps),
  })
}
