/**
 * Draft a deposit-link announcement message. FA-1.30.
 *
 * draftDepositLinkMessage({ inquiryId, amountString, linkUrl })
 *   - Loads inquiry context, thread, and knowledge (same as draftReply).
 *   - Calls Anthropic with a prompt that instructs the model to include
 *     AMOUNT_PLACEHOLDER and LINK_PLACEHOLDER in its reply.
 *   - Validates the raw model output contains both placeholders.
 *   - Substitutes them with amountString and linkUrl.
 *   - Verifies both exact strings appear in the final text.
 *   - Upserts a messages draft row (status='draft', drafted_by='agent').
 *   - Returns { draftId, text }.
 *
 * SERVER-ONLY. Caller: src/actions/messages.ts createPaymentLink.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { assembleConversation, type ConversationMessage } from './extract-trip'
import { loadKnowledge } from './knowledge'
import { getInquiryExperience, tripTitleOf } from '@/lib/inquiries/experience-lookup'

export const AMOUNT_PLACEHOLDER = '{{DEPOSIT_AMOUNT}}'
export const LINK_PLACEHOLDER   = '{{PAYMENT_LINK}}'

export class DraftDepositLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftDepositLinkError'
  }
}

/** Build the product name for the Stripe product (visible to the angler on the payment page). */
export function buildStripeProductName(
  tripTitle:      string,
  requestedDates: string[],
  partySize:      number,
): string {
  const datePart  = requestedDates.length > 0 ? ` — ${requestedDates.join(', ')}` : ''
  const groupPart = ` · ${partySize} ${partySize === 1 ? 'person' : 'people'}`
  return `${tripTitle}${datePart}${groupPart}`
}

/** Build the description for the Stripe product (visible below the product name). */
export function buildStripeProductDescription(): string {
  return (
    'FjordAnglers booking & curation fee. ' +
    'The trip balance is paid directly to your guide after arrival.'
  )
}

export interface DraftDepositLinkParams {
  inquiryId:    string
  amountString: string  // pre-formatted, e.g. "200.00 EUR" — injected verbatim
  linkUrl:      string  // active Stripe Payment Link URL — injected verbatim
}

export interface DraftDepositLinkResult {
  draftId: string
  text:    string
}

