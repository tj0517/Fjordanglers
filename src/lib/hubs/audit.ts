/**
 * The `audit_log` row for a hub change (FA-1.85, tj decision 1, 2026-11-11 — the blog's pattern).
 * Pure: a before and an after in, the row's `old_data` / `new_data` out.
 *
 * Small on purpose: only the fields that changed, each in full. Hub fields are short (the longest
 * is the FAQ, at most 12 entries), so — unlike a blog body — there is no reason to hash them. An
 * edit that changes nothing yields `null`, and the action writes no row.
 */

import type { Json } from '@/lib/supabase/database.types'
import type { HubContentRow } from '@/lib/hubs/content'

/** The columns an editor change can touch. `id`, `slug` and `created_at` never change; `updated_at` is the trigger's. */
const TRACKED = [
  'h1', 'intro', 'meta_title', 'meta_description', 'season_months', 'peak_months', 'season_note',
  'species', 'faq', 'hero_quote_text', 'hero_quote_author', 'hero_quote_country', 'proof_note',
  'contact_name', 'contact_email', 'contact_whatsapp',
] as const

type AuditedHubColumn = (typeof TRACKED)[number]
export type AuditedHub = Pick<HubContentRow, AuditedHubColumn>

/**
 * JSON text with object keys in a fixed order. Postgres stores `jsonb` with its own key order
 * (shorter keys first: `answer` before `question`), so the FAQ as read back and the FAQ as the form
 * sends it are the same data in a different order — they must not count as a change.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** The changed fields before and after, or `null` when nothing changed. */
export function hubAuditDiff(
  before: AuditedHub,
  after: AuditedHub,
): { old_data: Json; new_data: Json } | null {
  const oldData: Record<string, Json> = {}
  const newData: Record<string, Json> = {}

  for (const key of TRACKED) {
    if (canonical(before[key]) === canonical(after[key])) continue
    oldData[key] = before[key]
    newData[key] = after[key]
  }

  return Object.keys(newData).length === 0 ? null : { old_data: oldData, new_data: newData }
}
