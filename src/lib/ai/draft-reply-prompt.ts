/**
 * Draft-reply prompt builder. FA-1.14 / FA-1.23.
 *
 * buildDraftPrompt assembles the complete prompt from:
 *   - the draft context (addressee, channel, status, guide)
 *   - knowledge entries loaded from agent_knowledge (tone + destination + guide)
 *   - the instructions text from the active agent_knowledge instructions entry
 *   - the assembled conversation
 */

import type { KnowledgeEntry } from './knowledge'

// ─── Subject line ─────────────────────────────────────────────────────────────

/**
 * Returns a suggested email subject for a draft reply, or null for non-email channels.
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

// ─── Draft context ─────────────────────────────────────────────────────────────

/**
 * Who the draft goes to, over which channel, at what stage of the inquiry.
 * FA-1.21: precedes the knowledge section so the model never confuses the
 * two sides of the thread or addresses the wrong recipient.
 */
export interface DraftContext {
  counterpart: 'angler' | 'guide'
  channel:     'email' | 'whatsapp' | 'instagram'
  /** inquiries.status — see docs/01-architecture.md §4 for the enum. */
  status:      string
  guideName:   string | null
}

// ─── Assembler ────────────────────────────────────────────────────────────────

/**
 * Returns the complete prompt: instructions + draft context + knowledge sections + conversation.
 * @param context      - addressee, channel, inquiry status, assigned guide
 * @param instructions - body of the active agent_knowledge instructions entry
 * @param knowledge    - tone/destination/guide entries loaded by loadKnowledge
 * @param conversation - full conversation assembled by assembleConversation
 */
export function buildDraftPrompt(
  context:      DraftContext,
  instructions: string,
  knowledge:    KnowledgeEntry[],
  conversation: string,
): string {
  const sections: string[] = []

  sections.push('=== DRAFT CONTEXT ===')
  sections.push(`Addressee: ${context.counterpart}`)
  sections.push(`Channel: ${context.channel}`)
  sections.push(`Inquiry status: ${context.status}`)
  sections.push(`Assigned guide: ${context.guideName ?? 'none'}`)
  sections.push('')

  if (knowledge.length > 0) {
    sections.push('=== KNOWLEDGE ===')
    for (const entry of knowledge) {
      const label =
        entry.kind === 'guide'       ? `Guide (${entry.guide_id ?? 'unknown'})` :
        entry.kind === 'destination' ? `Destination: ${entry.country ?? 'unknown'}` :
        'Tone'
      sections.push(`\n--- ${label} (${entry.title}) ---`)
      sections.push(entry.body)
    }
    sections.push('\n')
  }

  sections.push('=== CONVERSATION ===')
  sections.push(conversation)

  return instructions + '\n\n' + sections.join('\n')
}
