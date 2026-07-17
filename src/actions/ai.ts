'use server'

/**
 * AI-powered server actions for FjordAnglers admin.
 *
 * extractTripDetailsAI(inquiryId)
 *   Fetches the full inquiry conversation (original message + lead_messages)
 *   and calls Claude to extract structured trip brief fields.
 *   Returns ExtractedTripDetails — does NOT save to DB (caller decides).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import {
  extractTripDetails,
  assembleConversation,
  type ExtractedTripDetails,
  type ConversationMessage,
} from '@/lib/ai/extract-trip'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractTripDetailsResult =
  | { success: true;  data: ExtractedTripDetails }
  | { success: false; error: string }

// ─── setAgentStatus ───────────────────────────────────────────────────────────

/**
 * Stops or restarts the AI inquiry agent for a specific inquiry.
 * Setting to 'stopped' prevents any future automated agent rounds.
 * Setting to 'waiting' re-enables it (agent will reply on next inbound message).
 */
export async function setAgentStatus(
  inquiryId: string,
  status: 'waiting' | 'stopped',
): Promise<{ success: boolean; error?: string }> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from('inquiries')
    .update({ agent_status: status })
    .eq('id', inquiryId)
  if (error != null) {
    console.error('[setAgentStatus] Error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ─── extractTripDetailsAI ──────────────────────────────────────────────────────

/**
 * Reads the full inquiry conversation and uses Claude to extract
 * structured trip brief fields.
 *
 * Does NOT persist anything — UI merges returned fields into form state
 * and user saves via existing saveTripDetails().
 */
export async function extractTripDetailsAI(
  inquiryId: string,
): Promise<ExtractTripDetailsResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY is not configured' }
  }

  const svc = createServiceClient()

  // 1. Fetch inquiry fields directly (angler_name is a column, not a join)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry, error: inqErr } = await (svc as any)
    .from('inquiries')
    .select('id, message, party_size, requested_dates, angler_name, trip_id')
    .eq('id', inquiryId)
    .single()

  if (inqErr != null || inquiry == null) {
    console.error('[extractTripDetailsAI] Inquiry fetch error:', inqErr)
    return { success: false, error: 'Inquiry not found' }
  }

  // Fetch experience title separately if trip_id is set
  let experienceTitle: string | null = null
  if (inquiry.trip_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exp } = await (svc as any)
      .from('experiences')
      .select('title')
      .eq('id', inquiry.trip_id)
      .single()
    experienceTitle = (exp as { title: string } | null)?.title ?? null
  }

  // 2. Fetch lead_messages ordered by created_at ASC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages, error: msgErr } = await (svc as any)
    .from('lead_messages')
    .select('direction, channel, contact_name, content, created_at')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  if (msgErr != null) {
    console.error('[extractTripDetailsAI] lead_messages fetch error:', msgErr)
    return { success: false, error: 'Failed to fetch conversation' }
  }

  // 3. Assemble conversation string
  const anglerName     = (inquiry.angler_name as string | null) ?? 'Unknown'
  const requestedDates = Array.isArray(inquiry.requested_dates) ? inquiry.requested_dates as string[] : []

  const conversation = assembleConversation(
    anglerName,
    inquiry.message as string | null,
    requestedDates,
    inquiry.party_size as number,
    experienceTitle,
    (messages ?? []) as ConversationMessage[],
  )

  // 4. Call Claude
  console.log(`[extractTripDetailsAI] Extracting trip details for inquiry ${inquiryId} (${messages?.length ?? 0} messages)`)
  const result = await extractTripDetails(apiKey, conversation)

  if (!result.success) {
    console.error('[extractTripDetailsAI] Extraction error:', result.error)
  } else {
    console.log('[extractTripDetailsAI] Extracted:', result.data)
  }

  return result
}
