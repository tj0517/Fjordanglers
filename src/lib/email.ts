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
import { PasswordResetEmail } from '@/emails/password-reset'
// FA inquiry flow emails
import { InquiryReceivedFaEmail } from '@/emails/inquiry-received-fa'
import { InquiryReceivedAnglerEmail } from '@/emails/inquiry-received-angler'
import { DepositLinkAnglerEmail } from '@/emails/deposit-link-angler'
import { DepositConfirmedAnglerEmail } from '@/emails/deposit-confirmed-angler'
import { DepositConfirmedFaEmail } from '@/emails/deposit-confirmed-fa'
import { BookingConfirmedGuideEmail } from '@/emails/booking-confirmed-guide'
import { InquiryMessageAnglerEmail } from '@/emails/inquiry-message-angler'
import { InquiryRichOfferAnglerEmail } from '@/emails/inquiry-rich-offer-angler'
import { GuideAssignedEmail } from '@/emails/guide-assigned'
import { InquiryAgentEmail } from '@/emails/inquiry-agent-email'
import type { PasswordResetEmailProps } from '@/emails/password-reset'
import type { InquiryReceivedFaEmailProps } from '@/emails/inquiry-received-fa'
import type { InquiryReceivedAnglerEmailProps } from '@/emails/inquiry-received-angler'
import type { DepositLinkAnglerEmailProps } from '@/emails/deposit-link-angler'
import type { DepositConfirmedAnglerEmailProps } from '@/emails/deposit-confirmed-angler'
import type { DepositConfirmedFaEmailProps } from '@/emails/deposit-confirmed-fa'
import type { BookingConfirmedGuideEmailProps } from '@/emails/booking-confirmed-guide'
import type { InquiryMessageAnglerEmailProps } from '@/emails/inquiry-message-angler'
import type { InquiryRichOfferAnglerEmailProps } from '@/emails/inquiry-rich-offer-angler'
import type { GuideAssignedEmailProps } from '@/emails/guide-assigned'
import type { InquiryAgentEmailProps } from '@/emails/inquiry-agent-email'

const FROM = env.FA_FROM_EMAIL

// ─── Thread headers (email threading) ────────────────────────────────────────

export interface ThreadHeaders {
  /** Message-ID for THIS outbound email, e.g. `<uuid@mail.fjordanglers.com>` */
  messageId:  string
  /** Message-ID of the email we are replying to (omit for the first email in the thread) */
  inReplyTo?: string
}

// ─── Core send helper ─────────────────────────────────────────────────────────

async function sendEmail({
  to,
  subject,
  react,
  threadHeaders,
}: {
  to: string
  subject: string
  react: React.ReactElement
  threadHeaders?: ThreadHeaders
}): Promise<void> {
  const html = await render(react)

  // Build optional threading headers
  const headers: Record<string, string> = {}
  if (threadHeaders) {
    headers['Message-ID'] = threadHeaders.messageId
    if (threadHeaders.inReplyTo) {
      headers['In-Reply-To'] = threadHeaders.inReplyTo
      headers['References']  = threadHeaders.inReplyTo
    }
  }

  const body: Record<string, unknown> = { from: FROM, to, subject, html }
  if (Object.keys(headers).length > 0) body.headers = headers

  // Call Resend REST API directly — bypasses the SDK's internal fetch which can
  // fail silently in Next.js environments where the global fetch is patched with
  // caching logic. Using cache: 'no-store' ensures every send is a fresh request.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '(no body)')
    throw new Error(`[email] Resend HTTP ${response.status}: ${bodyText}`)
  }
}

// ─── Typed send functions ─────────────────────────────────────────────────────

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

// ─── FA Inquiry Flow emails ───────────────────────────────────────────────────

/**
 * Sent to FA when a new inquiry is submitted via POST /api/inquiries.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendInquiryReceivedFaEmail(
  props: { to: string } & InquiryReceivedFaEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New inquiry — ${templateProps.tripTitle} from ${templateProps.anglerName}`,
    react:   createElement(InquiryReceivedFaEmail, templateProps),
  })
}

/**
 * Sent to the angler confirming their inquiry was received.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendInquiryReceivedAnglerEmail(
  props: { to: string } & InquiryReceivedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Inquiry received — ${templateProps.tripTitle}`,
    react:   createElement(InquiryReceivedAnglerEmail, templateProps),
  })
}

/**
 * Sent to the angler when FA sends a deposit link.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendDepositLinkAnglerEmail(
  props: { to: string } & DepositLinkAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Action required — secure your booking for ${templateProps.tripTitle}`,
    react:   createElement(DepositLinkAnglerEmail, templateProps),
  })
}

/**
 * Sent to the angler when their deposit is confirmed (webhook fires).
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendDepositConfirmedAnglerEmail(
  props: { to: string } & DepositConfirmedAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Booking confirmed — ${templateProps.tripTitle}`,
    react:   createElement(DepositConfirmedAnglerEmail, templateProps),
  })
}

/**
 * Sent to FA when a deposit is confirmed (webhook fires).
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendDepositConfirmedFaEmail(
  props: { to: string } & DepositConfirmedFaEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Deposit received — ${templateProps.tripTitle} — €${templateProps.depositAmountEur.toFixed(2)}`,
    react:   createElement(DepositConfirmedFaEmail, templateProps),
  })
}

/**
 * Sent to the guide when a deposit is paid and the booking is confirmed.
 * No financial details — only angler info, date, party size.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendBookingConfirmedGuideEmail(
  props: { to: string } & BookingConfirmedGuideEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New booking confirmed — ${templateProps.anglerName} · ${(templateProps.requestedDates ?? [])[0] ?? 'TBD'}`,
    react:   createElement(BookingConfirmedGuideEmail, templateProps),
  })
}

// ─── FA → Angler direct messaging ────────────────────────────────────────────

/**
 * Sent to the angler when FA sends them a direct message from the admin.
 * Subject is set by FA. Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendInquiryMessageAnglerEmail(
  props: { to: string } & InquiryMessageAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: templateProps.subject,
    react:   createElement(InquiryMessageAnglerEmail, templateProps),
  })
}

/**
 * Sent to the guide when FA assigns them to an inquiry.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendGuideAssignedEmail(
  props: { to: string } & GuideAssignedEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `New trip assigned: ${templateProps.anglerName}`,
    react:   createElement(GuideAssignedEmail, templateProps),
  })
}

/**
 * Sent to the angler when FA creates a rich offer with magic link.
 * Email contains a CTA to /offers/[token] page.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendRichOfferAnglerEmail(
  props: { to: string } & InquiryRichOfferAnglerEmailProps,
): Promise<void> {
  const { to, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Your personalised offer — ${templateProps.tripTitle} — €${templateProps.offerTotalEur.toFixed(2)}`,
    react:   createElement(InquiryRichOfferAnglerEmail, templateProps),
  })
}

/**
 * Sent by the AI agent when it needs one more detail from the angler.
 * Minimal, conversational — no buttons, no marketing.
 * Non-blocking: callers should fire-and-forget with .catch().
 */
export async function sendInquiryAgentEmail(
  props: { to: string; threadHeaders?: ThreadHeaders } & InquiryAgentEmailProps,
): Promise<void> {
  const { to, threadHeaders, ...templateProps } = props
  await sendEmail({
    to,
    subject: `Quick question about your ${templateProps.tripTitle} inquiry`,
    react:   createElement(InquiryAgentEmail, templateProps),
    threadHeaders,
  })
}
