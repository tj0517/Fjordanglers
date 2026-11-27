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

import { randomUUID } from 'node:crypto'
import { createElement } from 'react'
import { render } from '@react-email/components'
import { env } from '@/lib/env'
import { isEmailFaked, logFakeSend } from '@/lib/email-fake'
import { PasswordResetEmail } from '@/emails/password-reset'
// FA inquiry flow emails
import { InquiryReceivedFaEmail } from '@/emails/inquiry-received-fa'
import { InquiryReceivedAnglerEmail } from '@/emails/inquiry-received-angler'
import { DepositLinkAnglerEmail } from '@/emails/deposit-link-angler'
import { DepositConfirmedAnglerEmail } from '@/emails/deposit-confirmed-angler'
import { DepositConfirmedFaEmail } from '@/emails/deposit-confirmed-fa'
import { BookingConfirmedGuideEmail } from '@/emails/booking-confirmed-guide'
import type { PasswordResetEmailProps } from '@/emails/password-reset'
import type { InquiryReceivedFaEmailProps } from '@/emails/inquiry-received-fa'
import type { InquiryReceivedAnglerEmailProps } from '@/emails/inquiry-received-angler'
import type { DepositLinkAnglerEmailProps } from '@/emails/deposit-link-angler'
import type { DepositConfirmedAnglerEmailProps } from '@/emails/deposit-confirmed-angler'
import type { DepositConfirmedFaEmailProps } from '@/emails/deposit-confirmed-fa'
import type { BookingConfirmedGuideEmailProps } from '@/emails/booking-confirmed-guide'

const FROM = env.FA_FROM_EMAIL

// ─── Thread headers (email threading) ────────────────────────────────────────

interface ThreadHeaders {
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
  if (isEmailFaked()) {
    logFakeSend(typeof react.type === 'function' ? react.type.name : 'unknown', to)
    return
  }

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

  // One key for every attempt of this logical send: if an attempt reached Resend but the
  // answer was lost, the retry is recognised as the same email and not delivered twice.
  const idempotencyKey = randomUUID()

  for (let attempt = 1; ; attempt++) {
    const isLast = attempt >= RESEND_MAX_ATTEMPTS

    let response: Response
    try {
      // Call Resend REST API directly — bypasses the SDK's internal fetch which can
      // fail silently in Next.js environments where the global fetch is patched with
      // caching logic. Using cache: 'no-store' ensures every send is a fresh request.
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      })
    } catch (err) {
      if (isLast || !isTransientNetworkError(err)) throw err
      console.warn(`[email] Resend attempt ${attempt} failed (network), retrying:`, describeNetworkError(err))
      await sleep(RESEND_RETRY_DELAYS_MS[attempt - 1] ?? 0)
      continue
    }

    if (response.ok) return

    const bodyText = await response.text().catch(() => '(no body)')
    const retriable = response.status === 429 || response.status >= 500
    if (isLast || !retriable) {
      throw new Error(`[email] Resend HTTP ${response.status}: ${bodyText}`)
    }
    console.warn(`[email] Resend attempt ${attempt} failed (HTTP ${response.status}), retrying`)
    await sleep(RESEND_RETRY_DELAYS_MS[attempt - 1] ?? 0)
  }
}

// ─── Retry policy (FA-M.15) ───────────────────────────────────────────────────

/**
 * Prod 2026-11-27: `TypeError: fetch failed` / ECONNRESET before the TLS handshake with
 * api.resend.com. Such a failure is retried; a 4xx other than 429 is our mistake and is not.
 */
const RESEND_MAX_ATTEMPTS = 3
/** Wait before attempt 2 and attempt 3. Short: these sends run inside a request. */
const RESEND_RETRY_DELAYS_MS = [250, 750]

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
])

function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err == null || !('code' in err)) return undefined
  return typeof err.code === 'string' ? err.code : undefined
}

/** undici throws `TypeError('fetch failed')` with the socket error as `cause`. */
function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'fetch failed') return true
  const code = errorCode(err) ?? (err instanceof Error ? errorCode(err.cause) : undefined)
  return code != null && TRANSIENT_NETWORK_CODES.has(code)
}

function describeNetworkError(err: unknown): string {
  const cause = err instanceof Error ? err.cause : undefined
  return [err instanceof Error ? err.message : String(err), errorCode(err) ?? errorCode(cause)]
    .filter(Boolean)
    .join(' / ')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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

// ─── Guide assignment / offer / agent emails ─────────────────────────────────

