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
function normalisePhone(raw: string): string {
  // Remove all non-digit characters except leading +
  const stripped = raw.replace(/[^\d+]/g, '')
  // Ensure leading +
  if (stripped.startsWith('+')) return stripped
  return '+' + stripped
}

// ─── matchInboundPhone ────────────────────────────────────────────────────────

export interface InboundPhoneMatch {
  inquiryId:    string
  counterpart:  'angler' | 'guide'
  counterpartId: string | null
}

/**
 * Match an inbound WA phone number to open inquiries.
 * Checks (1) inquiries.angler_phone and (2) guides.phone_e164 on open inquiries
 * where the guide is assigned or was contacted.
 *
 * Returns [] when no match, a single-element array for a clean match,
 * and 2+ elements when multiple candidates exist (caller routes to unmatched).
 */
export async function matchInboundPhone(phone: string): Promise<InboundPhoneMatch[]> {
  const normalised = normalisePhone(phone)
  const supabase   = createServiceClient()
  const seen       = new Set<string>()
  const matches: InboundPhoneMatch[] = []

  // 1. Angler phone match
  const { data: anglerRows } = await supabase
    .from('inquiries')
    .select('id, angler_phone')
    .not('status', 'in', '("cancelled","refunded")')
    .not('angler_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  for (const row of (anglerRows ?? []) as Array<{ id: string; angler_phone: string | null }>) {
    if (!row.angler_phone) continue
    if (normalisePhone(row.angler_phone) === normalised && !seen.has(row.id)) {
      seen.add(row.id)
      matches.push({ inquiryId: row.id, counterpart: 'angler', counterpartId: null })
    }
  }

  // 2. Guide phone match — find guides with this phone_e164
  const { data: guides } = await supabase
    .from('guides')
    .select('id')
    .eq('phone_e164', normalised)

  for (const guide of (guides ?? []) as Array<{ id: string }>) {
    // Inquiries where guide is assigned
    const { data: assigned } = await supabase
      .from('inquiries')
      .select('id')
      .eq('guide_id', guide.id)
      .not('status', 'in', '("cancelled","refunded")')

    for (const inq of (assigned ?? []) as Array<{ id: string }>) {
      if (!seen.has(inq.id)) {
        seen.add(inq.id)
        matches.push({ inquiryId: inq.id, counterpart: 'guide', counterpartId: guide.id })
      }
    }

    // Inquiries where guide was contacted (outbound message exists)
    const { data: msgs } = await supabase
      .from('messages')
      .select('inquiry_id')
      .eq('counterpart_id', guide.id)
      .eq('counterpart', 'guide')
      .eq('direction', 'outbound')

    const contactedIds = [...new Set((msgs ?? []).map((m: { inquiry_id: string }) => m.inquiry_id))]
    if (contactedIds.length > 0) {
      const { data: openInqs } = await supabase
        .from('inquiries')
        .select('id')
        .in('id', contactedIds)
        .not('status', 'in', '("cancelled","refunded")')

      for (const inq of (openInqs ?? []) as Array<{ id: string }>) {
        if (!seen.has(inq.id)) {
          seen.add(inq.id)
          matches.push({ inquiryId: inq.id, counterpart: 'guide', counterpartId: guide.id })
        }
      }
    }
  }

  return matches
}

// ─── matchInquiryByEmail ──────────────────────────────────────────────────────

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
