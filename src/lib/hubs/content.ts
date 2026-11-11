/**
 * The editorial content of a country hub (FA-1.85) — what lives in `destination_hubs` and what the
 * hub page renders. Pure: no I/O, importable from the page's view, the JSON-LD builder, the form
 * and the data layer alike.
 *
 * The skeleton of a hub (slug, region group, countries, article links) stays in `destinations.ts`;
 * the rest is this. Every field after `metaDescription` is optional: a section whose field is empty
 * is not rendered.
 */

import { parseFaq, type FaqEntry } from '@/lib/experience-v2-content'
import type { Database } from '@/lib/supabase/database.types'

export type HubContentRow = Database['public']['Tables']['destination_hubs']['Row']

export type HubContent = {
  h1: string
  intro: string
  metaTitle: string
  metaDescription: string

  /** Month numbers (1–12) the season is open. Empty = no season section. */
  seasonMonths?: number[]
  /** Month numbers of the best weeks; drawn darker in the season bar. */
  peakMonths?: number[]
  /** One or two sentences under the season bar. */
  seasonNote?: string
  /** Species chips. Non-empty overrides the list derived from the hub's offers (tj D2, 2026-10-23). */
  species?: string[]
  faq?: FaqEntry[]
  heroQuote?: { text: string; author: string; country: string }
  /** The third part of the hero's proof line, e.g. "gear included". Empty = the line ends after the price. */
  proofNote?: string
  /** `whatsapp` is the number in international format, digits only (as `wa.me` takes it). */
  contact?: { name: string; email: string; whatsapp: string }
}

/**
 * A table row → the content the page renders. The quote and the contact are all-or-nothing in the
 * table, so either one is complete here or absent. The FAQ is read through `parseFaq`, which drops
 * an entry that lacks a question or an answer — a half entry never reaches the page.
 */
export function hubContentFromRow(row: HubContentRow): HubContent {
  return {
    h1: row.h1,
    intro: row.intro,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    seasonMonths: row.season_months,
    peakMonths: row.peak_months,
    ...(row.season_note != null && { seasonNote: row.season_note }),
    species: row.species,
    faq: parseFaq(row.faq),
    ...(row.hero_quote_text != null && row.hero_quote_author != null && row.hero_quote_country != null && {
      heroQuote: { text: row.hero_quote_text, author: row.hero_quote_author, country: row.hero_quote_country },
    }),
    ...(row.proof_note != null && { proofNote: row.proof_note }),
    ...(row.contact_name != null && row.contact_email != null && row.contact_whatsapp != null && {
      contact: { name: row.contact_name, email: row.contact_email, whatsapp: row.contact_whatsapp },
    }),
  }
}
