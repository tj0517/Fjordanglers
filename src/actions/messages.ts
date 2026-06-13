'use server'

/**
 * messages.ts — Server Actions for the unmatched_messages queue.
 *
 * matchUnmatchedMessage(unmatchedId, inquiryId)
 *   Links an unmatched_message to an inquiry by inserting a lead_messages row
 *   and marking the unmatched_message as matched.
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/actions/inquiries'

// ─── matchUnmatchedMessage ────────────────────────────────────────────────────

/**
 * Link an unmatched_message to an inquiry.
 *
 * 1. Fetches the unmatched_message row.
 * 2. Inserts a lead_messages row (direction=inbound, channel from source).
 * 3. Marks unmatched_messages.matched_inquiry_id + matched_at.
 * 4. Bumps inquiries.last_contact_at.
 */
export async function matchUnmatchedMessage(
  unmatchedId: string,
  inquiryId: string,
): Promise<ActionResult> {
  const svc = createServiceClient()

  // 1. Fetch the unmatched message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg, error: fetchErr } = await (svc as any)
    .from('unmatched_messages')
    .select('id, source, from_identifier, sender_name, content, matched_inquiry_id')
    .eq('id', unmatchedId)
    .maybeSingle()

  if (fetchErr || !msg) {
    return { success: false, error: fetchErr?.message ?? 'Message not found' }
  }

  if (msg.matched_inquiry_id != null) {
    return { success: false, error: 'Message is already linked to an inquiry' }
  }

  const now = new Date().toISOString()

  // 2. Insert lead_messages row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (svc as any).from('lead_messages').insert({
    inquiry_id:   inquiryId,
    direction:    'inbound',
    channel:      msg.source,   // 'whatsapp' | 'email'
    contact_type: 'client',
    contact_name: msg.sender_name || msg.from_identifier,
    content:      msg.content,
    created_by:   'webhook',
  })

  if (insertErr) {
    console.error('[matchUnmatchedMessage] insert lead_messages error:', insertErr)
    return { success: false, error: insertErr.message }
  }

  // 3. Mark unmatched_message as matched
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('unmatched_messages')
    .update({ matched_inquiry_id: inquiryId, matched_at: now, matched_by: 'admin' })
    .eq('id', unmatchedId)

  // 4. Bump last_contact_at on the inquiry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from('inquiries')
    .update({ last_contact_at: now })
    .eq('id', inquiryId)

  console.log(`[matchUnmatchedMessage] Linked unmatched ${unmatchedId} → inquiry ${inquiryId}`)
  return { success: true }
}
