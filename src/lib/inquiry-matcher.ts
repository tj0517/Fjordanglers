/**
 * inquiry-matcher.ts — match an incoming message to an existing inquiry.
 *
 * Used by WhatsApp and email inbound webhooks to auto-link messages
 * to the most recent active inquiry for a given phone or email.
 */

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Normalise a phone number to a consistent format for comparison.
 * Strips spaces, dashes, dots, parentheses and ensures a leading '+'.
 *
 * Examples:
 *   "48 123 456 789"  → "+48123456789"
 *   "48123456789"     → "+48123456789"  (Meta sends without +)
 *   "+48 123-456-789" → "+48123456789"
 */
export function normalisePhone(raw: string): string {
  // Remove all non-digit characters except leading +
  const stripped = raw.replace(/[^\d+]/g, '')
  // Ensure leading +
  if (stripped.startsWith('+')) return stripped
  return '+' + stripped
}

/**
 * Find the most recent non-cancelled inquiry matching the given phone number.
 * Returns the inquiry id or null if no match.
 */
export async function matchInquiryByPhone(phone: string): Promise<string | null> {
  const normalised = normalisePhone(phone)
  const supabase = createServiceClient()

  // Query with normalised phone — strip non-digits from DB value via replace
  // We fetch recent inquiries and compare normalised values in JS to avoid
  // DB-side function overhead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('inquiries')
    .select('id, angler_phone')
    .not('status', 'in', '("cancelled","refunded")')
    .not('angler_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !data) return null

  for (const row of data as Array<{ id: string; angler_phone: string | null }>) {
    if (!row.angler_phone) continue
    const normalised_db = normalisePhone(row.angler_phone)
    if (normalised_db === normalised) return row.id
  }

  return null
}

/**
 * Find the most recent non-cancelled inquiry matching the given email address.
 * Returns the inquiry id or null if no match.
 */
export async function matchInquiryByEmail(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('inquiries')
    .select('id')
    .ilike('angler_email', normalised)
    .not('status', 'in', '("cancelled","refunded")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}
