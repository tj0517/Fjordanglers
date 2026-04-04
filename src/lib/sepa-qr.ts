/**
 * SEPA EPC QR Code generator.
 *
 * Generates a plain-text EPC 069-12 payload that can be rendered as a QR code
 * (e.g. via qrcode.react or any QR library). Supported by all EU/EEA banking apps
 * (ING, ABN AMRO, Revolut, N26, Wise, DNB, Sparebank, Nordea, OP, etc.).
 *
 * Usage:
 *   const payload = buildSepaQrPayload({ ... })
 *   <QRCodeSVG value={payload} />
 *
 * Reference: EPC069-12 v3.0 — SEPA Credit Transfer initiation via QR code
 */

export type SepaQrOptions = {
  /** Beneficiary name (guide's full name, max 70 chars) */
  beneficiaryName: string
  /** Guide's IBAN — no spaces */
  iban: string
  /** Amount in EUR (e.g. 460.00) */
  amountEur: number
  /** Booking reference (max 35 chars) — shown in angler's bank statement */
  reference: string
  /** Optional BIC of guide's bank */
  bic?: string
}

/**
 * Builds the EPC QR code text payload.
 * Returns a newline-delimited string to be encoded as a QR code.
 */
export function buildSepaQrPayload(opts: SepaQrOptions): string {
  const {
    beneficiaryName,
    iban,
    amountEur,
    reference,
    bic = '',
  } = opts

  // IBAN — strip spaces just in case
  const cleanIban = iban.replace(/\s+/g, '')

  // Amount formatted per EPC spec: "EUR" + amount with exactly 2 decimal places
  const amountStr = `EUR${amountEur.toFixed(2)}`

  // Truncate fields to EPC max lengths
  const name = beneficiaryName.slice(0, 70)
  const ref  = reference.slice(0, 35)

  return [
    'BCD',            // Service tag
    '002',            // Version
    '1',              // Character set (UTF-8)
    'SCT',            // SEPA Credit Transfer
    bic,              // BIC (optional — leave empty for IBAN-only)
    name,             // Beneficiary name
    cleanIban,        // IBAN
    amountStr,        // Amount
    '',               // Purpose code (optional)
    ref,              // Remittance reference (max 35 chars)
    '',               // Remittance text (alt to reference, leave empty)
  ].join('\n')
}

/**
 * Builds the booking reference string from a booking ID.
 * e.g. "FA-3E8A1F2C" — short enough for EPC ref, recognizable in bank statement.
 */
export function buildBookingReference(bookingId: string): string {
  return `FA-${bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}
