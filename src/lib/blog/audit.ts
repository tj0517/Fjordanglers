/**
 * The `audit_log` row for a blog change (FA-1.84, tj decision 1 → A, 2026-11-10). Pure: a before and an
 * after in, the row's `old_data` / `new_data` out.
 *
 * Small on purpose: only the fields that changed, in full — except the article text, which is
 * recorded as its length and a short hash before and after, never the body itself. The row says
 * *that* the text changed and by how much; the text lives in `blog_posts`.
 */

import { createHash } from 'node:crypto'
import type { Json } from '@/lib/supabase/database.types'

/** The columns an editor change can touch. `updated_at` is the trigger's, `id`/`created_at` never change. */
const TRACKED = [
  'slug', 'title', 'seo_title', 'description', 'image_url', 'image_alt',
  'category', 'country', 'guide_id', 'status', 'published_at',
] as const

export type AuditedPost = Record<(typeof TRACKED)[number], string | null> & { body_md: string }

function bodySummary(body: string): { length: number; sha256_12: string } {
  return { length: body.length, sha256_12: createHash('sha256').update(body).digest('hex').slice(0, 12) }
}

/**
 * `before` null = a new post (every field is "changed"); otherwise only fields that differ.
 * A `published_at` written by the database as `…+00:00` against our ISO string compares as the
 * same instant, so a re-save does not look like a change.
 */
export function blogAuditDiff(
  before: AuditedPost | null,
  after: AuditedPost,
): { old_data: Json | null; new_data: Json } {
  const oldData: Record<string, Json> = {}
  const newData: Record<string, Json> = {}

  const same = (key: (typeof TRACKED)[number], a: string | null, b: string | null): boolean =>
    key === 'published_at' && a != null && b != null ? new Date(a).getTime() === new Date(b).getTime() : a === b

  for (const key of TRACKED) {
    if (before != null && same(key, before[key], after[key])) continue
    if (before != null) oldData[key] = before[key]
    newData[key] = after[key]
  }

  const afterBody = bodySummary(after.body_md)
  const beforeBody = before == null ? null : bodySummary(before.body_md)
  if (beforeBody == null || beforeBody.sha256_12 !== afterBody.sha256_12) {
    if (beforeBody != null) oldData.body_md = beforeBody
    newData.body_md = afterBody
  }

  return { old_data: before == null ? null : oldData, new_data: newData }
}
