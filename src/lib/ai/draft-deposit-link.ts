/**
 * Deposit-link draft helpers. FA-1.30.
 *
 * draftDepositLinkMessage(params)
 *   Pure function — receives all data as arguments, no DB access.
 *   Calls Anthropic with a prompt that instructs the model to include
 *   AMOUNT_PLACEHOLDER and LINK_PLACEHOLDER in its reply.
 *   Validates: each placeholder appears exactly once; raw text contains
 *   no freeform URL or amount pattern.
 *   Substitutes placeholders with amountString and linkUrl.
 *   Returns the final draft text. Throws DraftDepositLinkError on failure.
 *
 * SERVER-ONLY. Caller: src/actions/messages.ts createPaymentLink.
 * Saving the draft row and all DB access belong in the caller (data layer).
 */

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { assembleConversation } from './extract-trip'
import type { ConversationMessage } from './extract-trip'
import type { KnowledgeEntry } from './knowledge'

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
  // Used in error messages only — no DB queries in this function
  inquiryId:       string
  // Inquiry context
  anglerName:      string
  anglerMessage:   string | null
  requestedDates:  string[]
  partySize:       number
  status:          string
  // Guide
  guideName:       string | null
  // Knowledge — caller is responsible for loading and passing these
  instructions:    { body: string }
  knowledgeEntries: KnowledgeEntry[]
  // Trip
  tripTitle:       string
  // Payment — injected verbatim after validation; NOT passed to model
  amountString:    string
  linkUrl:         string
  // Thread messages
  threadMessages:  ConversationMessage[]
}

/**
 * Draft a deposit-link message. Pure — no DB access.
 *
 * Returns the final draft text with {{DEPOSIT_AMOUNT}} replaced by amountString
 * and {{PAYMENT_LINK}} replaced by linkUrl.
 *
 * Throws DraftDepositLinkError when:
 *  - ANTHROPIC_API_KEY is not set
 *  - either placeholder is missing or appears more than once
 *  - raw model output contains a URL or an amount pattern
 *  - post-substitution safety check fails
 */
export async function draftDepositLinkMessage(
  params: DraftDepositLinkParams,
): Promise<string> {
  const {
    inquiryId, anglerName, anglerMessage, requestedDates, partySize, status,
    guideName, instructions, knowledgeEntries, tripTitle,
    amountString, linkUrl, threadMessages,
  } = params

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new DraftDepositLinkError('ANTHROPIC_API_KEY not set')

  const conversation = assembleConversation(
    anglerName,
    anglerMessage ?? null,
    requestedDates,
    partySize,
    tripTitle,
    threadMessages,
    guideName,
  )

  const fullPrompt = [
    buildDepositDraftInstructions(instructions.body),
    '',
    '=== DRAFT CONTEXT ===',
    'Addressee: angler',
    'Channel: email',
    `Inquiry status: ${status}`,
    `Assigned guide: ${guideName ?? 'none'}`,
    '',
    ...(knowledgeEntries.length > 0
      ? [
          '=== KNOWLEDGE ===',
          ...knowledgeEntries.flatMap(e => {
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

  // Each placeholder must appear exactly once
  const amountCount = countOccurrences(rawText, AMOUNT_PLACEHOLDER)
  if (amountCount !== 1) {
    throw new DraftDepositLinkError(
      `Draft validation failed: ${AMOUNT_PLACEHOLDER} must appear exactly once (found ${amountCount}).`,
    )
  }
  const linkCount = countOccurrences(rawText, LINK_PLACEHOLDER)
  if (linkCount !== 1) {
    throw new DraftDepositLinkError(
      `Draft validation failed: ${LINK_PLACEHOLDER} must appear exactly once (found ${linkCount}).`,
    )
  }

  // Raw model output must not contain a URL — only the placeholder is allowed
  if (/https?:\/\//.test(rawText)) {
    throw new DraftDepositLinkError(
      'Draft validation failed: model included a URL in the prose. Use the {{PAYMENT_LINK}} placeholder only.',
    )
  }

  // Raw model output must not contain a freeform amount — only the placeholder is allowed
  if (/(?:\d+(?:[.,]\d+)?\s*(?:EUR|USD|ISK|NZD|GBP)|[€$£]\s*\d+)/.test(rawText)) {
    throw new DraftDepositLinkError(
      'Draft validation failed: model wrote an amount in the prose. Use the {{DEPOSIT_AMOUNT}} placeholder only.',
    )
  }

  const draftText = rawText
    .replace(AMOUNT_PLACEHOLDER, amountString)
    .replace(LINK_PLACEHOLDER, linkUrl)

  // Post-substitution safety checks
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

  void inquiryId  // referenced only for error context at call site
  return draftText
}

function countOccurrences(text: string, needle: string): number {
  let count = 0
  let pos   = 0
  while ((pos = text.indexOf(needle, pos)) !== -1) {
    count++
    pos += needle.length
  }
  return count
}

function buildDepositDraftInstructions(instructionsBody: string): string {
  return [
    instructionsBody,
    '',
    'DEPOSIT-LINK MESSAGE RULES (these override the above for this specific message):',
    `1. Include the token "${AMOUNT_PLACEHOLDER}" exactly once where the deposit amount should appear. Do NOT write any numerical amount — the correct figure will be inserted by code.`,
    `2. Include the token "${LINK_PLACEHOLDER}" exactly once where the payment link URL should appear. Do NOT write any URL — the link will be inserted by code.`,
    '3. Message body only — no subject line, no meta-commentary.',
    '4. Keep the message warm, direct, and brief.',
    '5. Match the tone of the existing conversation.',
  ].join('\n')
}
