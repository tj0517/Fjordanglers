/**
 * RESEND_DEV_FAKE — the one switch every e-mail send path asks (FA-1.58).
 *
 * With the flag set, nothing may call Resend: each path checks isEmailFaked(),
 * logs one line with logFakeSend() and returns a fake result. Without the flag the
 * check is false and the send runs exactly as before.
 *
 * Production refuses to start with the flag set — see assertNoEmailFakeInProduction()
 * in src/lib/env.ts.
 *
 * SERVER-ONLY.
 */

export function isEmailFaked(): boolean {
  return process.env.RESEND_DEV_FAKE === '1'
}

/** `t***@example.com` — tells which inbox, without the address. */
function maskEmail(address: string | undefined): string {
  if (!address) return '(none)'
  const at = address.lastIndexOf('@')
  return at > 0 ? `${address[0]}***${address.slice(at)}` : '***'
}

/** One log line per skipped send. Never the subject or body: subjects carry angler names. */
export function logFakeSend(type: string, to: string | undefined): void {
  console.info(`[email] RESEND_DEV_FAKE=1 — not sent: type=${type} to=${maskEmail(to)}`)
}