export async function draftDepositLinkMessage(
  params: DraftDepositLinkParams,
): Promise<DraftDepositLinkResult> {
  const { inquiryId, amountString, linkUrl } = params

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new DraftDepositLinkError('ANTHROPIC_API_KEY not set')

  const supabase = createServiceClient()

  const { data: inquiry, error: inquiryErr } = await supabase
    .from('inquiries')
    .select('angler_name, message, requested_dates, party_size, trip_country, assigned_guide_id, trip_id, experience_page_id, status')
    .eq('id', inquiryId)
    .single()

  if (inquiryErr != null || inquiry == null) {
    throw new DraftDepositLinkError(`Inquiry ${inquiryId} not found`)
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('direction, channel, body, occurred_at, counterpart')
    .eq('inquiry_id', inquiryId)
    .neq('status', 'draft')
    .order('occurred_at', { ascending: true })

  const thread = (messages ?? []) as ConversationMessage[]

  let guideName: string | null = null
  if (inquiry.assigned_guide_id) {
    const { data: guide } = await supabase
      .from('guides')
      .select('full_name')
      .eq('id', inquiry.assigned_guide_id)
      .single()
    guideName = guide?.full_name ?? null
  }

  const { instructions, entries } = await loadKnowledge({
    country: inquiry.trip_country,
    guideId: inquiry.assigned_guide_id,
  })

  if (instructions == null) {
    throw new DraftDepositLinkError(
      'No active instructions entry found in agent_knowledge. ' +
      'Add one in the admin panel before drafting.',
    )
  }

  const tripTitle = tripTitleOf(
    await getInquiryExperience({
      experience_page_id: inquiry.experience_page_id,
      trip_id:            inquiry.trip_id,
    }),
  )

  const conversation = assembleConversation(
    inquiry.angler_name,
    inquiry.message ?? null,
    inquiry.requested_dates ?? [],
    inquiry.party_size ?? 1,
    tripTitle,
    thread,
    guideName,
  )

  const depositInstructions = buildDepositDraftInstructions(amountString)

  const fullPrompt = [
    depositInstructions,
    '',
    '=== DRAFT CONTEXT ===',
    'Addressee: angler',
    'Channel: email',
    `Inquiry status: ${inquiry.status}`,
    `Assigned guide: ${guideName ?? 'none'}`,
    '',
    ...(entries.length > 0
      ? [
          '=== KNOWLEDGE ===',
          ...entries.flatMap(e => {
            const label =
              e.kind === 'guide'       ? `Guide (${e.guide_id ?? 'unknown'})` :
              e.kind === 'destination' ? `Destination: ${e.country ?? 'unknown'}` :
              'Tone'
            return [`\n--- ${label} (${e.title}) ---`, e.body]
          }),
          '\n',
        ]
      : []),
    '=== CONVERSATION ===',
    conversation,
  ].join('\n')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: fullPrompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new DraftDepositLinkError('Unexpected response type from Anthropic')
  }

  const rawText = block.text.trim()

  if (!rawText.includes(AMOUNT_PLACEHOLDER)) {
    throw new DraftDepositLinkError(
      `Draft validation failed: model did not include the amount placeholder (${AMOUNT_PLACEHOLDER}).`,
    )
  }
  if (!rawText.includes(LINK_PLACEHOLDER)) {
    throw new DraftDepositLinkError(
      `Draft validation failed: model did not include the link placeholder (${LINK_PLACEHOLDER}).`,
    )
  }

  const draftText = rawText
    .replace(AMOUNT_PLACEHOLDER, amountString)
    .replace(LINK_PLACEHOLDER, linkUrl)

  // Post-substitution safety check
  if (!draftText.includes(amountString)) {
    throw new DraftDepositLinkError(
      'Draft validation failed: amount string not found in draft after substitution.',
    )
  }
  if (!draftText.includes(linkUrl)) {
    throw new DraftDepositLinkError(
      'Draft validation failed: link URL not found in draft after substitution.',
    )
  }

  // Upsert: overwrite existing angler/email draft if present
  const { data: existingDraft } = await supabase
    .from('messages')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('counterpart', 'angler')
    .eq('channel', 'email')
    .eq('status', 'draft')
    .maybeSingle()

  let draftId: string

  if (existingDraft != null) {
    const { error: updateErr } = await supabase
      .from('messages')
      .update({ body: draftText, status: 'draft', occurred_at: new Date().toISOString() })
      .eq('id', existingDraft.id)
    if (updateErr != null) {
      throw new DraftDepositLinkError(`Failed to update draft: ${updateErr.message}`)
    }
    draftId = existingDraft.id
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('messages')
      .insert({
        inquiry_id:  inquiryId,
        channel:     'email',
        direction:   'outbound',
        counterpart: 'angler',
        body:        draftText,
        status:      'draft',
        drafted_by:  'agent',
        occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr != null || inserted == null) {
      throw new DraftDepositLinkError(`Failed to save draft: ${insertErr?.message ?? 'no row returned'}`)
    }
    draftId = inserted.id
  }

  return { draftId, text: draftText }
}

function buildDepositDraftInstructions(amountString: string): string {
  return [
    instructions_prefix,
    '',
    `The purpose of this draft is to send the angler their deposit payment link.`,
    `The deposit amount is ${amountString}.`,
    '',
    'IMPORTANT RULES FOR THIS DRAFT:',
    `1. You MUST include the exact placeholder token "${AMOUNT_PLACEHOLDER}" (without quotes) exactly once where you want to display the deposit amount. Do not write the amount yourself.`,
    `2. You MUST include the exact placeholder token "${LINK_PLACEHOLDER}" (without quotes) exactly once where you want to place the payment link URL. Do not write a URL yourself.`,
    '3. Keep the message warm, direct, and brief — one short paragraph introducing the deposit, then the amount and link.',
    '4. Do not include a subject line — body only.',
    '5. Match the tone of the existing conversation.',
  ].join('\n')
}

const instructions_prefix =
  'You are drafting a message on behalf of FjordAnglers to send to an angler. ' +
  'Write the message body only — no subject line, no meta-commentary, no explanation of what you are doing.'
