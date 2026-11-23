/**
 * The `FAQPage` structured data — one builder for the places that have an FAQ: a country hub
 * (`hub-jsonld.ts`, FA-1.82) and a blog article with an FAQ section (FA-1.97).
 *
 * Pure: entries in, a plain object out. `answer` is plain text (Google reads it as such), never
 * Markdown. Serialise with `serializeJsonLd` (`offer-jsonld.ts`), never a bare `JSON.stringify`
 * between script tags.
 */

export type FaqPageEntry = { question: string; answer: string }

/** Null for an empty list — an empty FAQPage is invalid markup. */
export function buildFaqPageJsonLd(entries: readonly FaqPageEntry[]): Record<string, unknown> | null {
  if (entries.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(entry => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}
