/**
 * Draft-reply agent. FA-1.14 / FA-1.23.
 *
 * draftReply({ inquiryId, counterpart, channel })
 *   - Fetches the conversation and inquiry context from the DB.
 *   - Loads active knowledge entries from agent_knowledge (instructions, tone, destination, guide).
 *   - Calls the Anthropic API with the assembled prompt.
 *   - Saves the result as a messages row with status='draft', drafted_by='agent'.
 *   - Returns { draftId, text, subject, usedIds } — does NOT send the message.
 *
 * SERVER-ONLY. Callers: src/actions/messages.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { assembleConversation, type ConversationMessage } from './extract-trip'
import { loadKnowledge } from './knowledge'
import { buildDraftPrompt, buildDraftSubject, type DraftContext } from './draft-reply-prompt'
import { getInquiryExperience, tripTitleOf } from '@/lib/inquiries/experience-lookup'

export interface DraftReplyParams {
  inquiryId:   string
  counterpart: 'angler' | 'guide'
  channel:     'email' | 'whatsapp' | 'instagram'
}

export interface DraftReplyResult {
  draftId:  string
  text:     string
  /** Suggested email subject (email channel only; null for other channels). */
  subject:  string | null
  usedIds:  string[]
}

export class DraftReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftReplyError'
  }
}

export async function draftReply(params: DraftReplyParams): Promise<DraftReplyResult> {
  const { inquiryId, counterpart, channel } = params

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new DraftReplyError('ANTHROPIC_API_KEY not set')

  const supabase = createServiceClient()

  // Fetch inquiry context
  const { data: inquiry, error: inquiryErr } = await supabase
    .from('inquiries')
    .select('angler_name, message, requested_dates, party_size, trip_country, assigned_guide_id, trip_id, experience_page_id, status')
    .eq('id', inquiryId)
    .single()

  if (inquiryErr != null || inquiry == null) {
    throw new DraftReplyError(`Inquiry ${inquiryId} not found`)
  }

  // Fetch message thread — exclude drafts so they don't pollute the AI context
  const { data: messages } = await supabase
    .from('messages')
    .select('direction, channel, body, occurred_at, counterpart')
    .eq('inquiry_id', inquiryId)
    .neq('status', 'draft')
    .order('occurred_at', { ascending: true })

  const thread = (messages ?? []) as ConversationMessage[]

  if (thread.length === 0) {
    throw new DraftReplyError('Cannot draft a reply: the conversation thread is empty. Send at least one message first.')
  }

  // Resolve guide name for conversation context
  let guideName: string | null = null
  if (inquiry.assigned_guide_id) {
    const { data: guide } = await supabase
      .from('guides')
      .select('full_name')
      .eq('id', inquiry.assigned_guide_id)
      .single()
    guideName = guide?.full_name ?? null
  }

  // Load knowledge entries from agent_knowledge table
  const { instructions, entries, usedIds } = await loadKnowledge({
    country: inquiry.trip_country,
    guideId: inquiry.assigned_guide_id,
  })

  if (instructions == null) {
    throw new DraftReplyError(
      'No active instructions entry found in agent_knowledge. ' +
      'Add one in the admin panel before drafting.',
    )
  }

  // Fetch trip title for conversation context
  const tripTitle = tripTitleOf(
    await getInquiryExperience({
      experience_page_id: inquiry.experience_page_id,
      trip_id:            inquiry.trip_id,
    }),
  )

  // Assemble conversation
  const conversation = assembleConversation(
    inquiry.angler_name,
    inquiry.message ?? null,
    inquiry.requested_dates ?? [],
    inquiry.party_size ?? 1,
    tripTitle,
    thread,
    guideName,
  )

  // Build prompt + call model
  const context: DraftContext = { counterpart, channel, status: inquiry.status, guideName }
  const fullPrompt = buildDraftPrompt(context, instructions.body, entries, conversation)

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: fullPrompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new DraftReplyError('Unexpected response type from Anthropic')
  }

  const draftText = block.text.trim()

  const subject = buildDraftSubject(inquiry, channel)

  // Upsert draft — overwrite existing draft for this inquiry/counterpart/channel if present
  const { data: existingDraft } = await supabase
    .from('messages')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('counterpart', counterpart)
    .eq('channel', channel)
    .eq('status', 'draft')
    .maybeSingle()

  let draftId: string

  if (existingDraft != null) {
    const { error: updateErr } = await supabase
      .from('messages')
      .update({ body: draftText, subject, status: 'draft', occurred_at: new Date().toISOString() })
      .eq('id', existingDraft.id)

    if (updateErr != null) {
      throw new DraftReplyError(`Failed to update draft: ${updateErr.message}`)
    }
    draftId = existingDraft.id
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('messages')
      .insert({
        inquiry_id:  inquiryId,
        channel,
        direction:   'outbound',
        counterpart,
        subject,
        body:        draftText,
        status:      'draft',
        drafted_by:  'agent',
        occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr != null || inserted == null) {
      throw new DraftReplyError(`Failed to save draft: ${insertErr?.message ?? 'no row returned'}`)
    }
    draftId = inserted.id
  }

  return {
    draftId,
    text:    draftText,
    subject,
    usedIds,
  }
}
