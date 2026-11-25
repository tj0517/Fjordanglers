/**
 * FA-M.12 — data access for `guide_push_subscriptions`.
 *
 * Writes go only through the three DB functions (each with its audit_log row, tj D2 A), called
 * with the service client after requireGuide() (tj D1b A). The one read a guide makes about their
 * own browser goes through their session client, so RLS (owner SELECT) is the guard there.
 * Endpoints and keys never appear in an error message thrown from here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { PushSubscriptionInput } from './subscription'
import type { PushTarget } from './sender'

type Client = SupabaseClient<Database>

/** Service client. Stores / moves / refreshes the browser's subscription for this login. */
export async function savePushSubscription(client: Client, userId: string, sub: PushSubscriptionInput): Promise<void> {
  const { error } = await client.rpc('save_push_subscription', {
    p_user_id: userId, p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth,
  })
  if (error != null) throw new Error(`savePushSubscription failed (${error.code ?? 'no code'})`)
}

/** Service client. Deletes this login's own row for the endpoint; false when there was none. */
export async function deletePushSubscription(client: Client, userId: string, endpoint: string): Promise<boolean> {
  const { data, error } = await client.rpc('delete_push_subscription', { p_user_id: userId, p_endpoint: endpoint })
  if (error != null) throw new Error(`deletePushSubscription failed (${error.code ?? 'no code'})`)
  return data === true
}

/** SESSION client (RLS: own rows only). Is this browser's subscription stored for the signed-in login? */
export async function isPushSubscriptionSaved(sessionClient: Client, endpoint: string): Promise<boolean> {
  const { data, error } = await sessionClient
    .from('guide_push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error != null) throw new Error(`isPushSubscriptionSaved failed (${error.code ?? 'no code'})`)
  return data != null
}

export interface StoredPushSubscription extends PushTarget {
  id: string
}

/** Service client. Every subscription of the guide's login (tj D1a A); none when no login is linked. */
export async function listPushSubscriptionsForGuide(client: Client, guideId: string): Promise<StoredPushSubscription[]> {
  const { data: guide, error: guideError } = await client
    .from('guides')
    .select('user_id')
    .eq('id', guideId)
    .maybeSingle()
  if (guideError != null) throw new Error(`listPushSubscriptionsForGuide: guide read failed (${guideError.code ?? 'no code'})`)
  if (guide?.user_id == null) return []

  const { data, error } = await client
    .from('guide_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', guide.user_id)
  if (error != null) throw new Error(`listPushSubscriptionsForGuide failed (${error.code ?? 'no code'})`)
  return data.map(row => ({ id: row.id, endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }))
}

/** Service client. Removes subscriptions the push service reported gone (404/410); returns how many. */
export async function removeGonePushSubscriptions(client: Client, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { data, error } = await client.rpc('remove_gone_push_subscriptions', { p_ids: [...ids] })
  if (error != null) throw new Error(`removeGonePushSubscriptions failed (${error.code ?? 'no code'})`)
  return data ?? 0
}
