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
import { BookingRequestGuideEmail } from '@/emails/booking-request-guide'
import { BookingRequestAnglerEmail } from '@/emails/booking-request-angler'
import { BookingConfirmedAnglerEmail } from '@/emails/booking-confirmed-angler'
import { BookingDeclinedAnglerEmail } from '@/emails/booking-declined-angler'
import { InquiryRequestGuideEmail } from '@/emails/inquiry-request-guide'
import { InquiryRequestAnglerEmail } from '@/emails/inquiry-request-angler'
import { OfferSentAnglerEmail } from '@/emails/offer-sent-angler'
import { OfferAcceptedGuideEmail } from '@/emails/offer-accepted-guide'
import { OfferDeclinedGuideEmail } from '@/emails/offer-declined-guide'
import type { GuideApplicationEmailProps } from '@/emails/guide-application'
import type { GuideWelcomeEmailProps } from '@/emails/guide-welcome'
import type { PasswordResetEmailProps } from '@/emails/password-reset'
import type { EmailVerificationProps } from '@/emails/email-verification'
import type { BookingRequestGuideEmailProps } from '@/emails/booking-request-guide'
import type { BookingRequestAnglerEmailProps } from '@/emails/booking-request-angler'
import type { BookingConfirmedAnglerEmailProps } from '@/emails/booking-confirmed-angler'
import type { BookingDeclinedAnglerEmailProps } from '@/emails/booking-declined-angler'
import type { InquiryRequestGuideEmailProps } from '@/emails/inquiry-request-guide'
import type { InquiryRequestAnglerEmailProps } from '@/emails/inquiry-request-angler'
import type { OfferSentAnglerEmailProps } from '@/emails/offer-sent-angler'
import type { OfferAcceptedGuideEmailProps } from '@/emails/offer-accepted-guide'
import type { OfferDeclinedGuideEmailProps } from '@/emails/offer-declined-guide'

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

// ─── Booking request emails ───────────────────────────────────────────────────

export type BookingRequestEmailParams = {
  guideEmail: string
  anglerEmail: string
  anglerName: string
  guideName: string
  experienceTitle: string
  bookingId: string
  bookingDate: string
  dateTo: string | null
  requestedDates: string[]
  guests: number
  packageLabel: string | null
  totalEur: number
  specialRequests: string | null
}

