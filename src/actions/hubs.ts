'use server'

/**
 * Hub editor action (FA-1.85). Only an admin writes (`requireAdmin()` first, then the service
 * role); the browser keys have no write path to `destination_hubs` (migration 20261111000000).
 *
 *   saveHubContent   edit the editorial content of one of the six hubs
 *
 * There is no "new hub" and no delete: the hubs that exist are the ones in `destinations.ts`, each
 * with its row from the data migration. A slug outside that list, or a hub without a row, is refused.
 *
 * Every successful change records one `audit_log` row (tj decision 1, 2026-11-11 — the blog's
 * pattern): `table_name` 'destination_hubs', the row's id, the admin's id, the changed fields before
 * and after. The row is written after the update; if it fails the failure is logged and the save
 * stands — a lost audit row must not undo an edit. A save that changes nothing writes nothing.
 *
 * After a change the `hubs` cache tag and every hub page are revalidated: a hub's `h1` is also the
 * label in the other hubs' "More destinations" and in the offer breadcrumbs.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { DESTINATION_HUBS, getHubForSlug } from '@/lib/destinations'
import { CACHE_TAG_HUBS } from '@/lib/supabase/queries'
import { hubAuditDiff } from '@/lib/hubs/audit'
import { HubContentPayloadSchema, hubConstraintMessage, type HubContentPayload, type HubContentValues } from '@/lib/hubs/editor'

export type HubActionResult =
  | { success: true; slug: string; changed: boolean }
  | { success: false; error: string }

const fail = (error: string): HubActionResult => ({ success: false, error })

/** The payload → the table's columns. */
function toColumns(v: HubContentValues) {
  return {
    h1: v.h1,
    intro: v.intro,
    meta_title: v.metaTitle,
    meta_description: v.metaDescription,
    season_months: v.seasonMonths,
    peak_months: v.peakMonths,
    season_note: v.seasonNote,
    species: v.species,
    faq: v.faq,
    hero_quote_text: v.heroQuoteText,
    hero_quote_author: v.heroQuoteAuthor,
    hero_quote_country: v.heroQuoteCountry,
    proof_note: v.proofNote,
    contact_name: v.contactName,
    contact_email: v.contactEmail,
    contact_whatsapp: v.contactWhatsapp,
  }
}

/** Everything a public page may have cached from a hub's content: the tag, and all six hub pages. */
function refreshPublicPages(): void {
  revalidateTag(CACHE_TAG_HUBS, {})
  for (const hub of DESTINATION_HUBS) revalidatePath(`/${hub.slug}`)
  revalidatePath('/admin/hubs')
}

export async function saveHubContent(slug: string, payload: HubContentPayload): Promise<HubActionResult> {
  const { userId } = await requireAdmin()

  // The slug must be one of the hubs in code — before anything touches the database.
  if (typeof slug !== 'string' || getHubForSlug(slug) == null) return fail('Unknown hub')

  const parsed = HubContentPayloadSchema.safeParse(payload)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Validation error')
  const columns = toColumns(parsed.data)

  const supabase = createServiceClient()

  const { data: current, error: readError } = await supabase
    .from('destination_hubs').select('*').eq('slug', slug).maybeSingle()
  if (readError != null) {
    console.error('[saveHubContent read]', readError.message)
    return fail('The hub could not be saved. Try again, and tell a developer if it keeps happening.')
  }
  if (current == null) return fail('This hub has no content row — it cannot be created here.')

  // The diff is taken against what the table will hold, so it is the same shape on both sides.
  const diff = hubAuditDiff(current, { ...current, ...columns })
  if (diff == null) return { success: true, slug, changed: false }

  const { data, error } = await supabase
    .from('destination_hubs').update(columns).eq('id', current.id).select('id')
  if (error != null) {
    const human = hubConstraintMessage(error.message)
    if (human != null) return fail(human)
    console.error('[saveHubContent update]', error.message)
    return fail('The hub could not be saved. Try again, and tell a developer if it keeps happening.')
  }
  if ((data ?? []).length === 0) return fail('The hub was not found. Reload the page and try again.')

  try {
    const { error: auditError } = await createServiceClient().from('audit_log').insert({
      table_name: 'destination_hubs',
      operation: 'UPDATE',
      record_id: current.id,
      old_data: diff.old_data,
      new_data: diff.new_data,
      changed_by: userId,
    })
    if (auditError != null) console.error('[hub audit] insert failed:', auditError.message)
  } catch (err) {
    console.error('[hub audit] failed:', err instanceof Error ? err.message : err)
  }

  refreshPublicPages()

  return { success: true, slug, changed: true }
}
