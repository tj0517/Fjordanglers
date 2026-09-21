/**
 * Draft-reply agent. FA-1.14.
 *
 * draftReply({ inquiryId, counterpart, channel })
 *   - Fetches the conversation and inquiry context from the DB.
 *   - Loads matching knowledge files from docs/knowledge/.
 *   - Calls the Anthropic API with the assembled prompt.
 *   - Saves the result as a messages row with status='draft', drafted_by='agent'.
 *   - Returns { draftId, text, usedFiles } — does NOT send the message.
 *
 * SERVER-ONLY. Callers: src/actions/messages.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { assembleConversation, type ConversationMessage } from './extract-trip'
import { loadKnowledge } from './knowledge'
import { buildDraftPrompt } from './draft-reply-prompt'
import { getInquiryExperience, tripTitleOf } from '@/lib/inquiries/experience-lookup'

export interface DraftReplyParams {
  inquiryId:   string
  counterpart: 'angler' | 'guide'
  channel:     'email' | 'whatsapp' | 'instagram'
  /** Override knowledge directory for tests. */
  knowledgeDir?: string
}

export interface DraftReplyResult {
  draftId:   string
  text:      string
  usedFiles: string[]
}

export class DraftReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftReplyError'
  }
}

export async function draftReply(params: DraftReplyParams): Promise<DraftReplyResult> {
  const { inquiryId, counterpart, channel, knowledgeDir } = params

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new DraftReplyError('ANTHROPIC_API_KEY not set')

  const supabase = createServiceClient()

  // Fetch inquiry context
  const { data: inquiry, error: inquiryErr } = await supabase
    .from('inquiries')
    .select('angler_name, message, requested_dates, party_size, trip_country, assigned_guide_id, trip_id, experience_page_id')
    .eq('id', inquiryId)
    .single()

  if (inquiryErr != null || inquiry == null) {
    throw new DraftReplyError(`Inquiry ${inquiryId} not found`)
  }

  // Fetch message thread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (supabase as any)
    .from('messages')
    .select('direction, channel, body, occurred_at')
    .eq('inquiry_id', inquiryId)
    .order('occurred_at', { ascending: true })

  const thread = (messages ?? []) as ConversationMessage[]

  if (thread.length === 0) {
    throw new DraftReplyError('Cannot draft a reply: the conversation thread is empty. Send at least one message first.')
  }

  // Resolve guide name for knowledge lookup
  let guideName: string | null = null
  if (inquiry.assigned_guide_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: guide } = await (supabase as any)
      .from('guides')
      .select('full_name')
      .eq('id', inquiry.assigned_guide_id)
      .single()
    guideName = guide?.full_name ?? null
  }

  // Load knowledge files
  const knowledge = loadKnowledge({
    country:      inquiry.trip_country,
    guide:        guideName,
    knowledgeDir,
  })

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
  )

  // Build prompt + call model
  const fullPrompt = buildDraftPrompt(knowledge, conversation)

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

  // Save draft — does NOT emit an event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('messages')
    .insert({
      inquiry_id:  inquiryId,
      channel,
      direction:   'outbound',
      counterpart,
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

  return {
    draftId:   inserted.id as string,
    text:      draftText,
    usedFiles: knowledge.map(f => f.path),
  }
}