/**
 * Sends booking request notification emails to both the guide and the angler.
 * Guide gets: new request alert with angler details and CTA to dashboard.
 * Angler gets: confirmation that their request was sent with a summary.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendBookingRequestEmails(
  params: BookingRequestEmailParams,
): Promise<void> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL

  const guideProps: BookingRequestGuideEmailProps = {
    guideName:       params.guideName,
    anglerName:      params.anglerName,
    anglerEmail:     params.anglerEmail,
    experienceTitle: params.experienceTitle,
    bookingId:       params.bookingId,
    bookingDate:     params.bookingDate,
    dateTo:          params.dateTo,
    requestedDates:  params.requestedDates,
    guests:          params.guests,
    packageLabel:    params.packageLabel,
    totalEur:        params.totalEur,
    specialRequests: params.specialRequests,
    bookingUrl:      `${baseUrl}/dashboard/bookings/${params.bookingId}`,
  }

  const anglerProps: BookingRequestAnglerEmailProps = {
    anglerName:      params.anglerName,
    guideName:       params.guideName,
    experienceTitle: params.experienceTitle,
    bookingId:       params.bookingId,
    bookingDate:     params.bookingDate,
    dateTo:          params.dateTo,
    requestedDates:  params.requestedDates,
    guests:          params.guests,
    packageLabel:    params.packageLabel,
    totalEur:        params.totalEur,
    specialRequests: params.specialRequests,
    bookingUrl:      `${baseUrl}/account/bookings/${params.bookingId}`,
  }

  await Promise.all([
    sendEmail({
      to:      params.guideEmail,
      subject: `New booking request — ${params.experienceTitle}`,
      react:   createElement(BookingRequestGuideEmail, guideProps),
    }),
    sendEmail({
      to:      params.anglerEmail,
      subject: `Your booking request to ${params.guideName}`,
      react:   createElement(BookingRequestAnglerEmail, anglerProps),
    }),
  ])
}

// ─── Booking confirmed email ───────────────────────────────────────────────────

/**
 * Sent to the angler when the guide confirms their booking.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendBookingConfirmedEmail(
  props: { to: string } & BookingConfirmedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking confirmed — ${templateProps.experienceTitle}`,
    react:   createElement(BookingConfirmedAnglerEmail, templateProps),
  })
}

// ─── Icelandic inquiry emails ─────────────────────────────────────────────────

export type InquiryRequestEmailParams = {
  guideEmail: string
  anglerEmail: string
  anglerName: string
  guideName: string
  experienceTitle: string
  inquiryId: string
  periods: Array<{ from: string; to: string }>
  individualDates: string[]
  guests: number
  labeledAnswers: Array<{ label: string; answer: string }>
  notes: string | null
  durationPreference?: string | null
}

/**
 * Sends trip enquiry notification emails to both the guide and the angler.
 * Guide gets: new enquiry alert with angler's availability and custom answers.
 * Angler gets: confirmation that their enquiry was sent.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendInquiryRequestEmails(
  params: InquiryRequestEmailParams,
): Promise<void> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL

  const guideProps: InquiryRequestGuideEmailProps = {
    guideName:          params.guideName,
    anglerName:         params.anglerName,
    anglerEmail:        params.anglerEmail,
    experienceTitle:    params.experienceTitle,
    inquiryId:          params.inquiryId,
    periods:            params.periods,
    individualDates:    params.individualDates,
    guests:             params.guests,
    labeledAnswers:     params.labeledAnswers,
    notes:              params.notes,
    durationPreference: params.durationPreference ?? null,
    inquiryUrl:         `${baseUrl}/dashboard/bookings/${params.inquiryId}`,
  }

  const anglerProps: InquiryRequestAnglerEmailProps = {
    anglerName:      params.anglerName,
    guideName:       params.guideName,
    experienceTitle: params.experienceTitle,
    inquiryId:       params.inquiryId,
    periods:         params.periods,
    individualDates: params.individualDates,
    guests:          params.guests,
    inquiryUrl:      `${baseUrl}/account/bookings/${params.inquiryId}`,
  }

  await Promise.all([
    sendEmail({
      to:      params.guideEmail,
      subject: `New trip enquiry — ${params.experienceTitle}`,
      react:   createElement(InquiryRequestGuideEmail, guideProps),
    }),
    sendEmail({
      to:      params.anglerEmail,
      subject: `Your enquiry to ${params.guideName} — ${params.experienceTitle}`,
      react:   createElement(InquiryRequestAnglerEmail, anglerProps),
    }),
  ])
}

// ─── Booking declined email ────────────────────────────────────────────────────

/**
 * Sent to the angler when the guide declines their booking.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendBookingDeclinedEmail(
  props: { to: string } & BookingDeclinedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking not confirmed — ${templateProps.experienceTitle}`,
    react:   createElement(BookingDeclinedAnglerEmail, templateProps),
  })
}

// ─── Offer flow emails ────────────────────────────────────────────────────────

/**
 * Sent to the angler when the guide proposes new/different dates (offer_sent).
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendOfferSentEmail(
  props: { to: string } & OfferSentAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New dates proposed — ${templateProps.experienceTitle}`,
    react:   createElement(OfferSentAnglerEmail, templateProps),
  })
}

/**
 * Sent to the guide when the angler accepts their offer.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendOfferAcceptedEmail(
  props: { to: string } & OfferAcceptedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking confirmed — ${templateProps.anglerName} accepted`,
    react:   createElement(OfferAcceptedGuideEmail, templateProps),
  })
}

/**
 * Sent to the guide when the angler declines their offer.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendOfferDeclinedEmail(
  props: { to: string } & OfferDeclinedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Proposal declined — ${templateProps.experienceTitle}`,
    react:   createElement(OfferDeclinedGuideEmail, templateProps),
  })
}
