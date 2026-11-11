/**
 * Hubs for the admin editor (FA-1.85) — the reader behind /admin/hubs.
 *
 * The public read (`getHubContents` in queries.ts) is cached and serves the pages; the editor needs
 * the row as it is now, so these go through the service role, on the server, and check the caller
 * themselves — the same shape as `blog-admin.ts`.
 *
 * Import only in Server Components or Server Actions — never in Client Components.
 */

import { createServiceClient } from './server'
import { requireAdmin } from '@/lib/auth/guards'
import { DESTINATION_HUBS, getHubCountries, getHubForSlug, type DestinationHubSkeleton } from '@/lib/destinations'
import type { Database } from './database.types'

export type HubAdminRow = Database['public']['Tables']['destination_hubs']['Row']

export type HubListItem = {
  slug: string
  /** Null when the table has no row for a hub that exists in code (a data bug the list shows). */
  row: Pick<HubAdminRow, 'h1' | 'updated_at'> | null
  countries: string[]
}

/** The six hubs of `destinations.ts`, in their order, each with what the table says now. */
export async function listHubsForAdmin(): Promise<HubListItem[]> {
  await requireAdmin()

  const { data, error } = await createServiceClient().from('destination_hubs').select('slug, h1, updated_at')
  if (error != null) throw new Error(`[listHubsForAdmin] ${error.message}`)

  const bySlug = new Map((data ?? []).map(r => [r.slug, r]))
  return DESTINATION_HUBS.map(hub => ({
    slug: hub.slug,
    row: bySlug.get(hub.slug) ?? null,
    countries: getHubCountries(hub),
  }))
}

/** One hub's row and skeleton; null for a slug that is not one of the hubs, or has no row. */
export async function getHubForAdmin(slug: string): Promise<{ skeleton: DestinationHubSkeleton; row: HubAdminRow } | null> {
  await requireAdmin()

  const skeleton = getHubForSlug(slug)
  if (skeleton == null) return null

  const { data, error } = await createServiceClient().from('destination_hubs').select('*').eq('slug', slug).maybeSingle()
  if (error != null) throw new Error(`[getHubForAdmin] ${error.message}`)
  return data == null ? null : { skeleton, row: data }
}
