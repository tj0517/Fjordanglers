/**
 * Application-level AES-256-GCM field encryption for sensitive DB fields.
 *
 * Used for: guide IBAN, iban_holder_name, iban_bic, iban_bank_name
 *
 * Format stored in DB: `enc:v1:<iv_hex>:<ciphertext_hex>`
 * The `enc:v1:` prefix enables backward-compat reads: plaintext values
 * (without the prefix) are returned as-is so old rows remain readable.
 *
 * Key: IBAN_ENCRYPTION_KEY env var — 64 hex chars (32 bytes).
 * If not set, encrypt/decrypt are no-ops (passthrough) — safe for local dev.
 *
 * SERVER-ONLY — never import in client components.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX    = 'enc:v1:'

function getKey(): Buffer | null {
  const hex = process.env.IBAN_ENCRYPTION_KEY
  if (!hex || hex.length < 64) return null
  return Buffer.from(hex.slice(0, 64), 'hex')
}

/**
 * Encrypt a plaintext string field.
 * Returns `enc:v1:<iv_hex>:<ciphertext_hex><authtag_hex>` or plaintext if no key.
 */
export function encryptField(value: string): string {
  const key = getKey()
  if (!key) return value

  const iv     = randomBytes(12)                          // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()                      // 16-byte GCM auth tag

  return `${PREFIX}${iv.toString('hex')}:${Buffer.concat([ct, tag]).toString('hex')}`
}

/**
 * Decrypt a field value from DB.
 * Handles both encrypted (`enc:v1:...`) and legacy plaintext values.
 * Returns null on decryption failure (corrupt/wrong-key) rather than throwing.
 */
export function decryptField(value: string | null | undefined): string | null {
  if (value == null) return null
  if (!value.startsWith(PREFIX)) return value             // legacy plaintext

  const key = getKey()
  if (!key) {
    // Key not configured — cannot decrypt. Return null to avoid exposing garbage.
    return null
  }

  try {
    const rest       = value.slice(PREFIX.length)
    const colonIdx   = rest.indexOf(':')
    if (colonIdx === -1) return null

    const iv         = Buffer.from(rest.slice(0, colonIdx), 'hex')
    const ctWithTag  = Buffer.from(rest.slice(colonIdx + 1), 'hex')

    // Last 16 bytes = auth tag, rest = ciphertext
    const tag        = ctWithTag.slice(-16)
    const ct         = ctWithTag.slice(0, -16)

    const decipher   = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    return decipher.update(ct) + decipher.final('utf8')
  } catch {
    return null
  }
}

/**
 * Returns true if the value is encrypted (has the enc:v1: prefix).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return value != null && value.startsWith(PREFIX)
}
