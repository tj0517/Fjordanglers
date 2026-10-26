/**
 * Draft-reply prompt builder. FA-1.14 / FA-1.23.
 *
 * buildDraftPrompt assembles the complete prompt from:
 *   - the draft context (addressee, channel, status, guide)
 *   - knowledge entries loaded from agent_knowledge (tone + destination + guide)
 *   - the instructions text from the active agent_knowledge instructions entry
 *   - for a client addressee, the code-side drafting rules (FA-1.73) — they hold whatever
 *     the instructions entry says
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

// ─── Output format (FA-1.73) ──────────────────────────────────────────────────

/** Why a model answer is not a clean `<email>…</email>` block. */
export type DraftFormatIssue = 'no_tags' | 'text_outside' | 'multiple_blocks' | 'empty'

const OUTPUT_FORMAT = `=== OUTPUT FORMAT ===
Write the message as one block: <email>, then the message body, then </email>. Nothing before <email> and nothing after </email>: no notes, no reasoning, no "---", no subject line. Everything inside the tags is sent to the addressee exactly as written.
`

/**
 * Takes the e-mail out of the model's answer. Fails closed: `issue` is null only for exactly
 * one block with nothing but whitespace around it. In every other case `body` is the raw
 * answer, so the admin sees what the model wrote — and the caller must not send it.
 */
export function extractEmail(raw: string): { body: string; issue: DraftFormatIssue | null } {
  const blocks = [...raw.matchAll(/<email>([\s\S]*?)<\/email>/g)]
  const opens  = raw.split('<email>').length - 1
  const closes = raw.split('</email>').length - 1

  if (blocks.length === 0) return { body: raw.trim(), issue: 'no_tags' }
  if (blocks.length > 1 || opens > 1 || closes > 1) return { body: raw.trim(), issue: 'multiple_blocks' }

  const [whole, inner] = blocks[0]
  if (raw.replace(whole, '').trim() !== '') return { body: raw.trim(), issue: 'text_outside' }
  if (inner.trim() === '') return { body: raw.trim(), issue: 'empty' }
  return { body: inner.trim(), issue: null }
}

// ─── Drafting rules (FA-1.73) ──────────────────────────────────────────────────

/**
 * Rules for a draft that goes to the client. They live in code, not only in the
 * instructions entry, so an entry edited or written badly cannot bring back a drafter that
 * (1) promises a guide is free on a day, (2) reads the trip page as the client's choice of
 * region, or (3) asks again for what the form already said.
 *
 * What stays in the knowledge entries: which places are covered, the drive times, the
 * prices, the guide-built-offer restrictions for Iceland / Norway / Finland.
 */
const CLIENT_DRAFTING_RULES = `=== DRAFTING RULES ===
These rules hold whatever the instructions above say.

Guides
- You may name the assigned guide and say which region they work in. Never give a guide's phone number, e-mail address, profile link or social handle before the inquiry status is "paid".
- Never state or imply that a guide or a date is available. Do not write "she is free on the 12th", "the 12th works for her" or "she can take you then". Write "we'll check whether <guide> is free on <date>". Saying which region a guide covers is not a statement about availability.

Where and how the client wants to fish
- Region, trip style and length are what the CLIENT wrote: the message, the form answers and the thread. The line "Trip page the client came from" only says which page they clicked on, so it is a hint and never the client's choice. Use it only when the client said nothing on the point.
- Words from the trip title (Highland, South Island, Spring Creeks…) may be offered as one option, never assumed. "South Island" is not "Southland"; a title with a place in it does not mean the client wants that place. If the client names the same place, write about it.
- The client named no place and the country has several regions, or the guide works widely: answer generally for the country or the guide and quote no regional price. One of your questions must be about where they would like to fish or what kind of trip they prefer (an area or region; a day on a river or a longer trip), asked before dates or species.
- The client names a place that the Destination entry lists as a gap or does not cover, and a covered area is within about 1.5 hours' drive (for example Queenstown): say plainly that we don't run day trips from there, offer the nearby covered area as an option (drive time, full day and price from the Destination entry; if the entry has no drive time, say you'll confirm it) and end with a question whether the drive works for them. Do not name a guide in this case.
- The client names a place that is a gap and no covered area is within that drive (for example Nelson, Christchurch, the North Island when we cover only a part of it): the whole answer about the place is "we'll check what our available guides can offer in that area and come back to you". Do not write "gap", "not covered", "unfortunately" or that we have no guide there or that nobody works there. Do not mention any other region, place or drive, and quote no price. You may add one question about the trip itself (dates, level).

What the client already told us
- Never ask for something the client already gave in the form, the brief or the thread: party size, skill level, dates, species. Read "Party size", "Requested dates" and the form answers in the inquiry block before every question. Refer to what they gave instead of asking again.
`

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

  if (context.counterpart === 'angler') {
    sections.push(CLIENT_DRAFTING_RULES)
  }

  sections.push('=== CONVERSATION ===')
  sections.push(conversation)
  sections.push('')
  sections.push(OUTPUT_FORMAT)

  return instructions + '\n\n' + sections.join('\n')
}
