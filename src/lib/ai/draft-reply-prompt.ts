/**
 * Draft-reply prompt builder. FA-1.14.
 *
 * This file is the ONE place with the draft-reply system prompt text.
 * FA-1.17 replaces the stub below with the real prompt — no other code changes needed.
 *
 * buildDraftPrompt assembles the system prompt from:
 *   - the injected knowledge files (tone + destination + guide)
 *   - the stub (or real, after FA-1.17) instruction text
 */

import type { KnowledgeFile } from './knowledge'

// ─── Stub system prompt ───────────────────────────────────────────────────────
// FA-1.17 replaces this constant with the real prompt.

const STUB_PROMPT = `You are the FjordAnglers reply assistant.

Draft a warm, professional reply to the angler's most recent message.
Use the conversation history and knowledge files provided.
Return only the reply text — no subject line, no greeting scaffold, no commentary.`

// ─── Subject line ─────────────────────────────────────────────────────────────
// FA-1.17 may replace this with a smarter formula or AI-generated subject.

/**
 * Returns a suggested email subject for a draft reply, or null for non-email channels.
 * @param inquiry - { angler_name, trip_country } from the inquiries row
 * @param channel - the message channel
 */
export function buildDraftSubject(
  inquiry: { angler_name: string | null; trip_country: string | null },
  channel: string,
): string | null {
  if (channel !== 'email') return null
  const country = inquiry.trip_country ?? 'fishing'
  const name    = inquiry.angler_name  ?? ''
  return name
    ? `Re: Your ${country} inquiry — ${name}`
    : `Re: Your ${country} inquiry`
}

// ─── Assembler ────────────────────────────────────────────────────────────────

/**
 * Returns the complete system prompt: knowledge sections + instructions.
 * @param knowledge - files loaded by loadKnowledge for this inquiry
 * @param conversation - full conversation assembled by assembleConversation
 */
export function buildDraftPrompt(
  knowledge: KnowledgeFile[],
  conversation: string,
): string {
  const sections: string[] = []

  if (knowledge.length > 0) {
    sections.push('=== KNOWLEDGE FILES ===')
    for (const f of knowledge) {
      const label = f.kind === 'guide'
        ? `Guide: ${f.guide_name ?? 'unknown'}`
        : f.kind === 'destination'
          ? `Destination: ${f.country ?? 'unknown'}`
          : `Tone`
      sections.push(`\n--- ${label} (${f.path}) ---`)
      sections.push(f.content)
    }
    sections.push('\n')
  }

  sections.push('=== CONVERSATION ===')
  sections.push(conversation)

  return STUB_PROMPT + '\n\n' + sections.join('\n')
}
